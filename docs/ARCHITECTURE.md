# Offline architecture

- `src/music/theory.js` defines pitch classes, scales, chords, and quantization; `hash.js` supplies stable identities.
- `phrase.js` maps messages to bounded lyric-aligned melodies and emote percussion. `commands.js` validates roles and timestamped votes.
- `transport.js` is the explicit-time arrangement and overlay snapshot source. It queues changes and phrases at bar boundaries, tracks loop gains, caps and fades, and emits absolute-time events. Mutations must arrive in chronological timestamp order; event windows are half-open `[start, end)` and querying them does not advance a clock.
- `src/synth/dsp.js` and `instruments/` are pure sample-buffer DSP shared by Node and a future browser mixer. `scripts/generate-registry.js` discovers files and produces static browser-compatible imports. `mixer.js` pans, sums, optionally adds reverb, and soft-limits stereo buffers.
- `src/cli/render.js` replays session entries through those same modules and writes PCM WAV. `src/music/midi.js` exports format-1 MIDI and an attributed lyric sheet.

No timers, system clock, network access, random-number source, copyrighted audio or external synth participates in a render. Hashes and pseudo-noise are seeded from input. The same input, settings, implementation and sample rate produce identical floating-point buffers on the same runtime; floating-point and transcendental implementations can vary across JS engines or hardware. Session entries are sorted by timestamp with stable input ordering. Explicit bar timing supports tempo changes, and notes crossing a change use the timing of each bar. User IDs determine voice, pan and default color; adding or removing melodic plugins can change voice assignments. `npm test` verifies plugin conformance, arrangement, export and a full synthetic-session render.

The current core has no server, Twitch API, audio scheduling UI, overlay, persistence, or built-in export button. Future browser playback should schedule the same rendered sample buffers through a small mixer and limiter; it must not add a separate synthesizer.
