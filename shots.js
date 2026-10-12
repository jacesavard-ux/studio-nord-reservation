const { chromium } = require('playwright');
(async () => {
  const B='http://localhost:3000';
  // RDV coloration jeudi 9h00 pour montrer la plage de pause (9h30)
  const r=await (await fetch(B+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service:'coloration',start:'2026-10-15T09:00:00.000-04:00',name:'Marie Tremblay',phone:'514-555-1111',email:'m@ex.com',note:'Racine'})})).json();
  await fetch(B+'/api/demo-pay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:new URL(r.url,B).searchParams.get('id')})});
  const br=await chromium.launch(); const p=await br.newPage({viewport:{width:430,height:900},deviceScaleFactor:2});
  await p.goto(B); await p.waitForSelector('.svc');
  await p.screenshot({path:'screenshots/1-page-reservation.png'});
  await p.click('.svc[data-id="coupe-femme"]'); await p.click('.day[data-d="2026-10-15"]'); await p.waitForSelector('.slot');
  await p.click('.slot:not(.gap) >> nth=2'); await p.locator('#step2').scrollIntoViewIfNeeded();
  await p.mouse.move(0,0); await p.waitForTimeout(400); await p.screenshot({path:'screenshots/2-choix-plage.png'});
  await p.click('.slot.gap');
  await p.fill('[name=name]','Julie Gagnon'); await p.fill('[name=phone]','514-555-2222'); await p.fill('[name=email]','julie@ex.com'); await p.fill('[name=note]','Juste les pointes');
  await p.locator('#sum').scrollIntoViewIfNeeded(); await p.screenshot({path:'screenshots/3-formulaire.png'});
  await p.click('#pay'); await p.waitForURL(/paiement-demo/); await p.waitForTimeout(400);
  await p.screenshot({path:'screenshots/4-paiement-demo.png'});
  await p.click('#pay'); await p.waitForURL(/confirmation/); await p.waitForSelector('text=confirmé');
  await p.screenshot({path:'screenshots/5-confirmation.png',fullPage:true});
  const c=await br.newContext({httpCredentials:{username:'jace',password:'test123'},viewport:{width:430,height:900},deviceScaleFactor:2});
  const a=await c.newPage(); await a.goto(B+'/admin'); await a.waitForTimeout(600); await a.screenshot({path:'screenshots/6-admin.png',fullPage:true});
  await br.close();
})();
