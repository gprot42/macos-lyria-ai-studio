# Lyria AI Studio

**AI Music Generation Studio** — Desktop app for creating, mixing, and exporting AI-generated music with real-time controls and visual feedback.

![Platform](https://img.shields.io/badge/platform-macOS-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Three Lyria Models** — Realtime (streaming), Lyria 2 and Lyria 3 (batch via Vertex AI)
- **Lyrics/Vocals** — Lyria 2 and Lyria 3 support vocals and lyrics generation
- **Real-time Controls** — BPM, key/scale, density, brightness, guidance strength
- **Multi-weighted Prompt Mixer** — Blend prompts with adjustable weights, negative prompts
- **Smart Random Prompts** — Model-aware generator tuned to each model's capabilities
- **Export** — MP3 (320k/128k) or WAV (48kHz stereo)
- **Visualizer** — Real-time waveform and spectrum analyzer
- **Themes** — Tokyo Night, Dark, Light
- **Secure Storage** — Encrypted API keys and access tokens, persisted across restarts

> **Note:** Lyria 3 is currently only available in the Gemini app — not yet on the Vertex AI API. Use Lyria 2 or Lyria Realtime.


<img width="1512" height="884" alt="Screenshot 2026-02-19 at 20 29 19" src="https://github.com/user-attachments/assets/9b5d5829-c435-42ba-9be4-83e59d18f1a6" />


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
2. Enter a prompt (or click **Random**):
   ```
   ambient electronic, Piano and Synth Pads, chill, 90 bpm
   ```
3. Click **Generate** → listen → **Save As** MP3/WAV

---

## Models

| Model | Best For | Vocals | Prompt Limit |
|-------|----------|--------|--------------|
| **Lyria Realtime** | Real-time/interactive, free tier | No | 200 chars |
| **Lyria 2** | Batch generation via Vertex AI | Yes | 500 chars |
| **Lyria 3** | Highest quality (Gemini app only) | Yes | 1000 chars |

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
       Gemini API         Vertex AI REST API
  (Lyria Realtime)          (Lyria 2 / 3)
```

**Stack:** React 18, TypeScript, Vite, Tauri 2.1, Zustand, Tailwind CSS, Web Audio API

---

## Documentation

| Guide | Description |
|-------|-------------|
| **[GUIDE.md](./GUIDE.md)** | Full setup guide, usage, Vertex AI config, troubleshooting |
| **[MODELS_COMPARISON.md](./MODELS_COMPARISON.md)** | Detailed comparison of all AI music models |

### Key Links

- [Google AI Studio — Get API Key](https://aistudio.google.com/apikey)
- [Vertex AI Music Docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music)
- [Gemini API Music Generation](https://ai.google.dev/gemini-api/docs/music-generation)

---

## License

MIT — see LICENSE file for details.

Contributions welcome — open an issue or pull request.
