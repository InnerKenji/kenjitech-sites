document.documentElement.classList.add('js');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=s=>document.querySelector(s);
const fine=matchMedia('(pointer:fine)').matches;
(function(){const b=$('#boot');if(reduce){b.remove();return}setTimeout(()=>b.remove(),2600)})();
/* supervision mimic: a small process simulated live, wired to the I/O card */
(function(){
const S={v1:false,p1:false,r1:false,auto:false,lvl:40,temp:27,pres:.2,wt:0,hum:62,dump:false,t:0},
el=id=>document.getElementById(id),fr=(v,d)=>v.toFixed(d).replace('.',','),
btns=[...document.querySelectorAll('.sc-ctrl .toggle')];let vis=false,last=0,msgLock=0;
btns.forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.act;
if(k==='auto'){S.auto=!S.auto}else{S.auto=false;S[k]=!S[k]}render(true)}));
function msg(t,al){const m=el('scMsg');m.textContent=t;m.className=al?'alarm':''}
function step(dt){S.t+=dt;
if(S.auto){if(S.lvl<25)S.v1=true;if(S.lvl>80)S.v1=false;
if(S.lvl>35&&!S.dump&&S.wt<1000)S.p1=true;if(S.lvl<15||S.wt>=1000)S.p1=false;
if(S.temp<60&&S.lvl>20)S.r1=true;if(S.temp>72||S.lvl<15)S.r1=false;
if(S.wt>=1000&&!S.dump)S.dump=true}
const flowOut=S.p1&&S.lvl>1;
S.lvl=Math.max(0,Math.min(100,S.lvl+(S.v1?7:0)*dt-(flowOut?5:0)*dt));
if(flowOut&&!S.dump)S.wt=Math.min(1000,S.wt+60*dt);
if(S.dump){S.wt=Math.max(0,S.wt-260*dt);if(S.wt===0)S.dump=false}
S.temp+=((S.r1?80:27)-S.temp)*(S.r1?.09:.04)*dt;
S.pres+=((flowOut?2.3+.25*Math.sin(S.t*2.3)+S.lvl*.006:.2)-S.pres)*.9*dt*3;
S.hum=62+5*Math.sin(S.t/7)-(S.temp-27)*.1;
let al='';
if(S.lvl>=97&&S.v1){S.v1=false;al='Sécurité trop-plein : vanne V1 fermée par l\'automate.'}
if(S.r1&&S.lvl<8){S.r1=false;al='Sécurité marche à sec : chauffe R1 coupée.'}
if(S.wt>=1000&&S.p1&&!S.auto){S.p1=false;al='Trémie pleine : pompe P1 arrêtée. Passez en automatique pour la vidange.'}
if(al){msg(al,true);msgLock=3}
}
function render(force){
const on=(id,c)=>el(id).classList.toggle('on',!!c);
on('scV1',S.v1);on('scPin',S.v1);on('scP1',S.p1);on('scPout',S.p1&&S.lvl>1&&!S.dump);on('scHeat',S.r1);
const h=170*S.lvl/100;el('scLiq').setAttribute('y',240-h);el('scLiq').setAttribute('height',h);
const hh=92*S.wt/1000;el('scHop').setAttribute('y',212-hh);el('scHop').setAttribute('height',hh);
el('scLvl').textContent=Math.round(S.lvl)+' %';el('scTT').textContent=fr(S.temp,1)+' °C';el('scPT').textContent=fr(S.pres,1)+' bar';
el('scWT').textContent=Math.round(S.wt)+' kg';el('scHT').textContent=Math.round(S.hum)+' % HR';
el('scTT').classList.toggle('alarm',S.temp>75);
on('di1',S.lvl<15);on('di2',S.lvl>85);on('di3',S.p1);on('di4',S.wt>=1000);
on('do1',S.v1);on('do2',S.p1);on('do3',S.r1);on('do4',S.dump);
el('di2').classList.add('al');el('di4').classList.add('al');
el('ai1').style.width=Math.min(100,S.temp/1)+'%';el('ai2').style.width=Math.min(100,S.pres/4*100)+'%';
el('ai3').style.width=(S.wt/10)+'%';el('ai4').style.width=S.hum+'%';
btns.forEach(b=>b.setAttribute('aria-pressed',String(!!S[b.dataset.act])));
if(msgLock<=0||force){msgLock=0;
if(S.auto)msg(S.dump?'Mode automatique : trémie pesée à 1 000 kg, vidange en cours.':'Mode automatique : l\'automate régule le niveau, la température et le dosage.');
else if(!S.v1&&!S.p1&&!S.r1)msg('Process à l\'arrêt. Ouvrez la vanne V1 pour remplir la cuve.');
else msg('Mode manuel : '+[S.v1&&'remplissage',S.p1&&'dosage vers la trémie',S.r1&&'chauffe'].filter(Boolean).join(', ')+'.')}
el('scClock').textContent=new Date().toLocaleTimeString('fr-FR');
}
function loop(ts){if(!vis){last=0;return}const dt=last?Math.min(.1,(ts-last)/1000):0;last=ts;step(dt);if(msgLock>0)msgLock-=dt;render();requestAnimationFrame(loop)}
render();
new IntersectionObserver(es=>{const v=es[0].isIntersecting;if(v&&!vis){vis=true;requestAnimationFrame(loop)}vis=v}).observe(el('scSvg'));
})();
/* toll lane: vehicles, sensors and barrier driven by the selected mode */
(function(){
const el=id=>document.getElementById(id),car=el('tlCar'),arm=el('tlArm'),beam=el('tlBeam'),pay=el('tlPay'),hint=el('tlHint'),log=el('tlLog');
const NAMES={man:'Manuel',semi:'Semi-automatique',auto:'Automatique'},PLATES=['LT 482 KT','CE 731 AB','OU 225 FT','LT 905 HC','CE 118 GD','NW 640 PA'];
let mode='semi',st='gap',x=-200,V=null,wait=0,vis=false,last=0,n=0,c1=0,c2=0,tk=1041,k=0,paid=false,read=false,looped=false;
const say=(t,am)=>{const li=document.createElement('li');if(am)li.className='am';const tm=document.createElement('time');tm.textContent=new Date().toLocaleTimeString('fr-FR');li.append(tm,t);log.append(li);while(log.children.length>6)log.firstChild.remove()};
const hot=id=>{const w=el(id);w.classList.add('hot');setTimeout(()=>w.classList.remove('hot'),700)};
function lights(g){el('tlRed').setAttribute('fill',g?'#4a1d1a':'#d4483d');el('tlGreen').setAttribute('fill',g?'#2bd46f':'#16402a');hot('wLight')}
function newCar(){const truck=k%3===2;k++;V={truck,len:truck?150:84,cls:truck?2:1,ax:truck?3:2,plate:PLATES[k%PLATES.length]};
car.innerHTML=truck
?'<rect x="0" y="130" width="112" height="52" rx="4" fill="#cfd9e3"/><rect x="116" y="133" width="34" height="46" rx="6" fill="#f5a71b"/><rect x="138" y="137" width="9" height="38" rx="2" fill="#0d1a26aa"/>'
:'<rect x="0" y="136" width="84" height="40" rx="12" fill="#4fb3ff"/><rect x="50" y="140" width="16" height="32" rx="4" fill="#0d1a26aa"/><rect x="12" y="141" width="12" height="30" rx="3" fill="#0d1a2666"/>';
x=-V.len-20;st='go';paid=read=looped=false;el('tlPlate').textContent=''}
function setMode(m){mode=m;el('tlMode').textContent=NAMES[m];document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===m)));
el('tlOp').style.opacity=m==='auto'?.15:1;pay.textContent=m==='man'?'Encaisser':'Valider le paiement';say('Voie passée en mode '+NAMES[m].toLowerCase()+'.',true)}
document.querySelectorAll('.seg button').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.m)));
function doPay(){if(st!=='stop'||paid)return;paid=true;pay.disabled=true;tk++;
say(mode==='man'?`Opérateur : classe ${V.cls} saisie, paiement encaissé, ticket n° ${tk}.`:`Opérateur : paiement validé, ticket n° ${tk} imprimé.`);open()}
pay.addEventListener('click',doPay);
function open(){lights(true);arm.classList.add('up');hot('wArm');say('Feu vert, barrière ouverte.');st='leave';hint.textContent='Passage en cours…'}
function step(dt){
if(st==='gap'){wait-=dt;if(wait<=0)newCar();return}
const front=x+V.len;
if(st==='go'){x+=150*dt;
if(!looped&&front>=300){looped=true;el('tlLoop').classList.add('on');hot('wLoop');say('Boucle : véhicule détecté.');
if(mode!=='man')say(`Classification : ${V.ax} essieux, classe ${V.cls}${V.truck?' (poids lourd)':''}.`)}
if(!read&&mode!=='man'&&front>=335){read=true;el('tlPlate').textContent=V.plate;hot('wCam');say(`LAPI : plaque ${V.plate} lue.`)}
if(front>=486){x=486-V.len;st='stop';wait=mode==='auto'?.7:(mode==='semi'?3:4.5);
if(mode==='auto'){hint.textContent='Lecture du badge…'}else{pay.disabled=false;hint.textContent=mode==='man'?'À vous : classez et encaissez.':'À vous : validez le paiement.'}}}
else if(st==='stop'){wait-=dt;if(wait<=0){
if(mode==='auto'){paid=true;tk++;say(k%2?`Badge RFID reconnu, abonnement valide, passage n° ${tk}.`:`Compte prépayé de ${V.plate} débité, ticket n° ${tk}.`);open()}else doPay()}}
else if(st==='leave'){x+=170*dt;
const cut=x<472&&x+V.len>468;beam.classList.toggle('cut',cut);if(cut)hot('wBeam');
if(x>300+70)el('tlLoop').classList.remove('on');
if(x>504){beam.classList.remove('cut');arm.classList.remove('up');lights(false);hot('wArm');n++;V.cls===1?c1++:c2++;
el('tlN').textContent=n;el('tlC1').textContent=c1;el('tlC2').textContent=c2;say('Barrière optique : passage confirmé, barrière refermée.');st='out'}}
else if(st==='out'){x+=170*dt;if(x>660){st='gap';wait=.8;hint.textContent='En attente d\'un véhicule…';el('tlPlate').textContent=''}}
car.setAttribute('transform',`translate(${x.toFixed(1)} 0)`)}
function loop(ts){if(!vis){last=0;return}const dt=last?Math.min(.1,(ts-last)/1000):0;last=ts;step(dt);requestAnimationFrame(loop)}
setMode('semi');log.innerHTML='';say('Voie 1 ouverte, mode semi-automatique.',true);wait=.3;
new IntersectionObserver(es=>{const v=es[0].isIntersecting;if(v&&!vis){vis=true;requestAnimationFrame(loop)}vis=v}).observe(el('tlSvg'));
})();
/* menu + scrollspy */
(function(){const b=$('#burger'),m=$('#menu');
b.addEventListener('click',()=>{const o=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',o);m.classList.toggle('open',o);b.setAttribute('aria-label',o?'Fermer le menu':'Ouvrir le menu')});
m.addEventListener('click',e=>{if(e.target.closest('a')){b.setAttribute('aria-expanded','false');m.classList.remove('open')}});
const links=[...m.querySelectorAll('a')],secs=links.map(a=>document.querySelector(a.getAttribute('href')));
function spy(){let k=0;secs.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<innerHeight*.35)k=i});links.forEach((a,i)=>a.classList.toggle('on',i===k))}
addEventListener('scroll',spy,{passive:true});spy()})();
const hdr=$('#top');addEventListener('scroll',()=>hdr.classList.toggle('solid',scrollY>40),{passive:true});
(function(){const c=$('#cur');if(!fine)return;
addEventListener('pointermove',e=>{c.style.opacity=1;c.style.transform=`translate(${e.clientX}px,${e.clientY}px)`},{passive:true});
document.addEventListener('pointerover',e=>{c.classList.toggle('big',!!e.target.closest('a,button,input,select,textarea,.ref,.svc'));c.style.visibility=e.target.closest('#irStage,#utSvg')?'hidden':'visible'})})();
/* rotating verb */
(function(){const w=$('#rotW'),words=['concevons','intégrons','supervisons','mesurons','contrôlons','fournissons','maintenons'];let i=0;
if(reduce)return;setInterval(()=>{i=(i+1)%words.length;w.textContent=words[i]},1900)})();
/* hero circuit board: traces with travelling pulses, brighter near the pointer */
(function(){
const cv=$('#pcb'),ctx=cv.getContext('2d');let W,H,traces=[],pulses=[],mx=-999,my=-999;
function build(){const r=cv.getBoundingClientRect();W=cv.width=Math.round(r.width*devicePixelRatio);H=cv.height=Math.round(r.height*devicePixelRatio);
const g=28*devicePixelRatio;traces=[];let seed=11;const rnd=()=>(seed=(seed*9301+49297)%233280)/233280;
const n=Math.round(W*H/(g*g*14));
for(let k=0;k<n;k++){let x=Math.round(rnd()*W/g)*g,y=Math.round(rnd()*H/g)*g;const pts=[[x,y]];let dir=Math.floor(rnd()*4);
for(let s=0;s<3+Math.floor(rnd()*4);s++){const len=(2+Math.floor(rnd()*5))*g;if(dir===0)x+=len;else if(dir===1)y+=len;else if(dir===2)x-=len;else y-=len;
if(rnd()<.5){const d=g*(rnd()<.5?1:-1);if(dir%2===0)y+=d;else x+=d}pts.push([x,y]);dir=(dir+(rnd()<.5?1:3))%4}
traces.push(pts)}
pulses=traces.map(()=>({t:Math.random(),v:.0015+Math.random()*.003}))}
function lenOf(p){let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return L}
function at(p,t){let L=lenOf(p)*t;for(let i=1;i<p.length;i++){const s=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);if(L<=s){const f=s?L/s:0;return[p[i-1][0]+(p[i][0]-p[i-1][0])*f,p[i-1][1]+(p[i][1]-p[i-1][1])*f]}L-=s}return p[p.length-1]}
function frame(){ctx.clearRect(0,0,W,H);ctx.lineWidth=1.4*devicePixelRatio;
traces.forEach((p,k)=>{ctx.strokeStyle='#ffffff1c';ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);p.slice(1).forEach(q=>ctx.lineTo(q[0],q[1]));ctx.stroke();
ctx.fillStyle='#ffffff30';const e=p[p.length-1];ctx.beginPath();ctx.arc(e[0],e[1],3*devicePixelRatio,0,7);ctx.fill();
const pu=pulses[k];if(!reduce)pu.t=(pu.t+pu.v)%1;const [x,y]=at(p,pu.t);const d=Math.hypot(x-mx,y-my),near=Math.max(0,1-d/(220*devicePixelRatio));
ctx.fillStyle=near>0?`rgba(245,167,27,${.5+near*.5})`:'rgba(125,255,176,.55)';ctx.beginPath();ctx.arc(x,y,(2.2+near*3)*devicePixelRatio,0,7);ctx.fill()});
if(!reduce)requestAnimationFrame(frame)}
addEventListener('resize',()=>{build();if(reduce)frame()});
$('#accueil').addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect();mx=(e.clientX-r.left)*devicePixelRatio;my=(e.clientY-r.top)*devicePixelRatio});
build();frame();
})();
/* parallax */
(function(){if(reduce)return;const els=[...document.querySelectorAll('[data-speed]')],wms=[...document.querySelectorAll('.wm')];let raf=0;
function run(){const vh=innerHeight;els.forEach(el=>{const r=el.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)return;const s=+el.dataset.speed*(innerWidth<700?.5:1);el.style.translate=`0 ${(-(r.top+r.height/2-vh/2)*s).toFixed(1)}px`});
wms.forEach(w=>{const r=w.getBoundingClientRect();if(r.bottom<0||r.top>vh)return;w.style.setProperty('--wm-y',((r.top+r.height/2-vh/2)*-.15).toFixed(1)+'px')})}
addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(run)},{passive:true});addEventListener('resize',run);run()})();
/* THERMOGRAPHY: a real cabinet photo; a temperature field is built from what the photo shows
(copper bars, fuses, cables) plus the load on each feeder, and an IR lens follows the pointer */
(function(){
const cv=$('#irCv'),ctx=cv.getContext('2d'),W=cv.width,H=cv.height,stage=$('#irStage'),read=$('#irRead'),tOut=$('#irT'),msg=$('#irMsg'),full=$('#irFull');
const photo=new Image();photo.src='assets/coffret.jpg';
// fuse positions per feeder (photo pixels): three phases L1 L2 L3
const feeders=[
{n:1,p:[[50,80],[72,80],[92,80]],load:9},{n:2,p:[[200,90],[217,90],[234,90]],load:7},{n:3,p:[[318,95],[332,95],[345,95]],load:11},{n:4,p:[[415,112],[428,112],[441,112]],load:6},
{n:6,p:[[50,290],[72,290],[92,290]],load:8},{n:7,p:[[203,278],[218,278],[234,278]],load:10},{n:8,p:[[318,262],[332,262],[345,262]],load:7},{n:9,p:[[415,262],[428,262],[441,262]],load:5}];
const HOT={x:218,y:274,T:93,f:7};
let F=null,vis=null,th=null;
function T(x,y){if(!F)return 29;const i=Math.max(0,Math.min(W-1,x|0)),j=Math.max(0,Math.min(H-1,y|0));return F[j*W+i]}
function build(){
vis=document.createElement('canvas');vis.width=W;vis.height=H;const v=vis.getContext('2d');v.drawImage(photo,0,0,W,H);
const d=v.getImageData(0,0,W,H).data;let f=new Float32Array(W*H);
for(let k=0;k<W*H;k++){const r=d[k*4],g=d[k*4+1],b=d[k*4+2],l=.3*r+.59*g+.11*b;
const cu=(r>110&&r-g>35&&g>b)?Math.min(1,(r-g)/70):0;
f[k]=8*cu+(l<55?3.2:0)+(l>200?1.6:0)}
// thermal diffusion: a few box-blur passes
const tmp=new Float32Array(W*H);
for(let pass=0;pass<3;pass++){const R=4;
for(let y=0;y<H;y++){let acc=0;for(let x=-R;x<=R;x++)acc+=f[y*W+Math.max(0,Math.min(W-1,x))];
for(let x=0;x<W;x++){tmp[y*W+x]=acc/(2*R+1);acc+=f[y*W+Math.min(W-1,x+R+1)]-f[y*W+Math.max(0,x-R)]}}
for(let x=0;x<W;x++){let acc=0;for(let y=-R;y<=R;y++)acc+=tmp[Math.max(0,Math.min(H-1,y))*W+x];
for(let y=0;y<H;y++){f[y*W+x]=acc/(2*R+1);acc+=tmp[Math.min(H-1,y+R+1)*W+x]-tmp[Math.max(0,y-R)*W+x]}}}
const src=[];feeders.forEach(fd=>fd.p.forEach(([x,y],ph)=>src.push({x,y,T:fd.load*1.5+(ph===1?2:0),r:16})));
src.push({x:HOT.x,y:HOT.y,T:HOT.T-29,r:9},{x:HOT.x,y:HOT.y+28,T:22,r:13},{x:HOT.x+4,y:HOT.y+62,T:10,r:12});
for(let y=0;y<H;y++)for(let x=0;x<W;x++){let add=0;for(const s of src){const d2=(x-s.x)**2+(y-s.y)**2;if(d2<9*s.r*s.r)add=Math.max(add,s.T*Math.exp(-d2/(2*s.r*s.r)))}
f[y*W+x]=28+f[y*W+x]*1.7+add+3*(1-y/H)+(Math.sin(x*12.9898+y*78.233)*43758.5453%1)*.25}
F=f;
th=document.createElement('canvas');th.width=W;th.height=H;const t2=th.getContext('2d'),img=t2.createImageData(W,H);
const pal=[[16,0,46],[75,10,138],[176,21,122],[232,83,42],[249,165,27],[255,247,201]];
const col=t=>{const q=Math.max(0,Math.min(1,(t-28)/54))*(pal.length-1),i=Math.floor(q),k=q-i,a=pal[i],b=pal[Math.min(pal.length-1,i+1)];return[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k]};
for(let k=0;k<W*H;k++){const c=col(f[k]);img.data[k*4]=c[0];img.data[k*4+1]=c[1];img.data[k*4+2]=c[2];img.data[k*4+3]=255}
t2.putImageData(img,0,0);t2.globalAlpha=.2;t2.globalCompositeOperation='luminosity';t2.drawImage(vis,0,0);t2.globalAlpha=1;t2.globalCompositeOperation='source-over';
draw()}
const LR=Math.round(W*.13);
let px=W*.3,py=H*.45,fullOn=false,found=false;
const fmt=t=>t.toFixed(1).replace('.',',')+' °C';
function draw(){if(!vis)return;ctx.drawImage(fullOn?th:vis,0,0);
if(!fullOn){ctx.save();ctx.beginPath();ctx.arc(px,py,LR,0,7);ctx.clip();ctx.drawImage(th,0,0);ctx.restore();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py,LR,0,7);ctx.stroke()}
ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px-10,py);ctx.lineTo(px+10,py);ctx.moveTo(px,py-10);ctx.lineTo(px,py+10);ctx.stroke();
const t=T(px,py);tOut.textContent=fmt(t);tOut.className=t>70?'alarm':'';
const r=cv.getBoundingClientRect(),sx=r.width/W;read.hidden=false;read.style.left=(px*sx)+'px';read.style.top=(py*sx)+'px';read.textContent=fmt(t);
if(t>70){found=true;const ref=Math.max(T(203,278),T(234,278));
msg.innerHTML='<span class="alarm">Point chaud : '+t.toFixed(0)+' °C sur le fusible de la phase L2, départ D7, contre '+ref.toFixed(0)+' °C sur les phases voisines. Contact ou serrage à reprendre.</span>'}
else if(!found)msg.textContent='Déplacez la caméra sur le coffret.'}
function move(e){const r=cv.getBoundingClientRect();px=Math.max(0,Math.min(W,(e.clientX-r.left)/r.width*W));py=Math.max(0,Math.min(H,(e.clientY-r.top)/r.height*H));draw()}
stage.addEventListener('pointermove',move);stage.addEventListener('pointerdown',move);
full.addEventListener('click',()=>{fullOn=!fullOn;full.setAttribute('aria-pressed',fullOn);draw()});
let manual=false;stage.addEventListener('pointerdown',()=>manual=true);stage.addEventListener('pointerenter',()=>{if(fine)manual=true});
if(!reduce){let a=0;setInterval(()=>{if(manual||!vis)return;a+=.05;px=W*.5+Math.cos(a)*W*.32;py=H*.5+Math.sin(a*1.3)*H*.3;draw()},60)}
addEventListener('resize',draw);
if(photo.complete)build();else photo.onload=build;
})();
/* ULTRASOUND: probe along a plate with a corroded zone; A-scan shows back-wall echoes */
(function(){
const svg=$('#utSvg'),pos=$('#utPos'),mat=$('#utMat'),sc=$('#utScope'),g=sc.getContext('2d'),eOut=$('#utE'),st=$('#utState'),vel=$('#utVel');
const top=40,nom=12,px_mm=8; // 12 mm drawn as 96 px
const thick=x=>{const c=650,w=70;return nom-4.6*Math.exp(-((x-c)**2)/(2*w*w))-1.1*Math.exp(-((x-860)**2)/(2*30*30))}; // mm at x in 0..1000
const X=x=>20+x*.56;
let path=`M${X(0)} ${top}`;for(let x=0;x<=1000;x+=10)path+=` L${X(x)} ${top}`;for(let x=1000;x>=0;x-=10)path+=` L${X(x)} ${top+thick(x)*px_mm}`;path+='Z';
svg.innerHTML=`<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#8a96a1" stroke-width="2"/></pattern></defs>
<rect x="20" y="${top-6}" width="560" height="6" fill="#1d5fa8"/><text x="22" y="24" font-family="IBM Plex Sans,sans-serif" font-size="12" fill="#4b5e71">Peinture</text>
<path d="${path}" fill="#c5d0da"/><path d="${path}" fill="url(#hatch)" opacity=".35"/>
<text x="580" y="${top+nom*px_mm+20}" text-anchor="end" font-family="IBM Plex Sans,sans-serif" font-size="12" fill="#4b5e71">Tôle acier · nominale 12 mm</text>
<g id="probe"><rect x="-16" y="${top-34}" width="32" height="26" rx="4" fill="#0d1a26"/><rect x="-10" y="${top-10}" width="20" height="5" fill="#f5a71b"/><line x1="0" y1="${top-34}" x2="0" y2="0" stroke="#0d1a26" stroke-width="3"/>
<line id="beam" x1="0" y1="${top}" x2="0" y2="${top+nom*px_mm}" stroke="#1d8a52" stroke-width="3" stroke-dasharray="4 4"/></g>`;
const probe=svg.querySelector('#probe'),beam=svg.querySelector('#beam');
let t0=0;
function upd(){const x=+pos.value,e=thick(x),v=+mat.value;probe.setAttribute('transform',`translate(${X(x)} 0)`);beam.setAttribute('y2',top+e*px_mm);
eOut.textContent=e.toFixed(1).replace('.',',')+' mm';const name=mat.options[mat.selectedIndex].text;vel.textContent=name+' · '+v.toLocaleString('fr-FR').replace(/ | /g,' ')+' m/s';
if(e<8.5){st.className='crit';st.textContent='Critique · perte de '+(nom-e).toFixed(1).replace('.',',')+' mm'}else if(e<10.5){st.className='warn';st.textContent='Corrosion · à surveiller'}else{st.className='ok';st.textContent='Conforme · nominale 12 mm'}
scope(e,v)}
function scope(e,v){const Wc=sc.width,Hc=sc.height;g.fillStyle='#04110a';g.fillRect(0,0,Wc,Hc);g.strokeStyle='#123a22';g.lineWidth=1;
for(let i=1;i<10;i++){g.beginPath();g.moveTo(i*Wc/10,0);g.lineTo(i*Wc/10,Hc);g.stroke()}for(let i=1;i<4;i++){g.beginPath();g.moveTo(0,i*Hc/4);g.lineTo(Wc,i*Hc/4);g.stroke()}
const tof=2*e/1000/v*1e6; // µs, round trip
const span=20; // µs shown
g.strokeStyle='#7dffb0';g.lineWidth=1.6;g.shadowColor='#7dffb0';g.shadowBlur=6;g.beginPath();
for(let i=0;i<=Wc;i++){const t=i/Wc*span;let y=0;const pk=(c,a,w)=>a*Math.exp(-((t-c)**2)/(2*w*w))*Math.cos((t-c)*18);
y+=pk(.4,1,.18);for(let k=1;k<=5;k++)y+=pk(.4+k*tof,.85*Math.pow(.6,k-1),.16);y+=(Math.random()-.5)*.04;
const Y=Hc*.78-y*Hc*.6;i?g.lineTo(i,Y):g.moveTo(i,Y)}
g.stroke();g.shadowBlur=0;g.fillStyle='#93a9bf';g.font='12px monospace';g.fillText('0 µs',4,Hc-6);g.fillText(span+' µs',Wc-44,Hc-6);
g.fillStyle='#f5a71b';g.fillText('écho de fond · '+tof.toFixed(2).replace('.',',')+' µs',Math.min(Wc-170,(.4+tof)/span*Wc+6),16)}
pos.addEventListener('input',upd);mat.addEventListener('change',upd);
let drag=false;const fromEvt=e=>{const r=svg.getBoundingClientRect();const x=((e.clientX-r.left)/r.width*600-20)/.56;pos.value=Math.max(0,Math.min(1000,x));upd()};
svg.addEventListener('pointerdown',e=>{drag=true;svg.setPointerCapture(e.pointerId);fromEvt(e)});svg.addEventListener('pointermove',e=>{if(drag)fromEvt(e)});svg.addEventListener('pointerup',()=>drag=false);
upd();if(!reduce)setInterval(()=>scope(thick(+pos.value),+mat.value),140);
})();
/* method: horizontal track driven by vertical scroll */
(function(){const sec=$('#methode'),tr=$('#track'),bar=$('#mbar');if(reduce)return;let raf=0;
function on(){if(innerWidth<=760){tr.style.transform='';return}const r=sec.getBoundingClientRect(),p=Math.min(1,Math.max(0,-r.top/(r.height-innerHeight)));
const max=tr.scrollWidth-innerWidth+40;tr.style.transform=`translateX(${-p*Math.max(0,max)}px)`;bar.style.width=(p*100)+'%'}
addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(on)},{passive:true});addEventListener('resize',on);on()})();
(function(){if(reduce||!('IntersectionObserver'in window))return;
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.remove('pre');io.unobserve(e.target)}}),{rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.rv').forEach(el=>{if(el.getBoundingClientRect().top>innerHeight){el.classList.add('pre');io.observe(el)}})})();
$('#demoForm').addEventListener('submit',e=>{e.preventDefault();const f=e.target;if(!f.nom.value.trim()){f.nom.focus();return}
const lines=[...f.querySelectorAll('input,select,textarea')].filter(x=>x.value.trim()).map(x=>{const l=x.closest('label');return (l?l.childNodes[0].textContent.trim():x.name)+' : '+x.value.trim()});
const txt='Bonjour KENJITECH,\n'+lines.join('\n');window.open('https://wa.me/237697787475?text='+encodeURIComponent(txt),'_blank','noopener');
const s=$('#sent');s.hidden=false;s.innerHTML='Merci. WhatsApp s\'ouvre avec votre demande déjà rédigée : il ne reste qu\'à l\'envoyer. Vous pouvez aussi écrire à <a href="mailto:contact@kenjitech.org?cc=kenjikarim@gmail.com&subject='+encodeURIComponent('Demande depuis le site')+'&body='+encodeURIComponent(txt)+'">contact@kenjitech.org</a>.'});
