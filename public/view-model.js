/** Pure presentation helpers shared by the overlay and unit tests. */
export function contrastColor(hex) {const m=/^#([0-9a-f]{6})$/i.exec(hex||'');if(!m)return '#ffffff';const n=parseInt(m[1],16),r=n>>16,g=n>>8&255,b=n&255;return .2126*r+.7152*g+.0722*b>155?'#11151a':'#ffffff';}
export function layoutNotes(events,{now,playhead=440,pixelsPerMs=.16,laneTop=0,laneHeight=70,lanes=[]}={}) {
  const indices=new Map(lanes.map((id,i)=>[id,i]));return events.filter(e=>e.kind==='note'&&indices.has(e.messageId)).map(e=>{const lane=indices.get(e.messageId),pitch=Math.max(0,Math.min(18,(e.midi??60)-48));return {...e,x:playhead+(e.time-now)*pixelsPerMs,y:laneTop+lane*laneHeight+laneHeight-15-pitch*(laneHeight-20)/18,width:Math.max(10,e.duration*pixelsPerMs),height:12,opacity:[1,.75,.5,.3][e.loop]??.3};});
}
export function placeWords(rectangles,lyrics,measure=word=>word.length*8) {
  let right=-Infinity;const placed=[];for(const lyric of lyrics){const note=rectangles.find(r=>r.step===lyric.step);if(!note)continue;const x=Math.max(note.x+4,right+8),width=measure(lyric.word);if(x>note.x+note.width+45)continue;placed.push({word:lyric.word,x,y:note.y+10,width});right=x+width;}return placed;
}
