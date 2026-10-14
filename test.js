const B='http://localhost:3000',D='2026-10-21';let pass=0,fail=0;
const ok=(c,m)=>{console.log((c?'✅':'❌')+' '+m);c?pass++:fail++};
const slots=async s=>(await (await fetch(`${B}/api/slots?service=${s}&date=${D}`)).json());
const book=async(s,t)=>{const r=await fetch(B+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service:s,start:`${D}T${t}:00.000-04:00`,name:'Test '+s,phone:'514-555-0000',email:'t@ex.com'})});const j=await r.json();
 if(j.url){const id=new URL(j.url,B).searchParams.get('id');await fetch(B+'/api/demo-pay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});return (await (await fetch(B+'/api/bookings/'+id)).json()).status}return 'REFUSÉ: '+j.error};
(async()=>{if(!(await (await fetch(B+'/api/config')).json()).demo){console.log('Arrêt: le serveur doit tourner en mode démo (sans STRIPE_SECRET_KEY) pour les tests.');process.exit(1)}
 ok((await slots('coupe-homme')).length===20,'20 plages coupe 8h30-19h00 mercredi (sans dîner 12h-13h)');
 ok((await (await fetch(`${B}/api/slots?service=coupe-homme&date=2026-10-12`)).json()).length===0,'Lundi fermé');
 ok((await slots('coloration-meches')).at(-1).time==='15:30','Dernière plage mèches 15h30 (fin 19h30)');
 ok(await book('coupe-homme','08:30')==='confirmed','Coupe homme 8h30 réservée');
 ok((await book('coupe-enfant','08:30')).startsWith('REFUSÉ'),'Double réservation 8h30 bloquée (même agenda Homme)');
 ok(await book('coloration','10:00')==='confirmed','Coloration 10h00-12h00 réservée (pause 10h30)');
 const s=await slots('coupe-femme');ok(s.find(x=>x.time==='10:30')?.inGap===true,'Plage 10h30 offerte pour coupe pendant la pause');
 ok(!s.find(x=>['10:00','11:00','11:30'].includes(x.time)),'10h00/11h00/11h30 non offertes');
 ok(!(await slots('coupe-femme-plis')).find(x=>x.time==='10:30'),'Coupe+plis (60 min) refusée dans la pause');
 ok((await book('permanente','10:30')).startsWith('REFUSÉ'),'Permanente chevauchant pause refusée');
 ok(await book('coupe-enfant','10:30')==='confirmed','Coupe enfant réservée dans la pause 10h30');
 ok((await book('coupe-homme','10:30')).startsWith('REFUSÉ'),'Pause déjà prise: 2e coupe bloquée');
 ok(await book('coupe-femme','14:00')==='confirmed','Coupe femme 14h00 réservée');
 ok((await book('coloration-deco','13:30')).startsWith('REFUSÉ'),'Déco 13h30 refusée (14h00 occupée, pause à 14h30)');
 ok(await book('coloration-meches','13:00')==='confirmed','Mèches 13h00 réservée (sa pause 14h00 contient la coupe existante)');
 // --- Deux agendas indépendants (Homme / Femme) ---
 {const D3='2026-10-22',sl=async sv=>(await (await fetch(`${B}/api/slots?service=${sv}&date=${D3}`)).json()).map(x=>x.time);
  const bk=async(sv,t)=>{const r=await fetch(B+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service:sv,start:`${D3}T${t}:00.000-04:00`,name:'A',phone:'514-555-0000',email:'a@ex.com'})});const j=await r.json();if(!j.url)return 'REFUSÉ';const id=new URL(j.url,B).searchParams.get('id');await fetch(B+'/api/demo-pay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});return (await (await fetch(B+'/api/bookings/'+id)).json()).status};
  ok(await bk('coloration','13:00')==='confirmed','Agendas: coloration 13h00-15h00 réservée');
  const ch=await sl('coupe-homme');ok(['13:00','13:30','14:00','14:30'].every(t=>ch.includes(t)),'Agendas: coupes homme offertes 13h00-14h30 pendant la coloration');
  ok(await bk('coupe-homme','13:00')==='confirmed'&&await bk('coupe-homme','14:00')==='confirmed','Agendas: coupes homme 13h00 et 14h00 réservées');
  const cf=await sl('coupe-femme');ok(!cf.includes('13:00')&&cf.includes('13:30')&&!cf.includes('14:00'),'Agendas: coupe femme bloquée par la coloration (sauf sa pause 13h30)');
  ok(await bk('coupe-femme','14:00')==='REFUSÉ'&&await bk('piercing','13:00')==='REFUSÉ','Agendas: conflits dans le même agenda refusés');}
 // --- Pause dîner 12h-13h ---
 {const d2=async sv=>(await (await fetch(`${B}/api/slots?service=${sv}&date=2026-10-16`)).json()).map(x=>x.time);
  const ch=await d2('coupe-homme'),co=await d2('coloration');
  ok(!ch.includes('12:00')&&!ch.includes('12:30')&&ch.includes('11:30')&&ch.includes('13:00'),'Dîner: aucune coupe 12h00/12h30 (11h30 et 13h00 offertes)');
  ok(co.includes('10:30')&&co.includes('11:30')&&!co.includes('12:00')&&!co.includes('12:30')&&co.includes('13:00'),'Dîner: coloration peut empiéter sur 12h-13h mais pas commencer pendant');
  ok((await book('coupe-homme','12:00')).startsWith('REFUSÉ')&&(await book('piercing','12:30')).startsWith('REFUSÉ'),'Dîner: réservation directe 12h00/12h30 refusée');}
 const auth='Basic '+Buffer.from('jace:test123').toString('base64');
 ok((await fetch(B+'/api/admin/data')).status===401,'Admin sans mot de passe refusé');
 await fetch(B+'/api/admin/blocks',{method:'POST',headers:{'Content-Type':'application/json',Authorization:auth},body:JSON.stringify({date:D,from:'17:00',to:'18:00',reason:'Pause'})});
 ok(!(await slots('coupe-homme')).find(x=>['17:00','17:30'].includes(x.time)),'Plage bloquée par admin non disponible');
 {const pb=async(r,ag)=>(await (await fetch(B+'/api/admin/blocks',{method:'POST',headers:{'Content-Type':'application/json',Authorization:auth},body:JSON.stringify({date:'2026-10-23',from:'09:00',to:'10:00',reason:r,...(ag?{agenda:ag}:{})})})).json()).agenda;
  ok(await pb('Ch Dany')==='homme'&&await pb('Colo Julie')==='femme'&&await pb('Dentiste')===null&&await pb('X','femme')==='femme','Blocages: classement auto homme/femme/les deux + agenda explicite');
  const s23=async sv=>(await (await fetch(`${B}/api/slots?service=${sv}&date=2026-10-23`)).json()).map(x=>x.time);
  ok(!(await s23('coupe-homme')).includes('09:00')&&!(await s23('coupe-femme')).includes('09:00'),'Blocages: « les deux » bloque les deux agendas');
  const all=await (await fetch(B+'/api/admin/data',{headers:{Authorization:auth}})).json();
  for(const b of all.blocks.filter(b=>b.start_ms>Date.parse('2026-10-23')))await fetch(B+'/api/admin/blocks/'+b.id,{method:'DELETE',headers:{Authorization:auth}});}
 const a=await (await fetch(B+'/api/admin/data',{headers:{Authorization:auth}})).json();ok(a.bookings.length===8&&a.blocks.length===1,'Admin liste 8 RDV + 1 blocage');
 // --- Virement Interac ---
 ok((await fetch(B+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service:'coupe-homme',start:`${D}T18:00:00.000-04:00`,name:'X',phone:'514-555-1111',email:'i@ex.com',method:'interac'})})).status===400,'Nouvelle réservation Interac refusée');
 ok((await fetch(B+'/api/tips',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'X',tip:'custom',tipCustom:'5',method:'interac'})})).status===400,'Nouveau pourboire Interac refusé');
 const legacy=async(body)=>{const j=await (await fetch(B+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();const id=new URL(j.url,B).searchParams.get('id');await fetch(B+'/api/demo-legacy-interac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});return {url:'/confirmation.html?id='+id}};
 const ib=async(sv,t)=>legacy({service:sv,start:`${D}T${t}:00.000-04:00`,name:'Interac',phone:'514-555-1111',email:'i@ex.com'});
 const r1=await ib('coupe-homme','18:00');const iid=r1.url&&new URL(r1.url,B).searchParams.get('id');
 ok(r1.url?.startsWith('/confirmation.html'),'Ancienne réservation Interac: page de confirmation');
 let ibk=await (await fetch(B+'/api/bookings/'+iid)).json();
 ok(ibk.status==='interac'&&ibk.interacEmail==='jacesavard@gmail.com'&&ibk.ref?.length===8&&ibk.deposit===10,'Interac: en attente, courriel + n° de réservation + dépôt 10 $');
 ok(!(await slots('coupe-homme')).find(x=>x.time==='18:00'),'Interac: plage retenue pendant l\'attente');
 ok((await fetch(B+'/api/demo-pay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:iid})}),(await (await fetch(B+'/api/bookings/'+iid)).json()).status==='interac'),'Interac: non confirmé sans action admin');
 let ad=await (await fetch(B+'/api/admin/data',{headers:{Authorization:auth}})).json();
 ok(ad.interac.length===1&&ad.interac[0].id===iid,'Admin: virement en attente listé');
 ok((await fetch(B+'/api/admin/bookings/'+iid+'/confirm',{method:'POST'})).status===401,'Admin: confirmation sans mot de passe refusée');
 await fetch(B+'/api/admin/bookings/'+iid+'/confirm',{method:'POST',headers:{Authorization:auth}});
 ad=await (await fetch(B+'/api/admin/data',{headers:{Authorization:auth}})).json();
 ok((await (await fetch(B+'/api/bookings/'+iid)).json()).status==='confirmed'&&ad.interac.length===0&&ad.bookings.length===9,'Admin: « Confirmer paiement reçu » confirme le RDV');
 const r2=await ib('coupe-femme','18:30');const iid2=new URL(r2.url,B).searchParams.get('id');
 ok((await (await fetch(B+'/api/bookings/'+iid2)).json()).deposit===10,'Interac coupe femme: dépôt 10 $');
 await fetch(B+'/api/admin/bookings/'+iid2+'/cancel',{method:'POST',headers:{Authorization:auth}});
 ok((await slots('coupe-homme')).find(x=>x.time==='18:30'),'Admin: « Annuler » libère la plage');
 // --- Pourboire ---
 {const T=require('./lib/tips');
  ok(T.tipCents(25,'15')===375&&T.tipCents(25,'18')===450&&T.tipCents(25,'20')===500,'Pourboire: 15/18/20 % de 25 $ = 3,75/4,50/5,00 $');
  ok(T.tipCents(30,'18')===540&&T.tipCents(40,'15')===600,'Pourboire: 18 % de 30 $ = 5,40 $, 15 % de 40 $ = 6,00 $');
  ok(T.tipCents(25,'none')===0&&T.tipCents(25,'')===0&&T.tipCents(25,'12')===0,'Pourboire: aucun / pourcentage non permis = 0');
  ok(T.tipCents(0,'custom','5,50')===550&&T.tipCents(25,'custom','7')===700&&T.tipCents(25,'custom','-3')===0&&T.tipCents(25,'custom','abc')===0,'Pourboire perso: 5,50 → 550 ¢, négatif/invalide → 0');
  ok(T.tipCents(25,'custom','99999')===T.MAX_CENTS&&T.fmt(375)==='3,75 $','Pourboire perso plafonné à 500 $ + format 3,75 $');
  const rb=await legacy({service:'coupe-femme',start:`2026-10-16T09:00:00.000-04:00`,name:'Tip Test',phone:'514-555-2222',email:'p@ex.com',tip:'20'});
  const tb=await (await fetch(B+'/api/bookings/'+new URL(rb.url,B).searchParams.get('id'))).json();
  ok(tb.tipCents===600&&tb.totalCents===1600,'Réservation Interac + 20 %: pourboire 6 $, total à envoyer 16 $');
  const pr=await (await fetch(B+'/api/tip-ref/'+tb.ref)).json();ok(pr.service==='Coupe femme'&&pr.price===30,'Page pourboire ?ref= : service et prix préremplis');
  const t1=await (await fetch(B+'/api/tips',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:tb.ref,tip:'15',method:'card'})})).json();
  const t1d=await (await fetch(B+'/api/tips/'+new URL(t1.url,B).searchParams.get('merci'))).json();ok(t1d.amountCents===450&&t1d.status==='paid','Pourboire après RDV 15 % de 30 $ = 4,50 $ (démo payé)');
  const t2=await (await fetch(B+'/api/tips',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Ami',tip:'custom',tipCustom:'10'})})).json();
  const t2id=new URL(t2.url,B).searchParams.get('merci');await fetch(B+'/api/demo-legacy-interac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:t2id,kind:'tip'})});ok((await (await fetch(B+'/api/tips/'+t2id)).json()).interacEmail==='jacesavard@gmail.com','Pourboire Interac: instructions jacesavard@gmail.com');
  ok((await fetch(B+'/api/tips',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tip:'none'})})).status===400,'Pourboire vide refusé');
  let ad2=await (await fetch(B+'/api/admin/data',{headers:{Authorization:auth}})).json();
  ok(ad2.tips.length===3&&ad2.tipsTotalCents===450,'Admin: 3 pourboires listés, 4,50 $ reçus');
  await fetch(B+'/api/admin/tips/'+t2id+'/confirm',{method:'POST',headers:{Authorization:auth}});
  ad2=await (await fetch(B+'/api/admin/data',{headers:{Authorization:auth}})).json();ok(ad2.tipsTotalCents===1450,'Admin: pourboire Interac confirmé → 14,50 $');
  const q=await fetch(B+'/api/admin/qr-pourboire.png',{headers:{Authorization:auth}});ok(q.headers.get('content-type')==='image/png'&&(await fetch(B+'/api/admin/qr-pourboire.png')).status===401,'QR PNG admin (protégé)');
  ok((await fetch(B+'/pourboire')).status===200,'Page /pourboire publique');}
 // --- Taxes ---
 {const X=require('./lib/taxes');const a=X.compute(2500);
  ok(a.tps===125&&a.tvq===249&&a.total===2874,'Taxes: 25 $ → TPS 1,25, TVQ 2,49, total 28,74 $');
  const b2=X.compute(3000);ok(b2.tps===150&&b2.tvq===299&&b2.total===3449,'Taxes: 30 $ → TPS 1,50, TVQ 2,99, total 34,49 $');
  const c2=X.compute(4000);ok(c2.tps===200&&c2.tvq===399&&c2.total===4599,'Taxes: 40 $ → total 45,99 $');
  ok(X.balance(2500,1000)===1874&&X.balance(0,1000)===0,'Solde au salon 25 $ dépôt 10 $ = 18,74 $');
  const rb=await legacy({service:'coupe-homme',start:`2026-10-16T15:00:00.000-04:00`,name:'Tax Test',phone:'514-555-3333',email:'x@ex.com',tip:'15'});
  const tb=await (await fetch(B+'/api/bookings/'+new URL(rb.url,B).searchParams.get('id'))).json();
  ok(tb.tpsCents===125&&tb.tvqCents===249&&tb.totalTaxInclCents===2874&&tb.balanceCents===1874&&tb.tpsNo==='774132096 RT0001'&&tb.tvqNo==='4027999251 TQ0002','Réservation: taxes stockées, total 28,74, solde 18,74, numéros de taxes');
  ok(tb.tipCents===375&&tb.totalCents===1375,'Pourboire non taxé (15 % de 25 $ = 3,75) et dépôt inchangé (Interac 13,75 $)');
  const ad3=await (await fetch(B+'/api/admin/data',{headers:{Authorization:auth}})).json();ok(ad3.interac.some(x=>x.tps_cents===125&&x.tvq_cents===249&&x.totalTaxInclCents===2874),'Admin: taxes dans le détail des réservations');
  const pr=await (await fetch(B+'/api/tip-ref/'+tb.ref)).json();ok(pr.tps===125&&pr.total===2874,'Page pourboire: taxes du prix affiché');}
 // --- Connexion admin (cookie + Basic) ---
 {const lp=await fetch(B+'/admin');const h=await lp.text();ok(lp.status===200&&h.includes('name="password"'),'Admin: page de connexion sans auth');
  const bad=await fetch(B+'/admin/login',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'password=nope'});ok(!bad.headers.get('set-cookie')&&bad.headers.get('location').includes('erreur'),'Admin: mauvais mot de passe refusé');
  const lg=async p=>(await fetch(B+'/admin/login',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'password='+encodeURIComponent(p)})).headers.get('set-cookie');
  const ck=await lg('test123');ok(/HttpOnly/.test(ck)&&/Max-Age=15552000/.test(ck),'Admin: connexion pose un cookie HttpOnly 180 jours');
  ok(!!(await lg(' test123$ ')),'Admin: mot de passe accepté avec $ final et espaces');
  const c=ck.split(';')[0];ok((await fetch(B+'/api/admin/data',{headers:{Cookie:c}})).status===200&&(await (await fetch(B+'/admin',{headers:{Cookie:c}})).text()).includes('Déconnexion'),'Admin: cookie donne accès (page + API)');
  ok((await fetch(B+'/api/admin/data',{headers:{Cookie:c.slice(0,-2)+'xx'}})).status===401,'Admin: cookie falsifié refusé');
  ok((await fetch(B+'/api/admin/data',{headers:{Authorization:'Basic '+Buffer.from('x:test123$').toString('base64')}})).status===200,'Admin: Basic auth (routine) toujours OK, avec ou sans $');
  ok(/Max-Age=0/.test((await fetch(B+'/admin/logout',{redirect:'manual',headers:{Cookie:c}})).headers.get('set-cookie')),'Admin: déconnexion efface le cookie');}
 console.log(`\n${pass} réussis, ${fail} échoués`);})();
