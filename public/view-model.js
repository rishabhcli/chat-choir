/** Pure presentation helpers shared by the overlay and unit tests. */
export function contrastColor(hex) {const m=/^#([0-9a-f]{6})$/i.exec(hex||'');if(!m)return '#ffffff';const n=parseInt(m[1],16),r=n>>16,g=n>>8&255,b=n&255;return .2126*r+.7152*g+.0722*b>155?'#11151a':'#ffffff';}
export function layoutNotes(events,{now,playhead=440,pixelsPerMs=.25,laneTop=0,laneHeight=70,lanes=[]}={}) {
  const indices=new Map(lanes.map((id,i)=>[id,i]));return events.filter(e=>e.kind==='note'&&indices.has(e.messageId)).map(e=>{const lane=indices.get(e.messageId),pitch=Math.max(0,Math.min(24,(e.midi??60)-48));return {...e,x:playhead+(e.time-now)*pixelsPerMs,y:laneTop+lane*laneHeight+laneHeight-26-pitch*(laneHeight-65)/24,width:Math.max(12,e.duration*pixelsPerMs),height:19,opacity:[1,.75,.5,.3][e.loop]??.3,flash:Math.max(0,1-(now-e.time)/220)*(now>=e.time?1:0)};});
}
/** Lay lyrics across all loops together, eliding a word when its slot is too short. */
export function placeWords(rectangles,lyrics,measure=word=>word.length*8,{left=-Infinity,right=Infinity}={}) {
  const candidates=[],seen=new Set();for(const note of rectangles){const lyric=lyrics.find(item=>item.step===note.step),key=`${note.loop}:${note.step}`;if(lyric&&!seen.has(key)){seen.add(key);candidates.push({word:lyric.word,x:note.x+3,note});}}
  candidates.sort((a,b)=>a.x-b.x);let occupied=left-6;const result=[];
  for(let i=0;i<candidates.length;i++){const item=candidates[i];if(item.x<left)continue;const x=Math.max(item.x,occupied+6,left),next=candidates[i+1]?.x??right,available=Math.min(right,next-6)-x;if(available<18)continue;let word=item.word,width=measure(word);if(width>available){const chars=Array.from(word);while(chars.length&&measure(`${chars.join('')}…`)>available)chars.pop();if(!chars.length)continue;word=`${chars.join('')}…`;width=measure(word);}result.push({word,x,y:item.note.y-5,width,loop:item.note.loop,step:item.note.step});occupied=x+width;}
  return result;
}

/** A measured ellipsis preserves complete names whenever they fit. */
export function fitText(value, maxWidth, measure) {
  const str=String(value??''); if(measure(str)<=maxWidth)return str;
  const chars=Array.from(str); while(chars.length && measure(chars.join('')+'…')>maxWidth)chars.pop();
  return chars.length ? chars.join('')+'…' : '';
}
/** Colours are assigned in first-appearance order, independently of phrase hashes. */
export function sessionColors(events) {
  const colors=new Map(); for(const e of events) {
    if(e.type!=='chat'||!e.userId)continue;
    const explicit=/^#[0-9a-f]{6}$/i.test(e.color||'');
    if(explicit)colors.set(e.userId,e.color);
    else if(!colors.has(e.userId))colors.set(e.userId,`hsl(${(24+colors.size*137.508)%360} 85% 70%)`);
  } return colors;
}
/** The newest settings announcement is derived entirely from the log and time. */
export function settingsBanner(events,now,initial={key:'C',scale:'major',mood:'chill',bpm:96}) {
  const state={...initial}; let latest=null;
  for(const e of events) { if(e.t>now)break; if(e.type!=='settings')continue;
    const changes=[]; for(const k of ['key','scale','mood','bpm']) if(e.patch?.[k]!==undefined) {
      if(String(state[k]).toLowerCase()!==String(e.patch[k]).toLowerCase())changes.push({label:k==='bpm'?'TEMPO':k.toUpperCase(),from:state[k],to:e.patch[k]});
      state[k]=e.patch[k];
    }
    if(changes.length)latest={changes,t:e.t};
  }
  if(!latest||now-latest.t>=2500)return null;
  const age=now-latest.t; return {...latest,age,opacity:Math.min(1,age/180,(2500-age)/250)};
}
/** Keep a user's Twitch hue while lifting very dark colours for the scrim. */
export function readableColor(color) {
  const match=/^#([0-9a-f]{6})$/i.exec(color||''); if(!match)return color;
  const value=parseInt(match[1],16),rgb=[value>>16,(value>>8)&255,value&255],brightness=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  if(brightness>=125)return color;
  const lift=(125-brightness)/(255-brightness);return '#'+rgb.map(v=>Math.round(v+(255-v)*lift).toString(16).padStart(2,'0')).join('');
}

/** Wrap the whole message, including unusually long unbroken words. */
export function wrapMessage(value,maxWidth,measure) {
  const lines=[]; let line='';
  for(const word of String(value||'').trim().split(/\s+/).filter(Boolean)) {
    let remaining=Array.from(word);
    const joined=line ? `${line} ${word}` : word;
    if(measure(joined)<=maxWidth){line=joined;continue;}
    if(line){lines.push(line);line='';}
    while(remaining.length && measure(remaining.join(''))>maxWidth){
      let part=''; while(remaining.length && (!part||measure(part+remaining[0])<=maxWidth))part+=remaining.shift();
      lines.push(part);
    }
    line=remaining.join('');
  }
  if(line)lines.push(line);return lines;
}
