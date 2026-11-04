document.documentElement.classList.add('js');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt=n=>Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const $=s=>document.querySelector(s);
(function(){const el=$('#bootLcd'),boot=$('#boot');if(reduce){boot.remove();return}
let t=0;const id=setInterval(()=>{t++;el.textContent=t<14?String(Math.floor(Math.random()*99999)).padStart(5,'0'):'SOFTWEIGHT'.slice(0,Math.min(10,t-13)).padEnd(5,' ');if(t>24)clearInterval(id)},55);
setTimeout(()=>boot.remove(),2500)})();
(function(){const b=$('#burger'),m=$('#menu');
b.addEventListener('click',()=>{const o=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',o);m.classList.toggle('open',o);b.setAttribute('aria-label',o?'Fermer le menu':'Ouvrir le menu')});
m.addEventListener('click',e=>{if(e.target.closest('a')){b.setAttribute('aria-expanded','false');m.classList.remove('open')}});
const links=[...m.querySelectorAll('a[href^="#"]')],secs=links.map(a=>document.querySelector(a.getAttribute('href')));
function spy(){let k=0;secs.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<innerHeight*.35)k=i});links.forEach((a,i)=>a.classList.toggle('on',i===k))}
addEventListener('scroll',spy,{passive:true});spy()})();
const hdr=$('#top');addEventListener('scroll',()=>hdr.classList.toggle('solid',scrollY>40),{passive:true});
(function(){const c=$('#cur');if(!matchMedia('(pointer:fine)').matches)return;
addEventListener('pointermove',e=>{c.style.opacity=1;c.style.transform=`translate(${e.clientX}px,${e.clientY}px)`},{passive:true});
document.addEventListener('pointerover',e=>c.classList.toggle('big',!!e.target.closest('a,button,input,select,textarea,.ref,.eqc')))})();
/* hero indicator follows the pointer */
(function(){
const val=$('#heroVal'),stable=$('#heroStable'),letters=[...document.querySelectorAll('.weight span')],plate=$('#plate');
let target=42360,shown=42360,still;
function set(w){target=w;stable.classList.remove('on');clearTimeout(still);still=setTimeout(()=>stable.classList.add('on'),450)}
if(matchMedia('(pointer:fine)').matches&&!reduce){
$('#accueil').addEventListener('pointermove',e=>{const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;
set(Math.round(x*60000/20)*20);const sink=x*10;letters.forEach((l,i)=>l.style.transform=`translateY(${sink*(0.6+i*.12)}px) scaleY(${1-x*.06})`);plate.style.transform=`translateY(${sink}px)`});
}else{$('#heroHint').textContent='Lecture en direct de l\'indicateur.';if(!reduce)setInterval(()=>set(Math.round((15000+Math.random()*40000)/20)*20),3200)}
(function tick(){shown+=(target-shown)*.18;if(Math.abs(target-shown)<10)shown=target;val.textContent=String(Math.round(shown));requestAnimationFrame(tick)})();
})();
/* parallax: independent `translate` so it never fights with transforms */
(function(){
if(reduce)return;
const els=[...document.querySelectorAll('[data-speed]')],wms=[...document.querySelectorAll('.wm')];
let raf=0;
function run(){const vh=innerHeight;els.forEach(el=>{const r=el.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)return;
const mid=r.top+r.height/2-vh/2;const s=+el.dataset.speed*(innerWidth<700?.5:1);el.style.translate=`0 ${(-mid*s).toFixed(1)}px`});
wms.forEach(w=>{const r=w.getBoundingClientRect();if(r.bottom<0||r.top>vh)return;w.style.setProperty('--wm-y',((r.top+r.height/2-vh/2)*-.15).toFixed(1)+'px')})}
addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(run)},{passive:true});addEventListener('resize',run);run();
})();
/* scroll scene */
(function(){
const sec=$('#pesee'),truck=$('#truck'),yVal=$('#yVal'),yStable=$('#yStable'),tclip=$('#tclipR'),arm=$('#arm'),
lR=$('#lRed'),lG=$('#lGreen'),beam=$('#beam'),plateBox=$('#plateBox'),plateRead=$('#plateRead'),
cloud=$('#cloud'),syncLine=$('#syncLine'),syncDot=$('#syncDot'),bar=$('#sceneBar'),steps=[...document.querySelectorAll('#steps .step')];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),seg=(p,a,b)=>clamp((p-a)/(b-a));
function draw(p){
truck.setAttribute('transform',`translate(${-320+seg(p,0,.22)*520+seg(p,.78,1)*520} 0)`);
const read=seg(p,.12,.24);beam.setAttribute('opacity',read>0&&read<1?.16:0);plateBox.setAttribute('opacity',read>.5&&p<.5?1:0);plateRead.setAttribute('opacity',p>.2&&p<.5?1:0);
const w=seg(p,.24,.42);const jitter=w<1&&w>0?Math.round((Math.sin(p*400)*(1-w))*30)*20:0;
yVal.textContent=p<.22||p>.9?'0':String(Math.round(42360*Math.min(1,w*1.05)+jitter));
yStable.setAttribute('fill',w>=1&&p<.85?'#1d8a52':'#c5d3e0');
tclip.setAttribute('height',seg(p,.46,.6)*70);
const go=p>.62;lR.setAttribute('fill',go?'#4a2522':'#ff5a4e');lG.setAttribute('fill',go?'#3ddc84':'#173d2a');
arm.setAttribute('transform',`rotate(${-80*seg(p,.62,.74)} 556 306)`);
const s=seg(p,.66,.86);cloud.setAttribute('opacity',.3+s*.7);syncLine.setAttribute('opacity',s>0?1:0);
syncDot.setAttribute('opacity',s>0&&s<1?1:0);syncDot.setAttribute('cx',655+15*((s*3)%1));syncDot.setAttribute('cy',190-58*((s*3)%1));
bar.style.width=(p*100)+'%';
const k=p<.24?0:p<.46?1:p<.66?2:3;steps.forEach((st,i)=>st.classList.toggle('on',i===k));
}
if(reduce){draw(.6);return}
let raf=0;function on(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const r=sec.getBoundingClientRect();draw(clamp(-r.top/(r.height-innerHeight)))})}
addEventListener('scroll',on,{passive:true});addEventListener('resize',on);on();
})();
/* versions: the schematic grows as each version is read */
(function(){
const panels=[...document.querySelectorAll('.vpanel')],groups=[...document.querySelectorAll('.vg')],name=$('#verName');
const names=['01 · Monoposte local','02 · Multiposte','03 · Multipont et multi-équipements','04 · Option web et synchronisation'];
function setV(v){groups.forEach(g=>g.classList.toggle('show',+g.dataset.l<=v));panels.forEach(p=>p.classList.toggle('on',+p.dataset.v===v));name.textContent=names[v-1]}
function pick(){const mid=innerHeight*(innerWidth<860?.7:.5);let best=1,bd=1e9;panels.forEach(p=>{const r=p.getBoundingClientRect(),d=Math.abs(r.top+r.height/2-mid);if(d<bd){bd=d;best=+p.dataset.v}});setV(best)}
let raf=0;addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(pick)},{passive:true});pick();
})();
/* network: offline + sync */
(function(){
const eqs=[...document.querySelectorAll('#equip .eq')],link=$('#link'),log=$('#log'),q=$('#queue'),btn=$('#cutBtn');
const names=['Pont-bascule','Ensacheuse','Convoyeur peseur','Bascule de circuit','Pèse-essieu','Pèse-palette'];
const ranges=[[14000,58000],[48,52],[900,2400],[3000,9000],[4000,13000],[300,1500]];
let offline=false,pending=[],n=0;const clock=()=>new Date().toTimeString().slice(0,8);
function addLog(t,x){const d=document.createElement('div');d.innerHTML=`<span>${t}</span><span>${x}</span>`;log.prepend(d);while(log.children.length>6)log.lastChild.remove()}
function packet(){if(reduce)return;const p=document.createElement('i');p.className='pk';link.appendChild(p);setTimeout(()=>p.remove(),1500)}
function weigh(){const i=n++%eqs.length,[a,b]=ranges[i],st=b>100?20:1,w=Math.round((a+Math.random()*(b-a))/st)*st;
const eq=eqs[i];eq.querySelector('.w').textContent=fmt(w)+' kg';eq.classList.add('flash');setTimeout(()=>eq.classList.remove('flash'),600);
const rec={t:clock(),txt:names[i]+' · '+fmt(w)+' kg'};
if(offline){pending.push(rec);q.textContent=pending.length}else{packet();setTimeout(()=>addLog(rec.txt,rec.t),reduce?0:1400)}}
function setOffline(v){offline=v;btn.setAttribute('aria-pressed',v);$('#cutTxt').textContent=v?'Rétablir Internet':'Couper Internet';
link.classList.toggle('cut',v);$('#linkLabel').innerHTML=v?'Internet<br>coupé':'Internet<br>actif';
const ct=$('#cloudTag');ct.textContent=v?'Dernière synchro '+clock():'À jour';ct.className='tagx '+(v?'bad':'ok');
$('#netNote').textContent=v?'Internet est coupé : les pesées continuent et s\'accumulent en local, sans aucune perte.':'Connexion rétablie : SoftWEIGHT envoie automatiquement tout ce qui était en attente.';
if(!v&&pending.length){const list=pending.slice();pending=[];list.forEach((r,k)=>setTimeout(()=>{packet();setTimeout(()=>addLog(r.txt,r.t),reduce?0:1400);q.textContent=Math.max(0,list.length-k-1)},k*180))}}
btn.addEventListener('click',()=>setOffline(!offline));
for(let k=0;k<4;k++)weigh();setInterval(weigh,1700);
})();
/* client size ruler */
(function(){
const data=[
{t:'Très petite exploitation',s:'XS',who:'Usage personnel, petit producteur de cacao, café, riz, coton, haricot ou arachide, petite coopérative.',cfg:[['Équipement','Une balance ou un pèse-palette'],['Version','Monoposte local'],['Fonctions','Tickets, lots, humidité, états'],['Démarrage','Installation en une journée']]},
{t:'Petite unité',s:'S',who:'Petite huilerie, unité de séchage ou d\'usinage, négociant local, produits semi-transformés et finis.',cfg:[['Équipement','Pont-bascule ou pèse-palette'],['Version','Monoposte ou multiposte'],['Fonctions','Analyses labo, facturation, VGM'],['Pilotage','Feux et barrière en option']]},
{t:'PME industrielle',s:'M',who:'Usine de transformation, exportateur, carrière, BTP, logistique.',cfg:[['Équipement','Ponts, ensacheuses, bascules de circuit'],['Version','Multiposte, option web'],['Fonctions','Synchro cloud, Sage, comptabilité'],['Pilotage','Feux, barrières, caméras']]},
{t:'Grand industriel',s:'L',who:'Agro-industrie, mines, ports et terminaux, importateurs et exportateurs.',cfg:[['Équipement','Multipont, convoyeurs peseurs, ferroviaire'],['Version','Multipont, multisite, option web'],['Fonctions','SAP, plateforme web, API'],['Pilotage','LAPI, RFID, automates, cartes I/O']]},
{t:'Très grand compte',s:'XL',who:'Gestionnaires routiers nationaux et régionaux, aluminium, fer et acier, grands groupes agro-industriels.',cfg:[['Équipement','Pèse-essieux, ponts, réseaux de sites'],['Version','Plusieurs sites et pays consolidés'],['Fonctions','Supervision centrale, ERP, rapports'],['Pilotage','Capteurs de niveau, barrières optiques, LAPI']]}];
const r=$('#size'),sw=$('#sw'),ticks=[...document.querySelectorAll('#ticks span')];
function show(){const i=+r.value,d=data[i];sw.style.left=(i*25)+'%';sw.textContent=d.s;$('#szTitle').textContent=d.t;$('#szWho').textContent=d.who;
$('#szCfg').innerHTML=d.cfg.map(([a,b])=>`<div><span>${a}</span><b style="font-weight:500">${b}</b></div>`).join('');ticks.forEach((t,k)=>t.classList.toggle('on',k===i))}
r.addEventListener('input',show);show();
})();
(function(){const h=$('#hum'),f=$('#ref'),base=10000,href=8;
function calc(){const hv=+h.value,fv=+f.value,dh=Math.max(0,hv-href)/100*base,df=fv/100*base;
$('#humO').textContent=hv.toFixed(1).replace('.',',')+' %';$('#refO').textContent=fv.toFixed(1).replace('.',',')+' %';
$('#labBd').innerHTML=`<div><span>Poids net reçu</span><span>${fmt(base)} kg</span></div><div class="minus"><span>Excès d'humidité (${Math.max(0,hv-href).toFixed(1).replace('.',',')} %)</span><span>− ${fmt(dh)} kg</span></div><div class="minus"><span>Réfraction</span><span>− ${fmt(df)} kg</span></div>`;
$('#labOut').textContent=fmt(base-dh-df)+' kg'}
h.addEventListener('input',calc);f.addEventListener('input',calc);calc()})();
(function(){const g=i=>Math.max(0,+document.getElementById(i).value||0);let m=2;
const M={1:['Méthode 1 · conteneur plein pesé, tare du véhicule déduite','Pont-bascule n° 1 · vérifié'],2:['Méthode 2 · somme des lots pesés + tare','Pèse-palette n° 2 · vérifié']};
function calc(){const v=m===1?Math.max(0,g('w1')-g('w2')-g('w3')):g('v1')+g('v2')+g('v3')+g('v4'),t=fmt(v)+' kg';
$('#vgmOut').textContent=t;$('#cVgm').textContent=t;$('#cMe').textContent=M[m][0];$('#cIn').textContent=M[m][1];
$('#cCt').textContent='KJTU 204815 6 · '+(m===2?$('#v4').selectedOptions[0].textContent.split(' ·')[0]:"20'")}
document.querySelectorAll('.mseg button').forEach(b=>b.addEventListener('click',()=>{m=+b.dataset.m;
document.querySelectorAll('.mseg button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
document.querySelectorAll('.mgrp').forEach(x=>x.hidden=+x.dataset.g!==m);calc()}));
document.querySelectorAll('.mgrp input,.mgrp select').forEach(e=>e.addEventListener('input',calc));
$('#cDt').textContent=new Date().toLocaleDateString('fr-FR');
let q='',seed=7;const r=()=>(seed=(seed*9301+49297)%233280)/233280;
for(let y=0;y<21;y++)for(let x=0;x<21;x++){const f=(a,b)=>x>=a&&x<a+7&&y>=b&&y<b+7,inF=f(0,0)||f(14,0)||f(0,14);
const on=inF?(x%7===0||x%7===6||y%7===0||y%7===6||((x%7>1&&x%7<5)&&(y%7>1&&y%7<5))):r()<.5;if(on)q+=`<rect x="${x}" y="${y}" width="1" height="1"/>`}
$('#cQr').innerHTML=q;calc()})();
(function(){const inner=['Sage','SAP','ERP','Facturation','Comptabilité','API web','PDF · Excel'];
const outer=['Automates','Cartes I/O','Capteurs de niveau','Barrières optiques','Feux','Barrières','Caméras','Caméras LAPI','RFID UHF','QR code','Indicateurs'];
function place(ring,list){list.forEach((t,i)=>{const a=i/list.length*Math.PI*2-Math.PI/2,c=document.createElement('div');c.className='chip';
c.style.left=`calc(50% + ${Math.cos(a)*50}%)`;c.style.top=`calc(50% + ${Math.sin(a)*50}%)`;c.innerHTML=`<span>${t}</span>`;ring.appendChild(c)})}
place($('#r1'),inner);place($('#r2'),outer)})();
(function(){if(reduce||!('IntersectionObserver'in window))return;
const els=document.querySelectorAll('.kpi .cnt');els.forEach(el=>el.textContent='0');
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;io.unobserve(e.target);const el=e.target,to=+el.dataset.to,t0=performance.now(),d=1600;
(function step(t){const k=Math.min(1,(t-t0)/d),v=Math.round(to*(1-Math.pow(1-k,3)));el.textContent=v;if(k<1)requestAnimationFrame(step)})(t0)}),{threshold:.6});
els.forEach(el=>io.observe(el))})();
(function(){if(reduce||!('IntersectionObserver'in window))return;
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.remove('pre');io.unobserve(e.target)}}),{rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.rv').forEach(el=>{if(el.getBoundingClientRect().top>innerHeight){el.classList.add('pre');io.observe(el)}})})();
$('#demoForm').addEventListener('submit',e=>{e.preventDefault();const f=e.target;if(!f.nom.value.trim()){f.nom.focus();return}
const lines=[...f.querySelectorAll('input,select,textarea')].filter(x=>x.value.trim()).map(x=>{const l=x.closest('label');return (l?l.childNodes[0].textContent.trim():x.name)+' : '+x.value.trim()});
const txt='Bonjour KENJITECH,\n'+lines.join('\n');window.open('https://wa.me/237697787475?text='+encodeURIComponent(txt),'_blank','noopener');
const s=$('#sent');s.hidden=false;s.innerHTML='Merci. WhatsApp s\'ouvre avec votre demande déjà rédigée : il ne reste qu\'à l\'envoyer. Vous pouvez aussi écrire à <a href="mailto:contact@kenjitech.org?cc=kenjikarim@gmail.com&subject='+encodeURIComponent('Demande depuis le site')+'&body='+encodeURIComponent(txt)+'">contact@kenjitech.org</a>.'});
(function(){const D='assets/captures/',SETS={
lot:{pesage:[
{f:['sw-lot-pesee-968kg','sw-lot-pesee-1845kg','sw-lot-pesee-2730kg','sw-lot-pesee-3567kg'],t:'Pesée par lot sur balance',d:"L'afficheur suit la charge en direct : ici de 968 kg à 3 567 kg. On valide le poids, puis on enregistre le lot."},
{f:['sw-lots'],t:'Lots et palettes',d:'Chaque lot garde ses palettes, ses tares, ses sacs et son poids net, avec la date et l’heure de chaque mouvement.'},
{f:['sw-rapports-pesees'],t:'Rapport des pesées par lot',d:'Filtres par période, lot, client, produit, provenance, destination ou conteneur, puis export PDF ou Excel.'},
{f:['sw-etats'],t:'États des lots',d:'Tous les mouvements de lots : réception, empotage, export, sorties, avec sacs, tares, poids du lot et poids net, puis export PDF, Excel ou état du stock.'},
{f:['sw-stock'],t:'État du stock',d:'Reçu, expédié et stock actuel en kilogrammes, mis à jour à chaque lot.'},
{f:['sw-accueil'],t:'Accueil',d:'Après connexion de l’opérateur : le pesage, les états et la configuration.'}],
compta:[
{f:['sw-compta-generale-caisse'],t:'Caisse : capital et dépenses',d:'Capital reçu, dépenses totales et solde en caisse, avec l’historique et le paiement des lots.'},
{f:['sw-compta-generale-clients'],t:'Comptes clients',d:'Pour chaque client : livraisons, montant livré, financements reçus et écart.'},
{f:['sw-compta-generale-fournisseurs'],t:'Comptes fournisseurs',d:'Montants livrés et financements reçus par fournisseur.'},
{f:['sw-facturation'],t:'Facturation des lots',d:'Coût unitaire au kilo, coût total, coût moyen : la facture se calcule à partir du poids net du lot.'},
{f:['sw-financements-clients'],t:'Financements clients',d:'Préfinancements et financements donnés, avec leur historique et le total.'},
{f:['sw-financements-fournisseurs'],t:'Financements fournisseurs',d:'Financements reçus des fournisseurs et corrections.'}]}};
window.SW_CAPS=SETS;
const dlg=document.getElementById('capBox'),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(dlg){dlg.querySelector('.cap-x').onclick=()=>dlg.close();dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()})}
document.querySelectorAll('.cap-set').forEach(box=>{const G=SETS[box.dataset.set];if(!G)return;
const img=box.querySelector('.cap-img'),tt=box.querySelector('.cap-title'),tx=box.querySelector('.cap-txt'),th=box.querySelector('.cap-thumbs');
let g=Object.keys(G)[0],timer=null,k=0;
Object.values(G).forEach(a=>a.forEach(it=>{if(it.f.length>1)it.f.forEach(n=>{const i=new Image();i.src=D+n+'.jpg'})}));
function show(i){const it=G[g][i];k=0;clearInterval(timer);img.src=D+it.f[0]+'.jpg';img.alt='SoftWEIGHT, logiciel de pesage : '+it.t;tt.textContent=it.t;tx.textContent=it.d;
th.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-current',j===i));
if(it.f.length>1&&!reduce)timer=setInterval(()=>{k=(k+1)%it.f.length;img.src=D+it.f[k]+'.jpg'},1400)}
function build(){th.innerHTML='';G[g].forEach((it,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','listitem');
b.innerHTML='<img src="'+D+'mini/'+it.f[it.f.length-1]+'.jpg" alt="" loading="lazy" width="800" height="450"><span></span>';b.querySelector('span').textContent=it.t;b.onclick=()=>show(i);th.appendChild(b)});show(0)}
box.querySelectorAll('.cap-tabs button').forEach(b=>b.onclick=()=>{box.querySelectorAll('.cap-tabs button').forEach(x=>x.setAttribute('aria-selected',x===b));g=b.dataset.g;build()});
box.querySelector('.cap-zoom').onclick=()=>{if(!dlg||!dlg.showModal){window.open(img.src,'_blank','noopener');return}
dlg.querySelector('img').src=img.src;dlg.querySelector('img').alt=img.alt;dlg.querySelector('p').textContent=tt.textContent+' : '+tx.textContent;dlg.showModal()};
build()})})();
