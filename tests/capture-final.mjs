import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),review=resolve(root,'.impeccable/review'),out=resolve(root,'qa');await mkdir(review,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');const page=await browser.contexts()[0].newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('chrome://version');assert.match((await page.locator('#profile_path').textContent()).replaceAll('\\','/'),/^D:\/MCP\/chrome-real-profile\//i);
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:5188/?review=2');await page.waitForFunction(()=>window.__SHOP__?.garage?.ready&&window.__SHOP__.products.length===6);await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:resolve(review,'desktop.png'),fullPage:true});await page.screenshot({path:resolve(out,'desktop-hero.png')});
 let overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 await page.locator('[data-action="detail"][data-id="porsche"]').first().click();await page.waitForFunction(()=>document.querySelector('#detail-canvas')?.dataset.product==='porsche');await page.locator('#product-dialog').evaluate(async d=>{d.scrollTop=0;await Promise.all(d.getAnimations().map(a=>a.finished));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await page.screenshot({path:resolve(out,'product-detail.png')});await page.keyboard.press('Escape');await page.evaluate(()=>scrollTo(0,0));
 // Exercise latest render/animation without another checkout or cart mutation.
 await page.evaluate(()=>{const p=window.__SHOP__.products.find(p=>p.id==='supra');const target=document.querySelector('#cart-toggle').getBoundingClientRect();window.__SHOP__.animation.drive(p,{x:innerWidth*.6,y:innerHeight*.6},{x:target.x+target.width/2,y:target.y+target.height/2});});
 await page.waitForFunction(()=>window.__SHOP__.animation.history.at(-1)?.progress>.12&&window.__SHOP__.animation.history.at(-1)?.progress<.9);await page.screenshot({path:resolve(out,'car-to-cart.png')});await page.waitForFunction(()=>window.__SHOP__.animation.history.at(-1)?.completed);const motion=await page.evaluate(()=>window.__SHOP__.animation.history.at(-1));assert.equal(motion.id,'supra');assert.ok(motion.frames>=2);assert.equal(motion.completed,true);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(review,'mobile.png'),fullPage:true});await page.screenshot({path:resolve(out,'mobile-hero.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>scrollTo(0,0));await writeFile(resolve(out,'final-render-results.json'),JSON.stringify({passed:true,desktopWidth:1440,mobileWidth:390,catalogCount:6,overflow:false,motion,errors},null,2));console.log(JSON.stringify({passed:true,desktopWidth:1440,mobileWidth:390,catalogCount:6,overflow:false,animationProduct:motion.id,frames:motion.frames,errors}));
}catch(e){console.error(e);process.exitCode=1;}
// Disconnect this client only; preserve the shared authorized browser.
process.exit(process.exitCode||0);
