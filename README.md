# Lyria AI Studio

**AI Music Generation Studio** — Desktop app for creating, mixing, and exporting AI-generated music with real-time controls and visual feedback.

Powered by Google’s **Lyria** family (including Lyria 3 / [Lyria 3.5](https://blog.google/innovation-and-ai/models-and-research/google-labs/lyria-3-5/) quality improvements for musicality, lyrics, vocals, and tempo/duration control).

![Platform](https://img.shields.io/badge/platform-macOS-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Lyria 3 Clip & Pro** — High-fidelity batch generation via Gemini Interactions API (vocals, lyrics, structure)
- **Lyria RealTime** — Continuous streaming, steerable with text, BPM, density, key
- **Creative controls** — Custom lyrics with `[Verse]`/`[Chorus]` tags, instrumental mode, image-inspired tracks
- **Tempo & duration** — BPM presets and length control up to 3 minutes (Pro), fixed 30s clips (Clip)
- **Multi-weighted Prompt Mixer** — Blend prompts with adjustable weights, negative prompts
- **Smart Random Prompts** — Model-aware generator tuned to each model’s strengths
- **Export** — MP3 (320k/128k), WAV, or FLAC
- **Visualizer** — Real-time waveform and spectrum analyzer
- **Themes** — Tokyo Night, Dark, Light
- **Secure Storage** — Encrypted API keys, persisted across restarts

> **Note:** Lyria 3.5 is the latest model family (Jul 2026) with stronger musicality, lyrics, and vocals. The Gemini API exposes it through the current **Lyria 3 Clip** (`lyria-3-clip-preview`) and **Lyria 3 Pro** (`lyria-3-pro-preview`) model IDs. Product experience also ships in [Google Flow Music](https://flowmusic.google/).

---

## Quick Start

### 1. Install and Run

```bash
git clone https://github.com/gprot42/macos-lyria-ai-studio.git
cd macos-lyria-ai-studio
bun install
./run-dev.sh
```

**Requires:** macOS 26.2+, [Bun](https://bun.sh/), [Rust](https://www.rust-lang.org/)

### 2. Get a Gemini API Key (free)

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **"Create API Key"**
3. Copy the key (starts with `AIza...`)

### 3. Configure and Generate

1. Open **Settings** → paste your API key → **Save Changes**
2. Pick a model in the header (default: **Clip · 30s**)
3. Enter a prompt (or click **Random**):
   ```
   neo-soul R&B, Rhodes keys, warm female vocals, 95 bpm
   ```
4. Optionally set BPM, length, custom lyrics, or attach an image
5. Click **Generate** → listen → **Save** as MP3/WAV/FLAC

---

## Models

| Model | Best For | Vocals | Duration | Prompt Limit |
|-------|----------|--------|----------|--------------|
| **Lyria 3 Clip** | Fast ideas, loops | Yes | 30 sec fixed | 1000 chars |
| **Lyria 3 Pro** | Full songs | Yes | Up to ~3 min | 2000 chars |
| **Lyria RealTime** | Live interactive | No | Continuous | 200 chars |
| **MusicGen** | Open-source instrumentals | No | Up to 2 min | 500 chars |

**Tip:** Iterate with **Clip** first, then generate a full song with **Pro**.

For a full comparison with Suno, Udio, MusicGen, and others, see [MODELS_COMPARISON.md](./MODELS_COMPARISON.md).

---

## Architecture

```
┌───────────────────────────────────────────────┐
│              Tauri Desktop App                │
│  ┌─────────────────────────────────────────┐  │
│  │     React + TypeScript Frontend         │  │
│  │  - Zustand · Web Audio API · Radix UI   │  │
│  └─────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────┐  │
│  │     Audio Engine + Lyria Client (TS)    │  │
│  │  - Streaming · Buffering · MP3/WAV      │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
              │                    │
              ▼                    ▼
       Gemini API              Interactions API
  (Lyria RealTime)         (Lyria 3 Clip / Pro)
```

**Stack:** React 18, TypeScript, Vite, Tauri 2.1, Zustand, Tailwind CSS, Web Audio API

---

## Documentation

| Guide | Description |
|-------|-------------|
| **[GUIDE.md](./GUIDE.md)** | Full setup guide, usage, troubleshooting |
| **[MODELS_COMPARISON.md](./MODELS_COMPARISON.md)** | Detailed comparison of AI music models |

### Key Links

- [Introducing Lyria 3.5 (Google Blog)](https://blog.google/innovation-and-ai/models-and-research/google-labs/lyria-3-5/)
- [Generate music with Lyria 3 (Gemini API)](https://ai.google.dev/gemini-api/docs/music-generation)
- [Google AI Studio — Get API Key](https://aistudio.google.com/apikey)
- [Google Flow Music](https://flowmusic.google/)
- [DeepMind Lyria](https://deepmind.google/models/lyria/)

---

## License

MIT — see LICENSE file for details.

Contributions welcome — open an issue or pull request.
