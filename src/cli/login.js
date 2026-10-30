import {loadEnv,getConfig} from '../config.js';
import {TwitchAuth} from '../twitch/auth.js';
try {await loadEnv();const config=getConfig();const auth=new TwitchAuth(config);const user=await auth.login();console.log(`Authenticated as ${user.login}.`);}catch(error){console.error(error.message);process.exitCode=1;}
