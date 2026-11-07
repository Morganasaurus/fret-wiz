# Fret Wiz

A fretboard visualiser for learning guitar: notes, scales, chords and keys, drawn on an interactive neck.
It's a static web app: everything runs in the browser and settings are saved in local storage.

## Features

- **Keys & songwriting**: pick a key and see its seven chords as cards with chord charts and a role
  (home / away / tension), plus borrowed chords for colour. Build your own progression (it transposes when you
  change key), play it back on a loop, or start from famous progressions (pop anthem, 12-bar blues, Andalusian…)
- **Chord shapes**: real fingerings shown as a chord chart and on the neck. In standard tuning the shapes follow
  the CAGED system (open chords, then E-, A-, D-shape barres up the neck) with a plain-English explanation; other
  tunings use a playable-shape search
- **Chords**: triads, sevenths, sixths and extended chords, plus every key the chord belongs to
- **Scales**: major, minor, pentatonics, blues, the modes, harmonic and melodic minor, symmetric scales,
  with the chords built from each scale
- **Notes**: every note, naturals only, or one note everywhere it appears (tap any fret to pick it)
- **Sound**: tap a chord or fret to hear it (a small plucked-string synth, no samples)
- Labels as note names, intervals (R, ♭3, 5, ♭7) or blank, a "how to read this" hint for each view, and a guide to what each interval sounds like
- Colours by scale degree, so a 3rd is always blue and a 5th always red
- 12 tunings (standard, drop, open, DADGAD, 7-string, bass), 12–24 frets, a fret-range focus, left-handed view

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # theory unit tests
npm run build      # typecheck + production build into dist/
```

Music theory (spelling, intervals, keys) uses [tonal](https://github.com/tonaljs/tonal).
Fretboard maths and diatonic harmony live in `src/theory/`, with tests in `src/theory/theory.test.ts`.

## Container

Every push to `main` runs the tests, then builds and publishes `ghcr.io/morganasaurus/fret-wiz`
with the tags `latest` and `sha-<short>`. The image is unprivileged nginx serving the built files on port 8080,
with a health endpoint at `/healthz`.

```bash
docker compose up -d   # serves on http://localhost:8095
```

To roll back, pin the compose `image:` to an earlier `sha-xxxxxxx` tag.
