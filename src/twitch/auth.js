import { mkdir,readFile,writeFile,rename,chmod } from 'node:fs/promises';
import path from 'node:path';
export const SCOPES=['user:read:chat','user:write:chat','moderator:read:followers','channel:read:hype_train'];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
/** Public-device tokens rotate on refresh. A single in-flight refresh is shared. */
export class TwitchAuth {
  constructor({clientId,idBase='https://id.twitch.tv',tokenFile='.data/tokens.json',fetchFn=fetch,wait=sleep,now=Date.now,log=console.log}) {Object.assign(this,{clientId,idBase,tokenFile,fetchFn,wait,now,log});this.tokens=null;this.refreshing=null;}
  async post(route,params) {const response=await this.fetchFn(`${this.idBase}${route}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});const data=await response.json();return {response,data};}
  async save(tokens) {this.tokens={...tokens,expiresAt:this.now()+Number(tokens.expires_in||0)*1000};await mkdir(path.dirname(this.tokenFile),{recursive:true,mode:0o700});const tmp=`${this.tokenFile}.${process.pid}.tmp`;await writeFile(tmp,JSON.stringify(this.tokens),{mode:0o600});await chmod(tmp,0o600);await rename(tmp,this.tokenFile);}
  async load() {if(this.tokens)return this.tokens;try {this.tokens=JSON.parse(await readFile(this.tokenFile,'utf8'));return this.tokens;}catch(e){if(e.code==='ENOENT')throw Error('No saved Twitch login. Run npm run login.');throw e;}}
  async login() {
    const scope=SCOPES.join(' '), start=await this.post('/oauth2/device',{client_id:this.clientId,scopes:scope});if(!start.response.ok)throw Error(`Device authorization failed (${start.response.status})`);
    const d=start.data;this.log(`Open ${d.verification_uri} and enter code ${d.user_code}`);let interval=Number(d.interval)||5,expires=this.now()+Number(d.expires_in||1800)*1000;
    while(this.now()<expires) {await this.wait(interval*1000);const result=await this.post('/oauth2/token',{client_id:this.clientId,scopes:scope,device_code:d.device_code,grant_type:'urn:ietf:params:oauth:grant-type:device_code'});if(result.response.ok){await this.save(result.data);return this.validate();}const error=result.data.error || result.data.message;if(error==='authorization_pending')continue;if(error==='slow_down'){interval+=5;continue;}throw Error(`Device authorization failed (${result.response.status})`);}
    throw Error('Device authorization expired; run npm run login again.');
  }
  async refresh() {if(this.refreshing)return this.refreshing;this.refreshing=(async()=>{const old=await this.load();const result=await this.post('/oauth2/token',{grant_type:'refresh_token',refresh_token:old.refresh_token,client_id:this.clientId});if(!result.response.ok)throw Error(`Twitch token refresh failed (${result.response.status}); run npm run login.`);await this.save({...old,...result.data});return this.tokens.access_token;})();try{return await this.refreshing;}finally{this.refreshing=null;}}
  async accessToken() {const token=await this.load();return token.expiresAt && token.expiresAt-this.now()<60000 ? this.refresh() : token.access_token;}
  async validate() {let token=await this.accessToken();let response=await this.fetchFn(`${this.idBase}/oauth2/validate`,{headers:{Authorization:`OAuth ${token}`}});if(response.status===401){token=await this.refresh();response=await this.fetchFn(`${this.idBase}/oauth2/validate`,{headers:{Authorization:`OAuth ${token}`}});}if(!response.ok)throw Error(`Twitch token validation failed (${response.status})`);const user=await response.json();if(user.client_id && user.client_id!==this.clientId)throw Error('Saved Twitch login belongs to a different client ID.');return {userId:user.user_id,login:user.login,scopes:user.scopes||[]};}
}
