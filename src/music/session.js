import { Transport } from './transport.js';
import { textToPhrase } from './phrase.js';
import { CommandProcessor } from './commands.js';
import { chordTones } from './theory.js';
/** Shared log reducer. Events have explicit session timestamps and arrive in order. */
export class ChoirSession {
  constructor(options={}) { this.transport=new Transport({cooldownMs:0,allowInitialDownbeat:true,...options}); this.commands=new CommandProcessor(options); this.volume=options.volume ?? .8; this.replies=options.replies ?? true; this.mutedUsers=[]; }
  apply(event) {
    const t=event.t;
    if(event.type==='chat') return this.transport.enqueue(textToPhrase(event,this.transport.getNextBarSettings(t)),t);
    if(event.type==='settings') { const patch=event.patch || {}; const music={}; for(const k of ['bpm','key','scale','mood']) if(patch[k]!==undefined) music[k]=patch[k]; if(Object.keys(music).length) this.transport.settings(music,t); if(patch.volume!==undefined)this.volume=patch.volume; if(patch.replies!==undefined)this.replies=patch.replies; if(patch.mutedUsers!==undefined)this.mutedUsers=patch.mutedUsers; return; }
    if(event.type==='remove' || event.type==='delete') { const id=event.messageId ?? event.userId; if(id!==undefined)return this.transport.remove(id,t); for(const p of this.transport.phrases)this.transport.remove(p.phrase.id,t); return; }
    if(event.type==='clear') { if(event.userId)return this.transport.remove(event.userId,t); for(const p of this.transport.phrases)this.transport.remove(p.phrase.id,t); return; }
    if(event.type==='command') { const result=this.commands.process(event); if(result.type==='apply')this.transport.settings(result.patch,t); return result; }
    if(event.type==='celebration') { const settings=this.transport.getNextBarSettings(t), tones=chordTones(settings.key,settings.scale,settings.mood,settings.startBar); const phrase={id:event.id||`celebration:${t}:${event.kind}`,userId:`celebration:${t}`,userName:event.userName||'Community',text:event.kind,color:'#ffd27a',voice:'bell',notes:tones.map((pitch,i)=>({step:i*2,length:3,midi:60+pitch,velocity:.65,voice:'bell'})),drums:[],bars:1,lyrics:[]};return this.transport.enqueue(phrase,t); }
    throw new Error(`Unknown session entry type: ${event.type}`);
  }
}
