import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),browser=await chromium.connectOverCDP('http://127.0.0.1:9222');const context=await browser.newContext();const page=await context.newPage();const views=[],checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const selectors=['#product-dialog','#detail-name','#detail-canvas','.detail-price','#product-dialog .dialog-close','#product-dialog [data-action="add"]'];
const bounds=()=>page.evaluate(selectors=>{const d=document.querySelector('#product-dialog').getBoundingClientRect();return {scrollY,viewport:{width:innerWidth,height:innerHeight},elements:Object.fromEntries(selectors.map(s=>{const el=document.querySelector(s),b=el.getBoundingClientRect();return[s,{x:b.x,y:b.y,width:b.width,height:b.height,position:getComputedStyle(el).position,visible:b.width>0&&b.height>0&&b.bottom>Math.max(0,d.top)&&b.top<Math.min(innerHeight,d.bottom)&&b.right>Math.max(0,d.left)&&b.left<Math.min(innerWidth,d.right),fullyVisible:b.width>0&&b.height>0&&b.y>=Math.max(0,d.y)-1&&b.bottom<=Math.min(innerHeight,d.bottom)+1&&b.x>=Math.max(0,d.x)-1&&b.right<=Math.min(innerWidth,d.right)+1}];}))};},selectors);
const settle=()=>page.locator('#product-dialog').evaluate(async d=>{await Promise.all(d.getAnimations().map(a=>a.finished));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
try{
 await page.goto('chrome://version');assert.match((await page.locator('#profile_path').textContent()).replaceAll(String.fromCharCode(92),'/'),/^D:\/MCP\/chrome-real-profile\//i);checks.push('authorized Chrome and isolated QA context');
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:5188/?inspection=final');await page.waitForFunction(()=>window.__SHOP__?.garage?.ready);await page.locator('[data-action="detail"][data-id="porsche"]').first().click();await page.waitForFunction(()=>document.querySelector('#detail-canvas')?.dataset.product==='porsche');await page.evaluate(()=>document.fonts.ready);await page.locator('#product-dialog').evaluate(d=>d.scrollTop=0);await settle();
  const state=await bounds();for(const [selector,box] of Object.entries(state.elements))assert.equal(box.fullyVisible,true,`${viewport.width}px ${selector} is fully inside settled modal and viewport`);assert.equal(state.elements['#product-dialog'].position,'fixed');checks.push(`${viewport.width}px: dialog, title, car, price, close and add fully visible`);
  await page.screenshot({path:resolve(root,viewport.width===1440?'qa/product-detail.png':'qa/product-detail-mobile.png')});views.push(state);
  await page.locator('#product-dialog').evaluate(d=>d.scrollTop=120);await settle();const scrolled=await bounds();assert.ok(scrolled.elements['#product-dialog .dialog-close'].fullyVisible);assert.ok(scrolled.elements['#product-dialog [data-action="add"]'].fullyVisible);
  for(const selector of ['#product-dialog .dialog-close','#product-dialog [data-action="add"]'])assert.equal(await page.locator(selector).evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),true,`visible ${selector} can actually receive a pointer`);
  checks.push(`${viewport.width}px: sticky close and purchase action remain visible/hittable after modal scroll`);
  if(viewport.width===390)await page.screenshot({path:resolve(root,'qa/product-detail-mobile-purchase.png')});
  await page.locator('#product-dialog .dialog-close').click();assert.equal(await page.locator('#product-dialog').getAttribute('open'),null);assert.equal(await page.evaluate(()=>document.body.classList.contains('dialog-open')),false);checks.push(`${viewport.width}px: actual close control dismisses modal and unlocks body`);
 }
 assert.deepEqual(errors,[]);const report={passed:true,count:checks.length,checks,views,errors};await writeFile(resolve(root,'qa/inspection-bounds.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,count:checks.length,checks,errors}));
}catch(e){console.error(e);process.exitCode=1;}
await context.close();process.exit(process.exitCode||0);
