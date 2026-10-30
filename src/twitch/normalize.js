/** Normalize documented EventSub notification payloads into transport-neutral events. */
export function normalizeNotification(type,event,{firstSeen=()=>false}={}) {
  if(type==='channel.chat.message')return {type:'chat',id:event.message_id,userId:event.chatter_user_id,userName:event.chatter_user_name,userLogin:event.chatter_user_login,color:event.color||'',badges:(event.badges||[]).map(b=>b.set_id),text:event.message?.text||'',emotes:(event.message?.fragments||[]).filter(f=>f.type==='emote').map(f=>f.text),isFirstMessage:firstSeen(event.chatter_user_id)};
  if(type==='channel.chat.message_delete')return {type:'delete',messageId:event.message_id};
  if(type==='channel.chat.clear_user_messages')return {type:'clear',userId:event.target_user_id};
  if(type==='channel.chat.clear')return {type:'clear'};
  if(type==='channel.follow')return {type:'celebration',kind:'follow',userName:event.user_name};
  if(type.startsWith('channel.hype_train.'))return {type:'celebration',kind:'hype',level:event.level,phase:type.split('.').at(-1)};
  if(type==='channel.chat.notification') {const n=event.notice_type||'';const kind=n.includes('resub')?'resub':n.includes('gift')?'gift':n.includes('raid')?'raid':n==='sub'?'sub':n==='announcement'?'announcement':null;if(kind)return {type:'celebration',kind,userName:event.chatter_user_name||event.raid?.user_name||'Community'};}
  return null;
}
