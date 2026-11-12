/**
 * Copie miroir de la base MariaDB du poste dans le schéma PostgreSQL de l'exploitant.
 *
 * Chaque table du poste "xxx" devient "<schema>.m_xxx" avec :
 *   _site     uuid    : le poste d'origine (un exploitant peut avoir plusieurs ponts-bascules)
 *   _pk       text    : clé primaire d'origine (JSON), unique par poste
 *   _seq      bigint  : n° d'ordre de la modification sur le poste (le plus récent gagne)
 *   _deleted  boolean : supprimé sur le poste (la ligne est conservée en ligne)
 *   _raw      jsonb   : la ligne complète telle qu'envoyée (aucune perte, même si un type ne se convertit pas)
 * + les colonnes d'origine, typées, pour les recherches, états et statistiques.
 */
import type postgres from "postgres";

export type ColumnDef = { name: string; type: string };
export type TableDef = { name: string; columns: ColumnDef[]; primaryKey: string[] };
export type Change = {
  seq: number; // n° de la ligne dans la file du poste (strictement croissant)
  table: string;
  op: "upsert" | "delete";
  pk: Record<string, unknown>;
  row?: Record<string, unknown> | null;
  at?: string; // date de la modification sur le poste
};

const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,55}$/;
export const RESERVED = new Set(["_site", "_pk", "_seq", "_deleted", "_deleted_at", "_raw", "_synced_at", "_modifie_le"]);

export function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Nom non autorisé : ${name}`);
  return name.toLowerCase();
}
export const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
export const tableName = (t: string) => "m_" + ident(t);

export function schemaFor(code: string) {
  return "exp_" + code.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

/** Type MariaDB/MySQL -> type PostgreSQL */
export function pgType(mysql: string): string {
  const t = mysql.toLowerCase().trim();
  if (/^tinyint\(1\)/.test(t) || t === "bool" || t === "boolean") return "smallint";
  if (/^(tinyint|smallint|mediumint|int|integer|bigint|year)/.test(t)) return "bigint";
  if (/^(decimal|numeric|dec|fixed)/.test(t)) return "numeric";
  if (/^(float|double|real)/.test(t)) return "double precision";
  if (/^datetime|^timestamp/.test(t)) return "timestamp";
  if (/^date/.test(t)) return "date";
  if (/^time/.test(t)) return "time";
  if (/^(tinyblob|blob|mediumblob|longblob|binary|varbinary|bit)/.test(t)) return "bytea";
  if (/^json/.test(t)) return "jsonb";
  return "text"; // char, varchar, text, enum, set, ...
}

/** Convertit une valeur envoyée par le poste vers le type de colonne. null si non convertible (la valeur reste dans _raw). */
export function convert(v: unknown, pg: string): unknown {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v.trim() : v;
  switch (pg) {
    case "bigint":
    case "smallint": {
      if (typeof s === "boolean") return s ? 1 : 0;
      const n = typeof s === "number" ? s : Number(s);
      return Number.isFinite(n) ? String(Math.trunc(n)) : null;
    }
    case "numeric":
    case "double precision": {
      const n = typeof s === "number" ? s : Number(String(s).replace(",", "."));
      return Number.isFinite(n) ? String(n) : null;
    }
    case "timestamp": {
      const str = String(s);
      if (!str || str.startsWith("0000-00-00")) return null;
      return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str) ? str.replace("T", " ") : null;
    }
    case "date": {
      const str = String(s);
      if (!str || str.startsWith("0000-00-00")) return null;
      return /^\d{4}-\d{2}-\d{2}/.test(str) ? str.slice(0, 10) : null;
    }
    case "time":
      return /^-?\d{1,3}:\d{2}(:\d{2}(\.\d+)?)?$/.test(String(s)) ? String(s) : null;
    case "bytea":
      return typeof s === "string" ? Buffer.from(s, "base64") : null;
    case "jsonb":
      return typeof s === "string" ? (() => { try { return JSON.parse(s); } catch { return null; } })() : s;
    default:
      return typeof s === "object" ? JSON.stringify(s) : String(v);
  }
}

export function pkKey(pk: Record<string, unknown>): string {
  const keys = Object.keys(pk).map((k) => k.toLowerCase()).sort();
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(pk)) lower[k.toLowerCase()] = v === null || v === undefined ? null : String(v);
  return JSON.stringify(keys.map((k) => [k, lower[k]]));
}

type Tx = postgres.TransactionSql;

/** Crée le schéma de l'exploitant et les tables techniques. */
export async function ensureSchema(t: Tx, schema: string) {
  if (!/^exp_[a-z0-9_]{1,40}$/.test(schema)) throw new Error("schéma invalide");
  await t.unsafe(`create schema if not exists ${q(schema)}`);
  await t.unsafe(`create table if not exists ${q(schema)}._tables (
      nom text primary key,
      colonnes jsonb not null,
      cle jsonb not null,
      maj timestamptz not null default now())`);
  await t.unsafe(`create table if not exists ${q(schema)}._controle (
      site uuid not null, nom text not null, periode text not null,
      nb bigint not null, somme text, maj timestamptz not null default now(),
      primary key (site, nom, periode))`);
}

/** Crée ou complète les tables miroir d'après la description envoyée par le poste. */
export async function applySchema(t: Tx, schema: string, tables: TableDef[]) {
  for (const def of tables) {
    const tn = tableName(def.name);
    const cols = def.columns
      .filter((c) => IDENT.test(c.name) && !RESERVED.has(c.name.toLowerCase()))
      .map((c) => ({ name: c.name.toLowerCase(), pg: pgType(c.type), mysql: c.type }));
    await t.unsafe(`create table if not exists ${q(schema)}.${q(tn)} (
        _site uuid not null,
        _pk text not null,
        _seq bigint not null,
        _deleted boolean not null default false,
        _deleted_at timestamptz,
        _modifie_le timestamp,
        _synced_at timestamptz not null default now(),
        _raw jsonb not null,
        primary key (_site, _pk))`);
    const existing = await t.unsafe(
      `select column_name from information_schema.columns where table_schema = $1 and table_name = $2`,
      [schema, tn]
    );
    const have = new Set(existing.map((r) => String(r.column_name)));
    for (const c of cols) {
      if (!have.has(c.name)) await t.unsafe(`alter table ${q(schema)}.${q(tn)} add column ${q(c.name)} ${c.pg}`);
    }
    await t.unsafe(
      `insert into ${q(schema)}._tables (nom, colonnes, cle) values ($1, $2, $3)
       on conflict (nom) do update set colonnes = excluded.colonnes, cle = excluded.cle, maj = now()`,
      [def.name.toLowerCase(), cols as never, def.primaryKey.map((k) => k.toLowerCase()) as never]
    );
  }
}

export async function loadTypes(t: Tx | postgres.Sql, schema: string): Promise<Map<string, Map<string, string>>> {
  const rows = await t.unsafe(`select nom, colonnes from ${q(schema)}._tables`);
  const m = new Map<string, Map<string, string>>();
  for (const r of rows) {
    const cols = new Map<string, string>();
    for (const c of r.colonnes as { name: string; pg: string }[]) cols.set(c.name, c.pg);
    m.set(String(r.nom), cols);
  }
  return m;
}

/**
 * Applique un lot de modifications. Idempotent : renvoyer le même lot ne crée aucun doublon,
 * et une modification plus ancienne (_seq inférieur) n'écrase jamais une plus récente.
 * Retourne les n° acceptés et ceux refusés (table inconnue -> le poste renverra le schéma).
 */
export async function applyChanges(t: Tx, schema: string, site: string, changes: Change[]) {
  const types = await loadTypes(t, schema);
  const ok: number[] = [];
  const unknownTables = new Set<string>();
  for (const ch of changes) {
    const tn = ch.table.toLowerCase();
    const cols = types.get(tn);
    if (!cols) {
      unknownTables.add(tn);
      continue;
    }
    const key = pkKey(ch.pk);
    const full = `${q(schema)}.${q(tableName(tn))}`;
    const at = ch.at && /^\d{4}-\d{2}-\d{2}/.test(ch.at) ? ch.at.replace("T", " ").slice(0, 19) : null;
    if (ch.op === "delete") {
      const raw = ch.row ?? ch.pk;
      const names: string[] = [];
      const vals: unknown[] = [site, key, ch.seq, raw, at];
      if (ch.row) {
        for (const [k, v] of Object.entries(ch.row)) {
          const pg = cols.get(k.toLowerCase());
          if (!pg) continue;
          names.push(k.toLowerCase());
          vals.push(convert(v, pg));
        }
      }
      const colList = names.map(q).join(", ");
      const ph = names.map((_, i) => `$${i + 6}`).join(", ");
      await t.unsafe(
        `insert into ${full} (_site, _pk, _seq, _raw, _modifie_le, _deleted, _deleted_at${names.length ? ", " + colList : ""})
         values ($1, $2, $3, $4, $5, true, now()${names.length ? ", " + ph : ""})
         on conflict (_site, _pk) do update set _deleted = true, _deleted_at = now(), _seq = excluded._seq,
           _modifie_le = excluded._modifie_le, _synced_at = now()
         where ${full}._seq < excluded._seq`,
        vals as never[]
      );
    } else {
      const row = ch.row ?? {};
      const names: string[] = [];
      const vals: unknown[] = [site, key, ch.seq, row, at];
      for (const [k, v] of Object.entries(row)) {
        const pg = cols.get(k.toLowerCase());
        if (!pg) continue;
        names.push(k.toLowerCase());
        vals.push(convert(v, pg));
      }
      const colList = names.map(q).join(", ");
      const ph = names.map((_, i) => `$${i + 6}`).join(", ");
      const upd = names.map((n) => `${q(n)} = excluded.${q(n)}`).join(", ");
      await t.unsafe(
        `insert into ${full} (_site, _pk, _seq, _raw, _modifie_le${names.length ? ", " + colList : ""})
         values ($1, $2, $3, $4, $5${names.length ? ", " + ph : ""})
         on conflict (_site, _pk) do update set _seq = excluded._seq, _raw = excluded._raw, _deleted = false,
           _deleted_at = null, _modifie_le = excluded._modifie_le, _synced_at = now()${upd ? ", " + upd : ""}
         where ${full}._seq < excluded._seq`,
        vals as never[]
      );
    }
    ok.push(ch.seq);
  }
  return { ok, unknownTables: [...unknownTables] };
}
