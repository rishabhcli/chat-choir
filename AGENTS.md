# Chat Choir project conventions

This project is an offline-first Twitch chat-to-music instrument. Turn 1 is the offline core; do not add Twitch integration unless the user asks. Use ES modules, plain JavaScript with JSDoc where useful, Node built-ins, and the built-in `node --test` runner. Avoid frameworks, bundlers, paid APIs, copyrighted audio, and sample assets. Keep runtime dependencies minimal.

Commands: `npm install`, `npm test`, `npm start`, and `npm run render -- samples/demo-session.json /tmp/demo.wav`. If Node is not on PATH, prefix commands with `PATH=/opt/homebrew/bin:$PATH`.

Architecture: `src/music/theory.js` handles scales and chords; `phrase.js` turns messages into notes; `transport.js` schedules explicit-time events; `commands.js` handles permissions and votes; `midi.js` exports MIDI and lyrics. `src/synth/dsp.js`, `instruments/`, `registry.js`, and `mixer.js` implement the single shared browser/Node synth. `src/cli/render.js` replays a session and writes WAV. See `docs/ARCHITECTURE.md` for guarantees and boundaries.

All musical decisions and audio synthesis must be pure and deterministic for identical inputs. Never use `Math.random`, timers, wall-clock time, network data, or audio assets to decide notes or samples. Pass timestamps explicitly and use the seeded DSP noise helper. Keep browser-shared modules free of Node-only imports.

Instrument recipe: add one file in `src/synth/instruments/` exporting `id`, `name`, `role`, and `render(note, sampleRate)`. Return a deterministic, non-silent Float32Array with finite samples, peak <= 1, and a near-silent tail. Use `melodic` role to include a plugin in ordinary voice selection. Run `npm test` to regenerate the browser-compatible static registry and exercise the automatic conformance suite; commit `registry.generated.js`. Test changes alongside their modules, verify the demo render, and make small, logical commits.
