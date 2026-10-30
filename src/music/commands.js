import { parseKey, normalizeScale, MOODS } from './theory.js';
const HELP = 'Chat Choir: !key C [major|minor], !scale dorian, !tempo 96, !mood hype, !choir';
/** Stateful vote accumulator; caller supplies monotonic timestamps in milliseconds. */
export class CommandProcessor {
  constructor({votesRequired = 3, voteWindowMs = 60000} = {}) { this.votesRequired = votesRequired; this.voteWindowMs = voteWindowMs; this.votes = new Map(); }
  process({text, userId, badges = [], t = 0}) {
    const match = /^\s*!(key|scale|tempo|mood|choir)(?:\s+(.*?))?\s*$/i.exec(text || '');
    if (!match) return {type:'ignored'};
    const command = match[1].toLowerCase(), arg = (match[2] || '').trim();
    if (command === 'choir') return {type:'help', reply:HELP};
    let patch;
    try {
      if (command === 'key') { const key = parseKey(arg); patch = {key:key.name, ...(key.scale ? {scale:key.scale} : {})}; }
      if (command === 'scale') patch = {scale:normalizeScale(arg)};
      if (command === 'tempo') { const bpm = Number(arg); if (!/^\d+$/.test(arg) || bpm < 60 || bpm > 160) throw Error(); patch = {bpm}; }
      if (command === 'mood') { const mood = arg.toLowerCase(); if (!Object.hasOwn(MOODS,mood)) throw Error(); patch = {mood}; }
    } catch { return {type:'error', reply:`Invalid ${command}. ${HELP}`}; }
    const roles = Array.isArray(badges) ? badges.map(x => typeof x === 'string' ? x.toLowerCase() : String(x.name ?? x.id ?? '').toLowerCase()) : Object.keys(badges).map(x => x.toLowerCase());
    if (roles.includes('broadcaster') || roles.includes('moderator')) return {type:'apply', patch, reply:`${command} change queued for the next bar.`};
    const voteKey = JSON.stringify(patch), votes = this.votes.get(voteKey) || new Map();
    for (const [id,time] of votes) if (t-time > this.voteWindowMs || time > t) votes.delete(id);
    votes.set(String(userId),t); this.votes.set(voteKey,votes);
    if (votes.size >= this.votesRequired) { this.votes.delete(voteKey); return {type:'apply',patch,reply:`Vote passed: ${command} change queued for the next bar.`}; }
    return {type:'vote',patch,count:votes.size,required:this.votesRequired,reply:`${votes.size}/${this.votesRequired} votes for ${command}.`};
  }
}
export { HELP };
