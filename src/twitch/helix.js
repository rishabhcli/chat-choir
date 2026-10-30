const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class Helix {
  constructor({auth,clientId,apiBase='https://api.twitch.tv',fetchFn=fetch,wait=sleep,now=Date.now}) {Object.assign(this,{auth,clientId,apiBase,fetchFn,wait,now});}
  async request(route,{method='GET',body}={}) {
    let refreshed=false;
    for(let attempts=0;attempts<8;attempts++) {
      const token=await this.auth.accessToken(), response=await this.fetchFn(`${this.apiBase}${route}`,{method,headers:{Authorization:`Bearer ${token}`,'Client-Id':this.clientId,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
      if(response.status===401&&!refreshed){await this.auth.refresh();refreshed=true;continue;}
      if(response.status===429){const reset=Number(response.headers.get('Ratelimit-Reset'));const delay=Number.isFinite(reset)&&reset>0?Math.max(0,reset*1000-this.now()):1000;await this.wait(delay);continue;}
      const result=response.status===204?{}:await response.json().catch(()=>({}));if(!response.ok){const error=Error(`Twitch API ${route.split('?')[0]} returned ${response.status}`);error.status=response.status;throw error;}return result;
    }throw Error('Twitch API retry limit reached');
  }
  async getUsers({login}) {const q=new URLSearchParams({login});return (await this.request(`/helix/users?${q}`)).data||[];}
  async sendChatMessage(broadcasterId,senderId,text) {const result=await this.request('/helix/chat/messages',{method:'POST',body:{broadcaster_id:broadcasterId,sender_id:senderId,message:Array.from(text).slice(0,450).join('')}});const row=result.data?.[0]||{};return {isSent:!!row.is_sent,dropReason:row.drop_reason||null};}
  async createEventSubSubscription(type,version,condition,sessionId) {return this.request('/helix/eventsub/subscriptions',{method:'POST',body:{type,version,condition,transport:{method:'websocket',session_id:sessionId}}});}
}
