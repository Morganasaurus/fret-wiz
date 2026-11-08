# Fret Wiz

A guitar fretboard app for **learning and songwriting**. Morgan uses it mostly on an **iPad mini** (landscape on a
music stand, sometimes portrait) and on a desktop. It is self-hosted on the homelab, LAN-only.

The bar for every change: a learner should understand what they're looking at and know what to play. Prefer
plain-English guidance, real playable shapes and songwriting help over dense theory.

## Stack and layout

Static single-page app: React 19 + TypeScript + Vite, music theory via [tonal](https://github.com/tonaljs/tonal),
vitest for tests. No backend; settings and the user's progression live in `localStorage`
(`fret-wiz.settings.v1`, see `src/state.ts`; add new fields with defaults, never rename the key).

- `src/theory/`: pure, tested logic. `notes` (spelling, interval labels), `tones` (scales, chords, diatonic
  harmony), `harmony` (key chords, roles, borrowed chords, progressions), `voicings` (chord shapes),
  `positions` (scale shapes), `tunings`, `catalog` (scale and chord lists)
- `src/view.ts`: turns settings into what the neck shows (dots, hint text, active chord)
- `src/components/`: `Fretboard` (SVG neck), `ChordDiagram`, `Workshop` (keys and songwriting, shape panel),
  `ScaleTools`, `Controls`
- `src/audio.ts`: Web Audio plucked-string synth (no samples yet)

## Music-theory rules already decided

- Spell notes from the key or scale via tonal (B♭ in F major, never A♯). Display with `pretty()` for ♯ ♭ 𝄫 𝄪.
- Colours are by scale degree (`DEGREE_COLORS` in `view.ts`): a 3rd is always blue, a 5th always red, the root amber.
- Chord shapes (`chordShapes` in `voicings.ts`): in standard tuning, CAGED shapes are seeded from the curated
  `OPEN_CHORDS` list (the open chords guitarists actually learn). The default ("easiest") shape is: the standard open
  chord if one exists, otherwise the easiest CAGED barre (G- and C-shape barres are penalised), otherwise the search
  result. Shapes are numbered in order up the neck. Root is always in the bass; at most 4 fingers. Never default to
  a shape mixing open strings with frets above 4.
- Scale shapes (`scalePositions`): pentatonics give 5 two-notes-per-string boxes; blues = those boxes plus the blue
  note inside the box; 7-note scales use 7 three-notes-per-string shapes. Shape 1 starts on the root on the lowest
  string, shapes climb the neck, and every complete octave copy that fits is highlighted.
- Keys are major or natural minor. Roles: home / away / tension; borrowed chords come from the parallel key.
- Any change to theory output needs tests in `src/theory/*.test.ts` with musically correct expectations.
  If a test disagrees with the code, decide which is musically right before changing either.

## Working on it

```bash
npm install
npm run dev        # http://localhost:5173 (.claude/launch.json has the "fret-wiz" preview config)
npm test           # vitest
npm run build      # typecheck + production build
```

Before calling UI work done: `npm test`, `npm run build`, then look at it in the browser at **1133×744** (iPad mini
landscape) and **744×1133** (portrait). Touch targets must be at least 44px. Check the console for errors.
Morgan may be clicking in the browser pane at the same time: use a separate tab for checks.

Two review subagents live in `.claude/agents/`:
- `music-theory-reviewer`: use after changing anything in `src/theory/`, chord or scale shapes, or wording that
  teaches theory.
- `ipad-ui-reviewer`: use after visible UI changes, to check both iPad sizes in the browser.

## Release and deploy

Use `/release` (`.claude/skills/release/`). In short: tests and build pass → commit → push `main` → GitHub Actions
(`.github/workflows/build.yml`) tests, builds and publishes `ghcr.io/morganasaurus/fret-wiz` as `latest` and
`sha-<short>`. The image is public.

The app runs as the `fret-wiz` Portainer stack on the `portainer` VM (repo-backed, `docker-compose.yml`, host port
8095), behind Nginx Proxy Manager at `https://fret-wiz.local.momolab.homes`. Git polling is deliberately off (it
races the image build). After a green build, Morgan runs **Pull and redeploy** in Portainer; otherwise Watchtower
picks it up within about 3 days. Roll back by pinning the image to an older `sha-` tag.

## Conventions

- Commit only when asked. The repo-local git identity is already set (GitHub noreply address); don't change it.
- Never commit secrets. The repo is public.
- Keep `docker-compose.yml` in sync with the copy in the Homelab folder (`stacks/fret-wiz/docker-compose.yml`).
- Third-party assets (such as audio samples) need a licence that allows redistribution in a public repo, plus a
  credit in `README.md`.
