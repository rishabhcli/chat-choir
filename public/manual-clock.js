import {ChoirSession} from '../src/music/session.js';
/** Rebuild from the prefix on every seek, so backward and repeated seeks agree. */
export class ManualClock {
  constructor(){this.all=[];this.time=0;this.session=new ChoirSession();this.events=[];this.connected=true;this.status={mode:'replay',speed:1};}
  loadSession(events){if(!Array.isArray(events))throw new TypeError('Session must be an array');this.all=events.map((event,index)=>{if(!Number.isFinite(event.t)||event.t<0)throw new RangeError('Invalid session timestamp');return {event,index};}).sort((a,b)=>a.event.t-b.event.t||a.index-b.index).map(x=>x.event);this.seek(0);}
  seek(ms){if(!Number.isFinite(ms)||ms<0)throw new RangeError('Seek time must be nonnegative');this.time=ms;this.session=new ChoirSession();this.events=[];for(const event of this.all){if(event.t>ms)break;this.session.apply(event);this.events.push(event);}return this.session;}
  now(){return this.time;}
}
/** Animation state depends only on recorded event timestamps and the requested time. */
export function effectsAt(events,now){const pulses=[],bursts=[];for(const e of events){const age=now-e.t;if(age<0)continue;if(e.type==='chat'&&age<2000)pulses.push({age:age/2000,name:e.userName||'CHAT',color:e.color||'#f6ca76'});if(['remove','delete','clear'].includes(e.type)&&age<2500)bursts.push({age:age/2500,type:'shatter',name:'MODERATION',color:'#ff7973'});if(e.type==='celebration'&&age<2500)bursts.push({age:age/2500,type:'burst',name:`${String(e.kind||'chat').toUpperCase()} · ${e.userName||'CHAT'}`,color:'#fbd779'});}return {pulses,bursts};}

/** Map a zero-based video frame to the original session's millisecond clock. */
export function captureTime(firstTime,from,frame,fps){return firstTime+from+frame*1000/fps;}
