import { parseKey, normalizeScale, MOODS, chordName, chordTones, scaleTones, degreeToMidi, snapMidi } from './theory.js';
import { userPan } from './hash.js';
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
/** Explicit-time arrangement. Mutations must be supplied in chronological order. */
export class Transport {
  constructor({bpm=96,key='C',scale='major',mood='chill',loops=4,gains=[1,.75,.5,.3],maxPhrases=10,cooldownMs=2000,maxNotesPerBar=160} = {}) {
    this.config = {loops,gains,maxPhrases,cooldownMs,maxNotesPerBar};
    this.validate({bpm,key,scale,mood});
    this.bars = [{index:0,start:0,bpm,key:parseKey(key).name,scale:normalizeScale(scale),mood}];
    this.pending = new Map(); this.phrases = []; this.lastUser = new Map(); this.lastMutation = 0;
  }
  validate(p) { if (p.bpm !== undefined && (!Number.isFinite(p.bpm) || p.bpm < 60 || p.bpm > 160)) throw new RangeError('BPM must be 60–160'); if (p.key !== undefined) parseKey(p.key); if (p.scale !== undefined) normalizeScale(p.scale); if (p.mood !== undefined && !MOODS[p.mood]) throw new RangeError('Unknown mood'); }
  mutateTime(t) { if (!Number.isFinite(t) || t < this.lastMutation) throw new RangeError('Mutations require chronological timestamps'); this.lastMutation = t; }
  ensureTime(t) { while (true) { const bar = this.bars.at(-1), end = bar.start + 240000/bar.bpm; if (end > t) return; const index = bar.index+1; const next = {...bar,...(this.pending.get(index) || {}),index,start:end}; this.bars.push(next); } }
  ensureBar(index) { while (this.bars.length <= index) { const b = this.bars.at(-1); this.ensureTime(b.start+240000/b.bpm); } return this.bars[index]; }
  barAt(t) { this.ensureTime(Math.max(0,t)); let lo=0, hi=this.bars.length-1; while (lo<hi) { const mid=Math.ceil((lo+hi)/2); if (this.bars[mid].start<=t) lo=mid; else hi=mid-1; } return this.bars[lo]; }
  settings(patch,t=0) { this.validate(patch); this.mutateTime(t); const index=this.barAt(t).index+1; const normalized={...patch}; if (normalized.key) normalized.key=parseKey(normalized.key).name; if (normalized.scale) normalized.scale=normalizeScale(normalized.scale); if (this.bars.length > index) this.bars.splice(index); this.pending.set(index,{...this.pending.get(index),...normalized}); return index; }
  enqueue(phrase,t=0) {
    this.mutateTime(t); const bar = this.barAt(t); const previous = this.lastUser.get(phrase.userId);
    if (previous !== undefined && t-previous < this.config.cooldownMs) return {accepted:false,reason:'cooldown'};
    this.lastUser.set(phrase.userId,t); const startBar=bar.index+1;
    const active=this.phrases.filter(p => p.startBar <= startBar && p.startBar+p.phrase.bars*this.config.loops > startBar && (p.endAt === undefined || p.endAt > this.ensureBar(startBar).start));
    if (active.length >= this.config.maxPhrases) { active.sort((a,b)=>a.sequence-b.sequence); active[0].endAt=this.ensureBar(startBar).start; }
    this.phrases.push({phrase,startBar,sequence:this.phrases.length}); return {accepted:true,startBar};
  }
  remove(id,t=0) { this.mutateTime(t); let count=0; for (const p of this.phrases) if ((p.phrase.id === id || p.phrase.userId === id) && (p.endAt === undefined || p.endAt > t)) {p.endAt=t; count++;} return count; }
  eventsBetween(start,end) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end<start) throw new RangeError('Invalid event window');
    this.ensureTime(end); const events=[], firstBar=this.barAt(Math.max(0,start)).index;
    for (const p of this.phrases) {
      const ph=p.phrase; if(p.startBar+ph.bars*this.config.loops<=firstBar || (p.endAt!==undefined && p.endAt+100<=start))continue; const melodic = ph.notes.filter(n => n.voice === ph.voice); const lastMelody = melodic.reduce((best,n) => !best || n.step > best.step ? n : best, null);
      for (let loop=0;loop<this.config.loops;loop++) for (const item of [...ph.notes.map(n=>({...n,kind:'note',isLast:n===lastMelody})),...ph.drums.map(n=>({...n,kind:'drum'}))]) {
        const barIndex=p.startBar+loop*ph.bars+Math.floor(item.step/16), b=this.ensureBar(barIndex), stepMs=15000/b.bpm;
        const time=b.start+(item.step%16)*stepMs;
        // Return complete intersecting bars to make note-budget selection independent of query windows.
        if (b.start >= end || b.start+240000/b.bpm <= start || (p.endAt !== undefined && time >= p.endAt)) continue;
        let midi=item.midi;
        if (item.kind==='note') {
          const question=item.isLast && /\?\s*$/.test(ph.text);
          const pitches=question ? [degreeToMidi(1,b.key,b.scale)%12,degreeToMidi(4,b.key,b.scale)%12] : ((item.step%4===0 || item.isLast || item.voice==='pad') ? chordTones(b.key,b.scale,b.mood,barIndex) : scaleTones(b.key,b.scale));
          midi=snapMidi(midi,pitches);
        }
        let remaining=item.length ?? 2, offset=item.step%16, duration=0, durationBar=barIndex;
        while (remaining>0) { const current=this.ensureBar(durationBar), take=Math.min(remaining,16-offset); duration+=take*15000/current.bpm; remaining-=take; durationBar++; offset=0; }
        const gain=(this.config.gains[loop] ?? this.config.gains.at(-1) ?? 1)*(item.velocity ?? 1);
        events.push({time,kind:item.kind,instrument:item.kind==='drum'?'drums':item.voice,midi,drum:item.drum,emote:item.emote,gain,pan:userPan(ph.userId),duration, length:item.length ?? 2, userId:ph.userId,messageId:ph.id,bar:barIndex,step:item.step,loop,fadeAt:p.endAt,sequence:p.sequence});
      }
    }
    events.sort((a,b)=>a.time-b.time || a.sequence-b.sequence || a.step-b.step || (a.midi ?? 0)-(b.midi ?? 0));
    const counts=new Map(); return events.filter(e=> { const n=counts.get(e.bar)||0; counts.set(e.bar,n+1); return n<this.config.maxNotesPerBar && e.time>=start && e.time<end; });
  }
  snapshot(t) {
    const b=this.barAt(t), active=this.phrases.filter(p=>p.startBar<=b.index && p.startBar+p.phrase.bars*this.config.loops>b.index && (p.endAt===undefined || p.endAt+100>t));
    const sounding=this.eventsBetween(b.start,b.start+240000/b.bpm);
    return {bar:b.index, chord:chordName(b.key,b.scale,b.mood,b.index),settings:{bpm:b.bpm,key:b.key,scale:b.scale,mood:b.mood}, activePhrases:active.map(p=>({id:p.phrase.id,userId:p.phrase.userId,userName:p.phrase.userName,color:p.phrase.color,lyrics:p.phrase.lyrics,notes:sounding.filter(e=>e.messageId===p.phrase.id && e.kind==='note').map(e=>({step:e.step,length:e.length,midi:e.midi,velocity:e.gain,voice:e.instrument,time:e.time,duration:e.duration})),startBar:p.startBar,loop:Math.floor((b.index-p.startBar)/p.phrase.bars)}))};
  }
  getSettings(t=0) { const b=this.barAt(t); return {bpm:b.bpm,key:b.key,scale:b.scale,mood:b.mood}; }
  getNextBarSettings(t=0) { const b=this.ensureBar(this.barAt(t).index+1); return {bpm:b.bpm,key:b.key,scale:b.scale,mood:b.mood,startBar:b.index}; }
}
