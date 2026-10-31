import {ChoirClient} from './client.js';
import {ChoirAudio} from './audio.js';
import {ManualClock,effectsAt} from './manual-clock.js';
import {layoutNotes,placeWords} from './view-model.js';
import {chordName} from '/src/music/theory.js';
const query=new URLSearchParams(location.search),manual=query.get('clock')==='manual',position=query.get('position')||'bottom',scale=Math.max(.45,Math.min(1.5,Number(query.get('scale'))||1)),showLyrics=query.get('lyrics')!=='0';
if(query.get('bg')==='dark')document.body.classList.add('dark');
const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d'),client=manual?new ManualClock():new ChoirClient(),audio=manual?null:new ChoirAudio(client,{volume:Math.max(0,Math.min(1,Number(query.get('volume')??1)))}),button=document.querySelector('#sound');
if(manual)button.hidden=true;else{button.onclick=async()=>{button.hidden=await audio.enable();};audio.enable().then(ok=>button.hidden=ok).catch(()=>{});}
const debug=window.__choir={state:{},lastEvents:[],audioContextTime:0,audioState:'disabled',audioPeak:0,notesScheduled:0,sessionLoaded:!query.has('session')};
const round=(x,y,w,h,r=12)=>{ctx.beginPath();ctx.roundRect(x,y,Math.max(0,w),Math.max(0,h),r);};
function text(str,x,y,size=20,color='#eef4f3',weight='600',font='"Avenir Next", sans-serif'){ctx.font=`${weight} ${size}px ${font}`;ctx.fillStyle=color;ctx.fillText(str,x,y);}
function draw(){
  ctx.clearRect(0,0,1920,1080);if(!client.connected){text('CONNECTING TO CHAT CHOIR',70,1030,20,'#ffffffaa');return;}
  const now=client.now(),transport=client.session.transport,snapshot=transport.snapshot(now),bar=transport.barAt(now),barMs=240000/bar.bpm,beat=((now-bar.start)/(barMs/4))%1,lanes=snapshot.activePhrases.filter(p=>!p.userId.startsWith('celebration:')).slice(-6),laneH=position==='full'?82:70,feedHeight=Math.max(122,lanes.length*laneH),lastChat=client.events.filter(e=>e.type==='chat').at(-1),idle=!lanes.length&&(!lastChat||now-lastChat.t>20000),headerH=106,baseY=position==='top'?38:position==='full'?65:Math.max(0,1080-scale*(headerH+16+feedHeight+76)-36);
  ctx.save();ctx.translate(960*(1-scale),baseY);ctx.scale(scale,scale);const width=1780,left=70,top=0;
  // A deep scrim and a border keep the instrument legible over bright gameplay.
  round(left,top,width,headerH,18);ctx.fillStyle='#101720ef';ctx.fill();ctx.strokeStyle='#dce6df30';ctx.stroke();text('✳',left+22,top+42,29,'#ffd479','700');text('CHAT CHOIR',left+58,top+40,23,'#fff0cf','800');text('THE CHAT IS WRITING',left+59,top+70,13,'#a2b2b5','700');
  const contribution=[...new Set(client.events.filter(e=>e.type==='chat').map(e=>e.userName))].slice(-4).map(name=>String(name||'CHAT').slice(0,12)).join(' · ');text(`TRACK #01  /  ${contribution||'WAITING FOR THE FIRST VOICE'}`,left+276,top+27,14,'#bdcacc','700');
  for(let i=0;i<4;i++){const x=left+276+i*132,active=i===bar.index%4;round(x,top+40,120,45,9);ctx.fillStyle=active?'#ffd479':'#ffffff12';ctx.fill();text(chordName(bar.key,bar.scale,bar.mood,i),x+15,top+70,21,active?'#1b2023':'#d4e1df','800');if(active){ctx.beginPath();ctx.arc(x+101,top+62,3+3*(1-beat),0,Math.PI*2);ctx.fillStyle='#1b2023';ctx.fill();}}
  text(`${bar.key}   /   ${bar.scale.toUpperCase()}   /   ${bar.mood.toUpperCase()}   /   ${bar.bpm} BPM`,left+852,top+42,17,'#e7eeeb','700');text(`BAR ${String(bar.index+1).padStart(2,'0')}     ${lanes.length} VOICES${client.status.mode==='replay'?'     ● REPLAY':''}`,left+852,top+74,15,'#ffd479','700');
  const y=top+headerH+16;round(left,y,width,feedHeight+76,18);ctx.fillStyle='#101720eb';ctx.fill();ctx.strokeStyle='#dce6df30';ctx.stroke();const playhead=left+510,clipLeft=left+220,clipRight=left+width-15,pixelsPerMs=.25;
  for(let i=0;i<lanes.length;i++){const lane=lanes[i],ly=y+i*laneH+9;ctx.fillStyle=i%2?'#ffffff09':'#ffffff04';round(left+12,ly,width-24,laneH-3,7);ctx.fill();ctx.fillStyle=lane.color||'#ffd479';round(left+21,ly+10,5,laneH-23,3);ctx.fill();text(String(lane.userName).slice(0,18),left+39,ly+laneH/2+5,17,'#f3f7f3','700');}
  ctx.save();ctx.beginPath();ctx.rect(clipLeft,y+6,clipRight-clipLeft,feedHeight+2);ctx.clip();
  for(let i=-4;i<10;i++){if(idle)break;const x=playhead+i*(barMs/4)*pixelsPerMs;ctx.strokeStyle=i===0?'#ffd479':'#ffffff19';ctx.lineWidth=i===0?2:1;ctx.beginPath();ctx.moveTo(x,y+8);ctx.lineTo(x,y+feedHeight+4);ctx.stroke();}
  const events=transport.eventsBetween(Math.max(0,now-3500),now+7000),rects=layoutNotes(events,{now,playhead,pixelsPerMs,laneTop:y+9,laneHeight:laneH,lanes:lanes.map(l=>l.id)});
  for(const rect of rects){const lane=lanes.find(l=>l.id===rect.messageId);ctx.globalAlpha=Math.max(.38,rect.opacity);ctx.fillStyle=lane?.color||'#ffd479';round(rect.x,rect.y,rect.width,rect.height,7);ctx.fill();}ctx.globalAlpha=1;
  if(showLyrics)for(const lane of lanes){const laneRects=rects.filter(r=>r.messageId===lane.id);ctx.font='700 16px "Avenir Next", sans-serif';for(const word of placeWords(laneRects,lane.lyrics,w=>ctx.measureText(w).width,{left:clipLeft+5,right:clipRight-6})){ctx.lineWidth=5;ctx.lineJoin='round';ctx.strokeStyle='#101720';ctx.strokeText(word.word,word.x,word.y);ctx.fillStyle='#fff';ctx.fillText(word.word,word.x,word.y);}}
  ctx.restore();if(!idle){ctx.beginPath();ctx.moveTo(playhead-6,y+5);ctx.lineTo(playhead+6,y+5);ctx.lineTo(playhead,y+13);ctx.closePath();ctx.fillStyle='#ffd479';ctx.fill();}
  const drums=['kick','snare','closedHat','openHat','clap','tom'];for(let i=0;i<drums.length;i++){const hit=events.find(e=>e.kind==='drum'&&e.drum===drums[i]&&now-e.time>=0&&now-e.time<220),x=left+25+i*170,dy=y+feedHeight+19;round(x,dy,155,38,8);ctx.fillStyle=hit?'#ffd479':'#ffffff10';ctx.fill();text(hit?.emote||drums[i].replace('Hat',' HAT').toUpperCase(),x+12,dy+25,14,hit?'#171a1e':'#a7b9b9','700');}
  if(idle){text('THE STAGE IS YOURS',left+285,y+50,25,'#ffe3ad','800');text('Type in chat to join the choir',left+285,y+80,19,'#d4e2de','600');text('!key D    !scale dorian    !tempo 96    !mood hype',left+285,y+109,15,'#aabdbb','600');}
  const {pulses,bursts}=effectsAt(client.events,now);
  // Reserve the right-hand header area for alerts so they never cover lyrics.
  const alert=bursts.at(-1)||pulses.at(-1);
  if(alert){const isBurst=bursts.length>0,age=alert.age,cx=left+width-65,cy=top+54;ctx.globalAlpha=1-age*.7;ctx.fillStyle='#0b1018dd';round(left+width-325,top+20,300,65,12);ctx.fill();ctx.strokeStyle=alert.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,17+age*13,0,Math.PI*2);ctx.stroke();if(isBurst){for(let i=0;i<12;i++){const angle=i*Math.PI/6,r=20+age*16;ctx.save();ctx.translate(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r);ctx.rotate(angle);ctx.fillStyle=alert.color;if(alert.type==='shatter'){ctx.beginPath();ctx.moveTo(-5,-3);ctx.lineTo(6,0);ctx.lineTo(-4,3);ctx.closePath();ctx.fill();}else ctx.fillRect(-2,-2,4,4);ctx.restore();}}text(isBurst?alert.name:`${alert.name} JOINED`,left+width-308,top+60,17,alert.color,'800');}
  ctx.globalAlpha=1;ctx.restore();
  Object.assign(debug,{state:{...snapshot,connected:client.connected,mode:client.status.mode,time:now},lastEvents:client.events.slice(-20),audioContextTime:audio?.context?.currentTime??0,audioState:audio?.context?.state??'disabled',audioPeak:audio?.peak??0,notesScheduled:audio?.scheduled??0,effects:{pulses,bursts}});
}
if(manual){debug.seek=ms=>{client.seek(ms);draw();return debug.state;};debug.loadSession=events=>{client.loadSession(events);debug.sessionLoaded=true;draw();return debug.state;};draw();const sessionUrl=query.get('session');if(sessionUrl)fetch(sessionUrl).then(r=>{if(!r.ok)throw Error(`Session fetch failed (${r.status})`);return r.text();}).then(raw=>{const s=raw.trim();debug.loadSession(!s?[]:s.startsWith('[')?JSON.parse(s):s.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)));}).catch(error=>console.error(error));}
else {function frame(){draw();requestAnimationFrame(frame);}frame();}
