# Fret Wiz

A guitar fretboard app for **learning and songwriting**. It is used mostly on an **iPad mini** (landscape on a
music stand, sometimes portrait) and on a desktop. It is self-hosted on the homelab and **reachable from the
internet** (Cloudflare Tunnel → reverse proxy → container), so treat every change as public-facing.

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
- `src/components/`: `Shell` (iPad-style sidebar, grouped lists, switches, Settings sheet), `Icons`, `Fretboard`
  (SVG neck), `ChordDiagram`, `Workshop` (keys and songwriting, shape panel), `ScaleTools`, `Controls`
- `src/app.css`: the whole look. iOS/iPadOS style using Apple's system colours as CSS variables, with
  `:root.theme-light` / `:root.theme-dark` (Appearance setting: Automatic follows the iPad). Use the tokens
  (`--bg`, `--bg2`, `--label`, `--label2`, `--tint`, `--deg-1`…`--deg-7`, neck tokens), never hard-coded colours.
  Design reference: `mockups/index.html` (direction A, the sidebar layout, was chosen).
- Layout: sidebar (modes + the current mode's pickers, hideable; slides over on screens ≤ 900px), sticky
  toolbar, large title, neck card, chord inspector, then the mode's content.
- Desktop layout (`src/desktop.css`, `components/Desktop.tsx`) switches on with
  `(min-width: 1800px) and (hover: hover) and (pointer: fine)`; the owner's desktop is a 45" 5120×2160 OLED
  (about 3413×1440 CSS px at 150%). It puts the neck (wider SVG, `width={1600}`) beside the inspector, the
  workshop in three columns, a play bar in the header, hover details on frets, and defaults Automatic appearance to
  dark (OLED). The iPad layout must stay unchanged; check 1133×744 and 744×1133 after desktop changes.
- Keyboard shortcuts live in `App.tsx` (`onKey`): Space strum / play shape, 1–9 shapes (0 = whole neck in
  Scales), ← → chords, P play/stop, A add to progression, M metronome, S sidebar. Keep `ShortcutsCard` and the README in sync.
- Saved progressions (`src/progressions.ts`): each has a name, key and steps; the active one always follows the
  current key in Keys mode.
- `src/audio.ts`: Web Audio guitar. Plays steel-string recordings from `public/samples/guitar-steel/` (13 files,
  one every 3 semitones, pitched to the notes between; credits in that folder and the README), with a light reverb
  and slightly randomised strums. The recordings are fetched and decoded (OfflineAudioContext) as soon as the page
  loads; a sound requested before they're ready waits for them (up to 2.5 s) instead of using the synth, so the
  Karplus-Strong synth is only heard if the files can't be loaded. All guitar sound goes through `withGuitar`.
- Metronome / speed trainer: ramp maths in `src/trainer.ts` (pure, tested), the lookahead click scheduler in
  `src/metronome.ts` (Web Audio clock, keeps running across modes, `useMetronome` hook), clicks from
  `scheduleClick` in `audio.ts` (dry, not stopped by `stopAll`), UI in `components/Metronome.tsx` (card above the
  neck, toolbar icon, a BPM pill while running). Settings live in `metronome` / `metronomeOpen`.

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
The user may be clicking in the browser pane at the same time: use a separate tab for checks.

Two review subagents live in `.claude/agents/`:
- `music-theory-reviewer`: use after changing anything in `src/theory/`, chord or scale shapes, or wording that
  teaches theory.
- `ipad-ui-reviewer`: use after visible UI changes, to check both iPad sizes in the browser.
- `security-reviewer`: use after changing `nginx.conf`, the `Dockerfile`, `docker-compose.yml`, the workflow,
  dependencies, or code that reads URLs, storage or user input; and before a release that touches any of them.

## Security

The site is public, the repo is public, and pushes to `main` reach the server through the `latest` image. So:
no new runtime dependencies without a good reason; never render user or stored text as HTML; no third-party
requests (analytics, fonts, CDNs); keep the GitHub Actions permissions minimal; keep the container non-root and
read-only. Security headers live in `nginx.conf`, set once at server level (never `add_header` inside a
`location`, or nginx drops the rest). The Content-Security-Policy carries a per-request nonce so Cloudflare's
injected bot-detection and Web Analytics scripts can run; that's why the page is `no-store` with no ETag. A new
external resource needs a CSP change. Workflow actions are pinned to commit SHAs (Dependabot updates them).

## Release and deploy

Use `/release` (`.claude/skills/release/`). In short: tests and build pass → commit → push `main` → GitHub Actions
(`.github/workflows/build.yml`) tests, builds and publishes `ghcr.io/morganasaurus/fret-wiz` as `latest` and
`sha-<short>`. The image is public.

The app runs as the `fret-wiz` Portainer stack on the `portainer` VM (repo-backed, `docker-compose.yml`, host port
8095), behind Nginx Proxy Manager on the LAN and, publicly, behind a Cloudflare Tunnel (the owner has the
addresses; keep hostnames out of the repo). Git polling is deliberately off (it
races the image build). After a green build, the user runs **Pull and redeploy** in Portainer; otherwise Watchtower
picks it up within about 3 days. Roll back by pinning the image to an older `sha-` tag.

## Conventions

- Commit only when asked. The repo-local git identity is already set (author "Fret Wiz", GitHub noreply address);
  don't change it.
- Never put the owner's personal name in files, commit messages, PRs or anything else pushed to GitHub. Refer to
  "the user" or "the owner". The GitHub username in repo and image paths is fine (it's required).
- Never commit secrets. The repo is public.
- Keep `docker-compose.yml` in sync with the copy in the Homelab folder (`stacks/fret-wiz/docker-compose.yml`).
- Third-party assets (such as audio samples) need a licence that allows redistribution in a public repo, plus a
  credit in `README.md`.
