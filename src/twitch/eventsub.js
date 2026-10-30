import WebSocket from 'ws';
import {normalizeNotification} from './normalize.js';
export function subscriptions(broadcasterId,userId) {
  const chat={broadcaster_user_id:broadcasterId,user_id:userId}, broadcaster={broadcaster_user_id:broadcasterId};
  return [...['channel.chat.message','channel.chat.message_delete','channel.chat.clear_user_messages','channel.chat.clear','channel.chat.notification'].map(type=>({type,version:'1',condition:chat})),{type:'channel.follow',version:'2',condition:{...broadcaster,moderator_user_id:userId}},...['begin','progress','end'].map(x=>({type:`channel.hype_train.${x}`,version:'2',condition:broadcaster}))];
}
/** Manages fresh connections and Twitch's subscription-preserving reconnect handoff. */
export class EventSub {
  constructor({url,helix,broadcasterId,userId,onEvent=()=>{},onStatus=()=>{},firstSeen=()=>false,log=console.log,marginMs=3000,backoffBaseMs=1000,maxBackoffMs=30000}) {Object.assign(this,{url,helix,broadcasterId,userId,onEvent,onStatus,firstSeen,log,marginMs,backoffBaseMs,maxBackoffMs});this.sockets=new Set();this.seen=new Map();this.attempt=0;this.stopped=true;this.retry=null;this.active=null;}
  start(){this.stopped=false;this.connect(this.url,false);}
  connect(url,handoff) {
    if(this.stopped)return;const socket=new WebSocket(url);this.sockets.add(socket);let welcomed=false,connectedAt=0,timer;const arm=seconds=>{clearTimeout(timer);timer=setTimeout(()=>{this.log('EventSub keepalive timeout; reconnecting');socket.terminate();},seconds*1000+this.marginMs);};
    socket.on('message',async raw=>{let packet;try{packet=JSON.parse(raw.toString());}catch{return;}const meta=packet.metadata||{},payload=packet.payload||{};if(meta.message_id && this.seen.has(meta.message_id))return;if(meta.message_id){this.seen.set(meta.message_id,Date.now());if(this.seen.size>5000)this.seen.delete(this.seen.keys().next().value);}
      if(meta.message_type==='session_welcome') {welcomed=true;const old=this.active;this.active=socket;connectedAt=Date.now();socket.timeoutSeconds=payload.session.keepalive_timeout_seconds||10;arm(socket.timeoutSeconds);this.onStatus(true);this.log('EventSub connected');if(handoff && old && old!==socket)old.close();if(!handoff){for(const s of subscriptions(this.broadcasterId,this.userId)){if(this.stopped||socket.readyState!==WebSocket.OPEN)break;try{await this.helix.createEventSubSubscription(s.type,s.version,s.condition,payload.session.id);}catch(e){this.log(`EventSub subscription ${s.type} unavailable (${e.status||'error'}); continuing`);}}}return;}
      if(welcomed)arm(socket.timeoutSeconds);
      if(meta.message_type==='session_reconnect'){if(payload.session?.reconnect_url)this.connect(payload.session.reconnect_url,true);return;}
      if(meta.message_type==='revocation'){this.log(`EventSub revoked ${payload.subscription?.type||'subscription'} (${payload.subscription?.status||'unknown'})`);return;}
      if(meta.message_type==='notification'){const event=normalizeNotification(payload.subscription?.type,payload.event||{},{firstSeen:this.firstSeen});if(event)this.onEvent(event);}
    });
    socket.on('error',()=>{});socket.on('close',(code)=>{clearTimeout(timer);this.sockets.delete(socket);if(this.stopped)return;if(socket===this.active){this.active=null;this.onStatus(false);}else if(this.active)return;if(welcomed && Date.now()-connectedAt>=30000)this.attempt=0;const reason={4000:'server error',4001:'unexpected client traffic',4002:'ping timeout',4003:'no subscription accepted',4004:'reconnect grace expired',4005:'network timeout',4006:'network error',4007:'invalid reconnect URL'}[code]||'connection closed';this.log(`EventSub disconnected (${code}: ${reason}); reconnecting`);if(!this.retry){const delay=Math.min(this.maxBackoffMs,this.backoffBaseMs*2**this.attempt++);this.retry=setTimeout(()=>{this.retry=null;this.connect(this.url,false);},delay);}});
  }
  stop(){this.stopped=true;clearTimeout(this.retry);for(const s of this.sockets)s.close();this.sockets.clear();this.active=null;this.onStatus(false);}
}
