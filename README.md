# Chat Choir

Chat Choir turns chat into a band: words become melodies, emotes become drums, and each participant gets a stable voice, color and position. This first milestone is the **offline core**. It contains no Twitch connection, dashboard, browser overlay, or chat sending yet. The audio is synthesized from scratch; there are no music assets, samples, or paid services.

## Run it

Requires Node 22 or newer and npm. From this directory:

```sh
npm install
npm test
npm start
npm run render -- samples/demo-session.json /tmp/demo.wav
```

`npm start` prints the offline renderer's usage until a server is built. The render command produces a 44.1 kHz, 16-bit stereo WAV and reports duration, peak and RMS. `samples/demo-session.json` is a hand-written **synthetic example**, not real Twitch chat. Timestamps are milliseconds from the beginning. Input is an array of chronological (or sortable) entries:

```json
[
  {"t": 0, "type": "chat", "id": "m1", "userId": "u1", "userName": "Ava", "text": "Hello chat!", "badges": ["subscriber"], "isFirstMessage": true},
  {"t": 1000, "type": "command", "userId": "host", "badges": ["broadcaster"], "text": "!key D minor"},
  {"t": 2000, "type": "delete", "messageId": "m1"}
]
```

A deletion may instead contain `userId`, which removes that user's phrases. Unique message IDs are recommended. Chat messages can also specify `color` and an `emotes` array of names (or objects with `name`). Ties in timestamps preserve input order. The command processor understands `!key D`, `!key F# minor`, `!scale dorian`, `!tempo 96`, `!mood hype`, and `!choir`. Broadcasters and moderators authorize changes immediately; everyone else needs three distinct votes for the same value within 60 seconds. Authorized settings take effect at the next bar.

## Musical rules

URLs and @mentions are removed; words become notes, with words of eight or more characters split into two. An estimated one, two, or three-plus syllables gives an eighth, quarter, or dotted quarter note. A comma inserts one sixteenth-step rest and a period or ellipsis inserts two. A phrase contains at most 16 notes and 32 steps. Identified emotes, plus Kappa, LUL, PogChamp, and <3, become deterministic drum hits on the nearest eighth-note grid. ALL-CAPS words receive a velocity accent.

The first word hashes to a scale degree; later word hashes choose mostly stepwise moves within a reflected range. Strong beats snap to the current bar's chord and weak beats to the scale. A normal ending resolves to a chord tone; a question rises to the second or fifth degree, and an exclamation jumps up an octave with an accent. At playback the transport re-quantizes notes to each bar's active key, scale and chord, including when a phrase loops. A first-time chatter adds a short bell arpeggio within the note budget.

Voices and pan are stable for a user ID. Moderators use bass, subscribers use pad with chord tones, broadcasters use lead, and VIPs use bell; other users select from discovered melodic plugins. A provided color is used as-is, otherwise a stable color is derived from the user ID. Badge priority is broadcaster, moderator, VIP, then subscriber. A phrase begins at the next bar, repeats four times by default at gains 1, 0.75, 0.5 and 0.3, and is subject to a user cooldown, a simultaneous-phrase cap, and a per-bar note budget. An eviction or deletion fades for 100 ms. Each phrase can span one or two bars, so one loop means one complete phrase, not necessarily one bar.

Scales: major, natural minor (`minor`), dorian, mixolydian, pentatonic major/minor, and blues. Mood progressions: chill I–vi–IV–V, hype I–V–vi–IV, spooky i–♭VI–iv–V, bright I–IV–V–IV. Spooky explicitly uses a major dominant. Pentatonic melodies use their corresponding major or minor seven-note harmony for triads.

## MIDI and lyric export

`src/music/midi.js` exports `exportMidi(transport)` as a format-1 Standard MIDI File byte array with a tempo/key track and a track per voice, and `exportLyricSheet(transport)` as attributed plain text. The offline session replay helper is `arrangeSession(session)`. These APIs are ready for the dashboard's eventual export button; no UI is included in this milestone. MIDI represents deletion with a shortened note rather than an audio fade and records the nearest MIDI major/minor key signature for other modes.

## Add an instrument with Codex

Ask Codex, for example: “Add a steel drum instrument to Chat Choir.” Create one ES module in `src/synth/instruments/` exporting `id`, `name`, `role` (`melodic`, `bass`, `pad`, or `percussion`), and `render(note, sampleRate)`. `render` must return a finite, non-silent `Float32Array`, peak at or below 1, decay to near silence, and return identical samples for identical inputs. `note` contains `midi`, `duration` in seconds, and optionally `drum`; use the seeded noise helper in `dsp.js` rather than `Math.random`. Keep the module browser-compatible: no Node-only imports or audio assets. The generated static registry discovers every `.js` file in that directory during `npm install`, `npm test`, `npm start`, and `npm run render`; commit the regenerated `registry.generated.js` with the plugin. The conformance test automatically exercises every discovered instrument. Run the full tests and listen to a render before committing.

See [architecture](docs/ARCHITECTURE.md) and [Codex conventions](AGENTS.md).
