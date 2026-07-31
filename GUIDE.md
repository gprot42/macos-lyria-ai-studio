# Lyria AI Studio — Setup & Usage Guide

Full documentation for Lyria AI Studio. For a quick overview, see [README.md](./README.md).

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
  - [Option 1: Lyria 3 Clip (Recommended start)](#option-1-lyria-3-clip-recommended-start)
  - [Option 2: Lyria 3 Pro (Full songs)](#option-2-lyria-3-pro-full-songs)
  - [Option 3: Lyria RealTime (Live streaming)](#option-3-lyria-realtime-live-streaming)
  - [Option 4: MusicGen](#option-4-musicgen)
- [Lyria 3.5 & models](#lyria-35--models)
- [Usage Guide](#usage-guide)
- [Troubleshooting](#troubleshooting)
- [Official Documentation](#official-documentation)
- [Security & Privacy](#security--privacy)

---

## Requirements

### System
- **macOS** 26.2 or later (arm64 or x64)
- **8GB RAM** minimum (16GB recommended for multiple tracks)
- **Internet connection** for API access

### Software
- [Bun](https://bun.sh/) (JavaScript runtime and package manager)
- [Rust](https://www.rust-lang.org/) (for Tauri backend)

### API Keys

| Model | What You Need |
|-------|---------------|
| **Lyria 3 Clip / Pro** | Gemini API key ([AI Studio](https://aistudio.google.com/apikey)) |
| **Lyria RealTime** | Same Gemini API key (free tier) |
| **MusicGen** | Optional HF token; free HF Inference API is deprecated |

---

## Installation

```bash
# 1. Clone
git clone https://github.com/gprot42/macos-lyria-ai-studio.git
cd macos-lyria-ai-studio

# 2. Install dependencies
bun install

# 3. Run
./run-dev.sh
```

The app launches in a maximized window with hot reload enabled.

---

## Getting Started

### Option 1: Lyria 3 Clip (Recommended start)

Fast 30-second clips with vocals and lyrics. Good free-tier quota for trying ideas.

#### Step 1: Get a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (starts with `AIza...`)

#### Step 2: Configure

1. Launch **Lyria AI Studio**
2. Click **Settings** (top-right)
3. Paste your API key
4. Click **"Save Changes"**
5. Use the header model picker — **Clip · 30s** is the default

#### Step 3: Generate

1. Enter a prompt (or **Random**):
   ```
   neo-soul R&B, Rhodes keys, warm female vocals, 95 bpm
   ```
2. Optionally: set BPM, add custom lyrics, turn on **Instrumental only**, or attach an image
3. Click **Generate**
4. Preview and **Save** as MP3/WAV/FLAC

**Prompt tips:** Genre + instruments + vocal style + BPM. Clip always returns 30 seconds.

---

### Option 2: Lyria 3 Pro (Full songs)

Full-length songs up to ~3 minutes with verses, choruses, and bridges. **Paid** API usage.

1. Select **Pro · up to 3 min** in the header model picker
2. Set **Length** (1 / 1.5 / 2 / 2.5 / 3 min) — duration is sent explicitly in the prompt
3. Optional: paste lyrics with `[Verse]` / `[Chorus]` tags
4. Generate (often 1–2 minutes to complete)

**Prompt tips:** Structure, mood, instruments, language of lyrics. Example:

```
Stylish French alternative pop with warm analog synths, groovy bassline,
soft funk guitar. 110 BPM, B minor. Breathy female vocal, half-whispered
verses into a smooth chorus.
```

---

### Option 3: Lyria RealTime (Live streaming)

Continuous instrumental generation. Free tier with quota limits. Best for live steerable loops.

1. Select **RealTime · live**
2. Keep prompts short (**≤ 200 characters**)
3. Use Density / Brightness / Guidance / instrument mute while generating

Example: `ambient electronic chill, 90 bpm, dreamy pads`

---

### Option 4: MusicGen

Meta’s open model via Hugging Face. Free Inference API is deprecated — use HF Pro, Replicate, or self-hosting. Prefer Lyria Clip/Realtime for free generation.

---

## Lyria 3.5 & models

[Lyria 3.5](https://blog.google/innovation-and-ai/models-and-research/google-labs/lyria-3-5/) (Jul 2026) improves musicality, lyrics, vocals, and tempo/duration control. It ships in [Google Flow Music](https://flowmusic.google/) and related products.

Via the **Gemini API**, batch music uses these model IDs:

| UI label | Model ID | Duration |
|----------|----------|----------|
| Lyria 3 Clip | `lyria-3-clip-preview` | 30 seconds |
| Lyria 3 Pro | `lyria-3-pro-preview` | ~1–3 minutes (prompt-controlled) |
| Lyria RealTime | `lyria-realtime-exp` | Continuous stream |

This app maps duration, BPM, custom lyrics, instrumental mode, and reference images into the Interactions API so you get the same creative control highlights without leaving the desktop app.

| Feature | Clip | Pro | RealTime |
|---------|------|-----|----------|
| Vocals / lyrics | ✅ | ✅ | ❌ |
| Custom lyrics | ✅ | ✅ | ❌ |
| Image prompts | ✅ | ✅ | ❌ |
| Instrumental toggle | ✅ | ✅ | N/A (instrumental) |
| Exact length control | Fixed 30s | Up to 3 min | Session length |
| Live density/brightness | ❌ | ❌ | ✅ |

---

## Usage Guide

### Model picker (header)

Switch models without opening Settings. Tooltips summarize pricing and best use.

### Prompt

Describe genre, mood, instruments, vocal style, and BPM. Use **Random** for model-aware samples. **Add** blends multiple weighted prompts.

### Creative controls (Clip / Pro)

| Control | What it does |
|---------|----------------|
| **Instrumental only** | No vocals/lyrics in the output |
| **Custom lyrics** | Your words with optional `[Verse]`/`[Chorus]` tags |
| **Image inspiration** | Up to 10 images; music follows mood/colors |
| **Generated lyrics** | Shown after generation; can copy into custom lyrics |

### Tempo & length

| Control | Range | Notes |
|---------|-------|--------|
| **BPM** | 60–200 | Quick presets: ballad / chill / groove / pop / energy |
| **Key / Scale** | C–B + mode | Included in Clip/Pro prompts |
| **Length** | Clip: 30s · Pro: 1–3 min · RealTime: 15–120s | Pro duration is stated clearly in the API prompt |

### RealTime-only controls

Density, Brightness, Guidance, Temperature, and instrument mute/solo apply while streaming RealTime only.

### Generation workflow

1. Add Gemini API key in Settings (once)
2. Pick model in the header
3. Write prompt → set BPM / length
4. Optional: lyrics, instrumental, images
5. **Generate** → **Preview** → **Save**

---

## Troubleshooting

### Generate is disabled
Add a Gemini API key in **Settings** and click **Save Changes**.

### Prompt rejected / safety filter
Avoid named artists, copyrighted lyrics, or prompts that request cloning a specific voice. Rephrase with genre, mood, and instruments.

### Clip/Pro: “No audio in API response”
Check API key quotas and billing for Pro. Retry; status `failed` may indicate content filters or temporary capacity.

### RealTime connection errors
Confirm `v1alpha` access with a valid key. Restart the app and regenerate.

### MusicGen fails
Free HF Inference API is deprecated. Use Lyria Clip/Realtime or a paid MusicGen host.

---

## Official Documentation

- [Lyria 3.5 announcement](https://blog.google/innovation-and-ai/models-and-research/google-labs/lyria-3-5/)
- [Gemini API — music generation](https://ai.google.dev/gemini-api/docs/music-generation)
- [DeepMind Lyria](https://deepmind.google/models/lyria/)
- [Google Flow Music](https://flowmusic.google/)
- [Google AI Studio API keys](https://aistudio.google.com/apikey)

---

## Security & Privacy

- API keys are stored locally (encrypted via Tauri secure storage where available)
- Keys are not uploaded to third parties other than Google (or Hugging Face for MusicGen)
- Generated Lyria audio includes Google’s SynthID watermark (imperceptible)

---

## Technical Details

- **Frontend:** React, TypeScript, Vite, Zustand, Tailwind, Radix UI
- **Desktop:** Tauri 2
- **APIs:** `@google/genai` Live Music (RealTime) + Interactions API (Clip/Pro)
