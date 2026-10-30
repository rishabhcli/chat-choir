import {ChoirSession} from '/src/music/session.js';
export class ChoirClient extends EventTarget {
  constructor(){super();this.session=new ChoirSession();this.events=[];this.status={};this.anchor=0;this.anchorLocal=Date.now();this.connected=false;this.connect();}
  now(){return this.anchor+(Date.now()-this.anchorLocal)*(this.status.speed||1);}
  connect(){const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);this.socket=ws;
    ws.onmessage=message=>{const data=JSON.parse(message.data);if(data.type==='hello'){this.session=new ChoirSession(data.initialSettings||{});this.events=data.events;for(const e of this.events)this.session.apply(e);this.status=data.status;this.anchor=data.now;this.anchorLocal=Date.now();this.connected=true;this.dispatchEvent(new CustomEvent('hello',{detail:data}));}else if(data.type==='event'){this.session.apply(data.event);this.events.push(data.event);if(data.event.t>this.now()){this.anchor=data.event.t;this.anchorLocal=Date.now();}this.dispatchEvent(new CustomEvent('event',{detail:data.event}));}else if(data.type==='status'){this.status=data.status;this.dispatchEvent(new Event('status'));}};
    ws.onclose=()=>{this.connected=false;this.dispatchEvent(new Event('status'));setTimeout(()=>this.connect(),1500);};
  }
}
export async function post(url,data){const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});if(!response.ok)throw Error(await response.text());return response.json();}
