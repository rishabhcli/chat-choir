/** Pure presentation helpers shared by the overlay and unit tests. */
export function contrastColor(hex) {const m=/^#([0-9a-f]{6})$/i.exec(hex||'');if(!m)return '#ffffff';const n=parseInt(m[1],16),r=n>>16,g=n>>8&255,b=n&255;return .2126*r+.7152*g+.0722*b>155?'#11151a':'#ffffff';}
export function layoutNotes(events,{now,playhead=440,pixelsPerMs=.25,laneTop=0,laneHeight=70,lanes=[]}={}) {
  const indices=new Map(lanes.map((id,i)=>[id,i]));return events.filter(e=>e.kind==='note'&&indices.has(e.messageId)).map(e=>{const lane=indices.get(e.messageId),pitch=Math.max(0,Math.min(18,(e.midi??60)-48));return {...e,x:playhead+(e.time-now)*pixelsPerMs,y:laneTop+lane*laneHeight+laneHeight-17-pitch*(laneHeight-50)/18,width:Math.max(10,e.duration*pixelsPerMs),height:14,opacity:[1,.75,.5,.3][e.loop]??.3};});
}
/** Lay lyrics across all loops together, eliding a word when its slot is too short. */
export function placeWords(rectangles,lyrics,measure=word=>word.length*8,{left=-Infinity,right=Infinity}={}) {
  const candidates=[],seen=new Set();for(const note of rectangles){const lyric=lyrics.find(item=>item.step===note.step),key=`${note.loop}:${note.step}`;if(lyric&&!seen.has(key)){seen.add(key);candidates.push({word:lyric.word,x:note.x+3,note});}}
  candidates.sort((a,b)=>a.x-b.x);let occupied=left-6;const result=[];
  for(let i=0;i<candidates.length;i++){const item=candidates[i];if(item.x<left)continue;const x=Math.max(item.x,occupied+6,left),next=candidates[i+1]?.x??right,available=Math.min(right,next-6)-x;if(available<18)continue;let word=item.word,width=measure(word);if(width>available){const chars=Array.from(word);while(chars.length&&measure(`${chars.join('')}…`)>available)chars.pop();if(!chars.length)continue;word=`${chars.join('')}…`;width=measure(word);}result.push({word,x,y:item.note.y-5,width,loop:item.note.loop,step:item.note.step});occupied=x+width;}
  return result;
}
