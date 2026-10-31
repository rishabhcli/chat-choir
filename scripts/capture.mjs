import {chromium} from 'playwright';
import {readFile,readdir,mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {parseSessionFile,arrangeSession} from '../src/cli/render.js';
import {captureTime} from '../public/manual-clock.js';
import {createChoirServer} from '../src/server/index.js';
const args=process.argv.slice(2),input=args[0],out=args[1];
function option(name,fallback){const i=args.indexOf(name);if(i<0)return fallback;if(i+1>=args.length)throw Error(`Missing ${name} value`);return Number(args[i+1]);}
let app,browser,temp;try{
  if(!input||!out)throw Error('Usage: npm run capture -- <session.jsonl> <out-dir> [--fps 30] [--from ms] [--to ms]');
  const events=parseSessionFile(await readFile(input,'utf8')), {transport,firstTime,lastTime}=arrangeSession(events),endBar=transport.phrases.reduce((n,p)=>Math.max(n,p.startBar+p.phrase.bars*transport.config.loops),1),duration=Math.max(lastTime+1000,transport.ensureBar(endBar).start+1500)-firstTime;
  const fps=option('--fps',30),from=option('--from',0),to=option('--to',duration);if(!Number.isFinite(fps)||fps<=0||fps>120||!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<=from)throw Error('Invalid fps or time range');
  await mkdir(out,{recursive:true});if((await readdir(out)).some(name=>/^frame-\d+\.png$/.test(name)))throw Error('Output directory already contains captured frames; choose an empty directory.');temp=await mkdtemp(path.join(os.tmpdir(),'choir-capture-'));app=await createChoirServer({config:{port:0,replies:false,noTest:true,ignoreUsers:[],sessionDir:temp},mode:'replay',log:()=>{}});browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined});const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});await page.goto(`http://127.0.0.1:${app.server.address().port}/overlay?clock=manual`);await page.waitForFunction(()=>window.__choir?.loadSession);await page.evaluate(data=>window.__choir.loadSession(data),events);
  const count=Math.ceil((to-from)*fps/1000);for(let i=0;i<count;i++){const time=captureTime(firstTime,from,i,fps);await page.evaluate(t=>window.__choir.seek(t),time);await page.locator('canvas').screenshot({path:path.join(out,`frame-${String(i).padStart(6,'0')}.png`),omitBackground:true,animations:'disabled'});}if(errors.length)throw Error(`Overlay errors: ${errors.join('; ')}`);console.log(`Captured ${count} frames at ${fps} fps; timeline origin ${firstTime} ms; range ${from}–${to} ms.`);
}catch(error){console.error(error.message);process.exitCode=1;}finally{await browser?.close();await app?.close();if(temp)await rm(temp,{recursive:true,force:true});}
