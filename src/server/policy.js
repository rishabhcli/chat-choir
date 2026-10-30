/** Twitch intake policy; moderation and command decisions are made before logging. */
export class ChatPolicy {
  constructor({ignoreUsers=[],cooldownMs=4000,maxLength=500}={}) {this.ignored=new Set(ignoreUsers.map(x=>x.toLowerCase()));this.cooldownMs=cooldownMs;this.maxLength=maxLength;this.lastUser=new Map();}
  classify(event,t,mutedUsers=[]) {
    const login=String(event.userLogin||event.userName||'').toLowerCase();if(this.ignored.has(login)||mutedUsers.includes(event.userId)||mutedUsers.includes(login))return {kind:'skip'};
    const text=String(event.text||'').trim().slice(0,this.maxLength);if(!text)return {kind:'skip'};
    if(text.startsWith('!'))return /^!(key|scale|tempo|mood|choir)(?:\s|$)/i.test(text)?{kind:'command',event:{...event,text}}:{kind:'skip'};
    const previous=this.lastUser.get(event.userId);if(previous!==undefined&&t-previous<this.cooldownMs)return {kind:'skip'};
    this.lastUser.set(event.userId,t);return {kind:'chat',event:{...event,text}};
  }
}
