# Fret Wiz

A fretboard visualiser for learning guitar and writing songs: notes, scales, chords and keys, drawn on an
interactive neck. It's a static web app: everything runs in the browser and settings are saved on the device.

## Features

- **Keys & songwriting**: pick a key and see its seven chords as cards with chord charts and a role
  (home / away / tension), plus borrowed chords for colour. Write and name several progressions (each remembers
  its key and transposes when you change it), drag chords to reorder, play them back on a loop, or start from
  famous progressions (pop anthem, 12-bar blues, Andalusian…)
- **Chord shapes**: real fingerings shown as a chord chart and on the neck. In standard tuning the shapes follow
  the CAGED system (open chords, then E-, A-, D-shape barres up the neck) with a plain-English explanation; other
  tunings use a playable-shape search
- **Chords**: triads, sevenths, sixths and extended chords, plus every key the chord belongs to
- **Scales**: major, minor, pentatonics, blues, the modes, harmonic and melodic minor, symmetric scales, practice
  shapes (pentatonic boxes, three-notes-per-string shapes) and the chords built from each scale
- **Notes**: every note, naturals only, or one note everywhere it appears (tap any fret to pick it)
- **Sound**: tap a chord or fret to hear it, played with real steel-string acoustic guitar recordings (a small
  synth is only used if the recordings can't be loaded)
- **Metronome and speed trainer**: set a start and target tempo and it speeds up a few BPM every few bars, so you
  can build speed on a scale or riff; 2/4 to 5/4, clicks on beats, 8ths, triplets or 16ths, and it keeps
  running while you switch between modes
- Labels as note names, intervals (R, ♭3, 5, ♭7) or blank, a "how to read this" hint for each view, and a guide to
  what each interval sounds like
- Colours by scale degree, so a 3rd is always blue and a 5th always red
- iPad-style design with a sidebar you can hide, Apple's system colours, and light and dark appearance
- **Desktop layout** on wide screens with a mouse: everything on one screen (big neck, chord chart, chords,
  progression), a play bar, hover details on every fret, keyboard shortcuts, and dark mode by default
- 12 tunings (standard, drop, open, DADGAD, 7-string, bass), 12–24 frets, a fret-range focus, left-handed view

## How to install

Fret Wiz is a single small container (unprivileged nginx serving static files). Run it anywhere Docker runs, then
open it in a browser on your iPad, phone or computer.

### 1. Run the container

The image is published to GitHub Container Registry and is public, so no login is needed.

**With Docker Compose** (recommended). Save this as `docker-compose.yml`:

```yaml
services:
  fret-wiz:
    image: ghcr.io/morganasaurus/fret-wiz:latest
    container_name: fret-wiz
    restart: unless-stopped
    ports:
      - "8095:8080"
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/healthz"]
      interval: 60s
      timeout: 5s
      retries: 3
      start_period: 10s
```

```bash
docker compose up -d
```

**Or with a single command:**

```bash
docker run -d --name fret-wiz --restart unless-stopped -p 8095:8080 ghcr.io/morganasaurus/fret-wiz:latest
```

**Or in Portainer:** Stacks → Add stack → Repository, with repository URL
`https://github.com/Morganasaurus/fret-wiz`, reference `refs/heads/main` and compose path `docker-compose.yml`.
No environment variables are needed.

Then open `http://<your-server>:8095`. Change the left-hand port (`8095`) if it's already in use.

### 2. Optional: a nicer address with HTTPS

Put it behind your reverse proxy (Nginx Proxy Manager, Caddy, Traefik…) with a hostname such as
`fret-wiz.example.com`, forwarding to port 8095 on the Docker host. HTTPS isn't required for anything to work,
but it lets the browser treat the app as a proper home-screen app.

### 3. Add it to your iPad or iPhone

Open the address in Safari, tap **Share → Add to Home Screen**. It opens full screen like an app. Settings and your
progressions are stored on each device separately.

### 4. Updating and rolling back

Each push to `main` publishes a new `latest` image plus a `sha-<short>` tag.

- Docker Compose: `docker compose pull && docker compose up -d`
- Portainer: open the stack and use **Pull and redeploy** (with "re-pull image" on)
- Watchtower, if you use it, will pick up new `latest` images automatically

To roll back, change `image:` to an earlier tag, e.g. `ghcr.io/morganasaurus/fret-wiz:sha-1ab5c65`, and redeploy.
The tags are listed on the repository's **Packages** page.

## Using it

Pick a mode in the sidebar (Keys & Songwriting, Chords, Scales, Notes), then tap chords, shapes and frets.
Settings (gear icon) has appearance, sound, tuning, fret count, fret-range focus and left-handed options.

### Building speed with the metronome

Tap the metronome icon in the toolbar. In **Speed trainer** mode, set the **start** tempo (one you can play
cleanly), the **target**, how much to **speed up by** and how often (**every** few bars). Press play: it climbs
step by step and shows how far you've got, then either keeps going at the target or starts again from the
bottom. Pick **Steady** for a plain metronome. A good routine: pick a scale shape in Scales, start the trainer,
and play the shape up and down in time; if it falls apart, stop and set the start a few BPM lower.

### Keyboard shortcuts

| Key | Does |
|---|---|
| Space | Strum the chord shown (in Scales with a shape picked: play the shape) |
| 1 – 9 | Pick a chord shape, or in Scales a scale shape (0 = whole neck) |
| ← → | Previous / next chord in the key or scale |
| P | Play / stop your progression (Keys) |
| M | Start / stop the metronome |
| A | Add the selected chord to your progression (Keys) |
| S | Show / hide the sidebar |

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # typecheck + production build into dist/
docker build -t fret-wiz .   # build the image locally
```

Music theory (spelling, intervals, keys) uses [tonal](https://github.com/tonaljs/tonal). Fretboard maths, chord
shapes, scale shapes and harmony live in `src/theory/`, each with tests alongside. Design mockups are in
`mockups/index.html` (not part of the image).

Every push to `main` runs the tests in GitHub Actions, then builds and publishes the image with the tags `latest`
and `sha-<short>`. The container serves on port 8080 with a health endpoint at `/healthz`.

## Credits

Guitar samples (`public/samples/guitar-steel/`): steel-string acoustic guitar recorded by the
[University of Iowa Electronic Music Studios](https://theremin.music.uiowa.edu/MIS.html), prepared as MP3s in
[tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by Nicholaus P. Brosowsky and released under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Used unmodified; see `CREDITS.txt` in that folder.
