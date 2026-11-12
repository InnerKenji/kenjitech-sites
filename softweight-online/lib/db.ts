import postgres from "postgres";

// Connexion unique par instance (réutilisée entre requêtes sur Vercel Fluid).
declare global {
  // eslint-disable-next-line no-var
  var __swSql: postgres.Sql | undefined;
  // eslint-disable-next-line no-var
  var __swReady: Promise<void> | undefined;
}

function url(): string {
  const u = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!u) throw new Error("DATABASE_URL manquant");
  return u;
}

export function sql(): postgres.Sql {
  if (!global.__swSql) {
    const u = url();
    const local = /localhost|127\.0\.0\.1|\/var\/run/.test(u);
    global.__swSql = postgres(u, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: local ? false : "require",
      prepare: false, // compatible avec le pooler Neon (PgBouncer)
      onnotice: () => {},
      types: {
        // date/heure du poste sans fuseau : gardées telles quelles (heure locale du site)
        naive: { to: 1114, from: [1114], serialize: (x: unknown) => String(x), parse: (x: string) => x },
        jour: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x },
        // bigint renvoyé en number quand c'est sûr, sinon en chaîne
        bigint: {
          to: 20,
          from: [20],
          serialize: (x: unknown) => String(x),
          parse: (x: string) => {
            const n = Number(x);
            return Number.isSafeInteger(n) ? n : x;
          },
        },
      },
    });
  }
  return global.__swSql;
}

/** Schéma commun de la plateforme. Idempotent, exécuté une fois par instance. */
export function ready(): Promise<void> {
  if (!global.__swReady) {
    global.__swReady = migrate().catch((e) => {
      global.__swReady = undefined;
      throw e;
    });
  }
  return global.__swReady;
}

async function migrate() {
  const db = sql();
  await db.begin(async (t) => {
    await t`select pg_advisory_xact_lock(424242)`;
    await t.unsafe(`
create schema if not exists plateforme;

create table if not exists plateforme.admins (
  id bigserial primary key,
  login text not null unique,
  nom text not null default '',
  pwd_hash text not null,
  actif boolean not null default true,
  echecs int not null default 0,
  bloque_jusqua timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists plateforme.exploitants (
  id bigserial primary key,
  code text not null unique,
  schema_name text not null unique,
  nom text not null,
  telephone text not null default '',
  adresse text not null default '',
  ville text not null default '',
  pays text not null default '',
  email text not null default '',
  statut text not null default 'actif' check (statut in ('actif','suspendu')),
  created_at timestamptz not null default now()
);

create table if not exists plateforme.sites (
  id uuid primary key,
  exploitant_id bigint not null references plateforme.exploitants(id),
  magasin text not null default '',
  pont_numero text not null default '',
  pont_nom text not null default '',
  code_machine text not null default '',
  licence text not null default '',
  version_logiciel text not null default '',
  secret_enc text not null,
  statut text not null default 'actif' check (statut in ('actif','revoque')),
  infos jsonb not null default '{}'::jsonb,
  derniere_connexion timestamptz,
  derniere_synchro timestamptz,
  file_attente int,
  created_at timestamptz not null default now()
);
create index if not exists sites_exploitant on plateforme.sites(exploitant_id);

create table if not exists plateforme.web_users (
  id bigserial primary key,
  exploitant_id bigint not null references plateforme.exploitants(id),
  login text not null,
  nom text not null default '',
  role text not null default 'lecture' check (role in ('admin','lecture')),
  pwd_hash text not null,
  actif boolean not null default true,
  echecs int not null default 0,
  bloque_jusqua timestamptz,
  created_at timestamptz not null default now(),
  unique (exploitant_id, login)
);

create table if not exists plateforme.nonces (
  site_id uuid not null,
  nonce text not null,
  ts timestamptz not null default now(),
  primary key (site_id, nonce)
);

create table if not exists plateforme.audit (
  id bigserial primary key,
  ts timestamptz not null default now(),
  acteur text not null,
  exploitant_id bigint,
  action text not null,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists audit_exp on plateforme.audit(exploitant_id, ts desc);

create table if not exists plateforme.login_echecs (
  cle text primary key,
  echecs int not null default 0,
  bloque_jusqua timestamptz,
  maj timestamptz not null default now()
);
`);
  });
}

export async function audit(acteur: string, action: string, exploitantId: number | null, detail: object = {}) {
  await sql()`insert into plateforme.audit (acteur, action, exploitant_id, detail)
              values (${acteur}, ${action}, ${exploitantId}, ${sql().json(detail as never)})`;
}
