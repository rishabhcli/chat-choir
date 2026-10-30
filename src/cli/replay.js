import {readFile} from 'node:fs/promises';
import {loadEnv,getConfig} from '../config.js';
import {parseSessionFile} from './render.js';
import {createChoirServer} from '../server/index.js';
try {const args=process.argv.slice(2),file=args[0],index=args.indexOf('--speed'),speed=index===-1?1:Number(args[index+1]);if(!file)throw Error('Usage: npm run replay -- <session.json|session.jsonl> [--speed 1]');const entries=parseSessionFile(await readFile(file,'utf8')).sort((a,b)=>a.t-b.t);await loadEnv();const config=getConfig(process.env,{live:false}),app=await createChoirServer({config,mode:'replay',speed});app.replay(entries);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));}catch(e){console.error(e.message);process.exitCode=1;}
