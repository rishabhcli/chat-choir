const PPQ=480;
const DRUM_MIDI={kick:36,snare:38,closedHat:42,openHat:46,clap:39,tom:45};
const KEY_SIGNATURE={C:0,'C#':7,D:2,'D#':-3,E:4,F:-1,'F#':6,G:1,'G#':-4,A:3,'A#':-2,B:5};
/** Standard MIDI variable length quantity, bounded by the four-byte SMF limit. */
export function variableLength(value) {
  if (!Number.isInteger(value) || value<0 || value>0x0fffffff) throw new RangeError('Invalid MIDI delta');
  const bytes=[value & 127]; while ((value=Math.floor(value/128))>0) bytes.unshift((value&127)|128); return bytes;
}
const u32 = n => [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
function track(events) {
  events.sort((a,b)=>a.tick-b.tick || a.order-b.order);
  const data=[]; let last=0;
  for (const event of events) { data.push(...variableLength(event.tick-last),...event.bytes); last=event.tick; }
  data.push(0,0xff,0x2f,0); return [...BufferText('MTrk'),...u32(data.length),...data];
}
function BufferText(text) { return [...new TextEncoder().encode(text)]; }
function metaText(type,text) {const bytes=BufferText(text);return [0xff,type,...variableLength(bytes.length),...bytes];}
/** Export a complete transport arrangement as format-1 SMF. */
export function exportMidi(transport,{endMs}={}) {
  const last=transport.phrases.reduce((n,p)=>Math.max(n,p.startBar+p.phrase.bars*transport.config.loops),1);
  const end= endMs ?? transport.ensureBar(last).start+1000;
  const events=transport.eventsBetween(0,end), conductor=[]; let prev='';
  for (const bar of transport.bars) {
    if(bar.start>end) break;
    const state=`${bar.bpm}:${bar.key}:${bar.scale}`, tick=bar.index*4*PPQ;
    if(state!==prev){const tempo=Math.round(60000000/bar.bpm); conductor.push({tick,order:0,bytes:[0xff,0x51,3,(tempo>>16)&255,(tempo>>8)&255,tempo&255]});const minor=bar.scale==='natural minor';let sf=KEY_SIGNATURE[bar.key];if(minor){const rel={C:-3,'C#':4,D:-1,'D#':6,E:1,F:-4,'F#':3,G:-2,'G#':5,A:0,'A#':-5,B:2};sf=rel[bar.key];}conductor.push({tick,order:1,bytes:[0xff,0x59,2,sf&255,minor?1:0]});prev=state;}
  }
  const groups=new Map();
  for(const e of events){const group=groups.get(e.instrument)||[];groups.set(e.instrument,group);group.push(e);}
  const tracks=[track(conductor)]; let voice=0;
  for(const [name,notes] of groups){const channel=name==='drums'?9:((voice++ >= 9)?voice:voice-1)%16; const rows=[{tick:0,order:0,bytes:metaText(3,name)}];
    for(const e of notes){const b=transport.bars[e.bar],tick=e.bar*4*PPQ+Math.round((e.time-b.start)*b.bpm*PPQ/60000),duration=Math.max(1,Math.round((e.fadeAt === undefined ? e.length : Math.min(e.length, Math.max(0,e.fadeAt+100-e.time)*b.bpm/15000))*PPQ/4)),pitch=e.kind==='drum'?DRUM_MIDI[e.drum] ?? 36:e.midi,velocity=Math.max(1,Math.min(127,Math.round(e.gain*127)));rows.push({tick,order:2,bytes:[0x90|channel,pitch,velocity]},{tick:tick+duration,order:1,bytes:[0x80|channel,pitch,0]});}
    tracks.push(track(rows));
  }
  return Uint8Array.from([...BufferText('MThd'),...u32(6),0,1,(tracks.length>>8)&255,tracks.length&255,(PPQ>>8)&255,PPQ&255,...tracks.flat()]);
}
/** A readable attribution list; bar numbers are one-based. */
export function exportLyricSheet(transport) {
  return transport.phrases.map(p=>`Bar ${p.startBar+1} — ${p.phrase.userName}: ${p.phrase.text}`).join('\n')+'\n';
}
