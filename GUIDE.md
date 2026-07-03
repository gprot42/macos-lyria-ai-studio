# Lyria AI Studio — Setup & Usage Guide

Full documentation for Lyria AI Studio. For a quick overview, see [README.md](./README.md).

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
  - [Option 1: Google Lyria Realtime (Recommended)](#option-1-google-lyria-realtime-recommended)
  - [Option 2: Google Lyria 2 (Vertex AI)](#option-2-google-lyria-2-vertex-ai)
  - [Option 3: Google Lyria 3 (Gemini App Only)](#option-3-google-lyria-3-gemini-app-only)
  - [Option 4: MusicGen (API Deprecated)](#option-4-musicgen-api-deprecated)
- [Lyria 3 vs Lyria 2](#lyria-3-vs-lyria-2)
- [Usage Guide](#usage-guide)
- [Troubleshooting](#troubleshooting)
- [Technical Details](#technical-details)
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
| **Lyria Realtime** | Gemini API key (free tier, no approvals) |
| **Lyria 2 / Lyria 3** | Google Cloud project + billing + Vertex AI API + OAuth2 access token |

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

### Option 1: Google Lyria Realtime (Recommended)

The easiest way to get started. Free tier, no approvals.

#### Step 1: Get a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (starts with `AIza...`)

- Free tier: **60 requests per minute**
- No credit card required
- Key never expires unless you delete it

#### Step 2: Configure

1. Launch **Lyria AI Studio**
2. Click **Settings** (top-right)
3. Select **"Google Lyria Realtime"** as the AI Model
4. Paste your API key
5. Click **"Save Changes"**

#### Step 3: Generate

1. Enter a prompt:
   ```
   ambient electronic, Piano and Synth Pads, chill, 90 bpm
   ```
2. Set **Track Length** (e.g., 30 seconds)
3. Click **"Generate"**
4. Listen and **Save As** MP3/WAV

**Prompt tips:** Keep under **200 characters**. Include genre, instruments, mood, and BPM. Example: `"jazz piano trio, 120 bpm, upbeat"`

---

### Option 2: Google Lyria 2 (Vertex AI)

#### Vertex AI Setup (shared by Lyria 2 and Lyria 3)

1. Set up a [Google Cloud project](https://console.cloud.google.com/) with billing enabled
2. Enable the Vertex AI API:
   ```bash
   gcloud services enable aiplatform.googleapis.com --project=YOUR_PROJECT_ID
   ```
3. Install the Cloud SDK and authenticate:
   ```bash
   brew install --cask google-cloud-sdk
   gcloud init && gcloud auth login
   ```
4. Generate an access token (expires after 1 hour):
   ```bash
   gcloud auth print-access-token
   ```

#### Configure

1. Open **Settings**
2. Select **"Google Lyria 2 (Vertex AI)"**
3. Fill in **Project ID**, **Region**, and **Access Token**
4. Click **"Save Changes"**

#### Generate

Enter a detailed prompt (up to **500 characters**):
```
Cinematic orchestral score with soaring strings, heroic brass fanfare,
dramatic timpani rolls, 140 bpm, epic fantasy adventure theme, key of D major
```

---

### Option 3: Google Lyria 3 (Gemini App Only)

> **Note:** Google Lyria 3 (`lyria-003`) launched on Feb 18, 2026 but is currently **only available in the Gemini app** — it is not yet exposed via the Vertex AI REST API. Selecting Lyria 3 in Lyria AI Studio will show an informative error message. Use **Lyria 2** or **Lyria Realtime** until Vertex AI API support is added.

When available on Vertex AI, Lyria 3 will use the same setup as Lyria 2 (see above) and support prompts up to **1000 characters**:

```
Progressive electronic track blending organic and synthetic textures.
Start with a minimal ambient intro of granular pads, evolve into a
driving four-on-the-floor beat at 126 bpm with acid bass, arpeggiated
synths in A minor, side-chain compression, filtered builds, and a
euphoric breakdown with reverbed piano chords
```

---

### Option 4: MusicGen (API Deprecated)

**Update (2026-02-04):** Hugging Face has deprecated their free Inference API. MusicGen is no longer available for free through this app.

**Alternatives:** Hugging Face Pro (paid), Replicate API (~$0.0023/sec), or self-hosting with a GPU.

**Recommendation:** Use **Google Lyria Realtime** instead — it's free and works immediately.

<details>
<summary>MusicGen setup (for reference)</summary>

1. Select **"MusicGen"** in Settings
2. Choose model size: Small (~300M), Medium (~1.5B), or Large (~3.3B)
3. Enter a prompt and generate

**Prompt tips:** Supports up to 500 characters. MusicGen generates instrumentals only (no vocals).

</details>

---

### Token Expiration (Lyria 2 & 3)

When you see an authentication error, refresh your token:
```bash
gcloud auth print-access-token
```
Update the Access Token in Settings.

---

## Lyria 3 vs Lyria 2

| Feature | Lyria 2 (`lyria-002`) | Lyria 3 (`lyria-003`) |
|---|---|---|
| **Max prompt length** | 500 characters | 1000 characters |
| **Generation quality** | High | Highest — improved fidelity and coherence |
| **Prompt understanding** | Style + mood | Structure, instrumentation, and dynamics |
| **Pricing** | Paid (GCP billing) | Paid (GCP billing) |
| **Access** | Generally available | Gemini app only (Vertex AI API coming) |

**Use Lyria 3 when:** You need longer prompts, highest quality, or complex song structure.  
**Use Lyria 2 when:** Shorter prompts, quick generation, simpler style cues.

Both share the same Vertex AI credentials. Switching is a single dropdown change in Settings.

---

## Usage Guide

### Prompt Mixer

Enter descriptive text (genre, mood, tempo, instruments). Add multiple prompts and adjust weights (0-100%). Higher weight = stronger influence.

**Examples:**
- `"deep house, 128 bpm, hypnotic bassline, with warm analog sound"`
- `"jazz fusion, Rhodes piano and upright bass, groovy, 110 bpm"`
- `"ambient drone, dark atmospheric pads, with lush reverb"`

### Negative Prompts

Exclude unwanted elements: `"no drums"`, `"no vocals"`, `"no distortion"`

### Parametric Controls

| Control | Range | Description |
|---------|-------|-------------|
| **BPM** | 60-200 | Tempo (auto-detected from prompts) |
| **Key** | C-B | Root note |
| **Scale** | Major, Minor, etc. | Musical mode |
| **Density** | 0.0-1.0 | Note complexity (sparse → busy) |
| **Brightness** | 0.0-1.0 | Frequency emphasis (dark → bright) |
| **Guidance** | 0.0-6.0 | Prompt adherence (higher = stricter) |

### Generation Workflow

1. **Configure Prompts** → Enter descriptions and weights
2. **Set Parameters** → Adjust BPM, key, density, brightness
3. **Set Track Length** → Choose duration (e.g., 30-60 seconds)
4. **Generate** → Click "Generate" and wait
5. **Preview** → Listen to the generated track
6. **Save** → Click "Save As" → MP3 or WAV

### Track Library

Generated tracks appear with name, duration, preview, and save buttons. Export to MP3 (320k/128k) or WAV.

---

## Troubleshooting

### "Blocked by recitation checks" (Lyria 2)
**Cause:** Google's copyright safety filter blocked the output.  
**Fix:**
- Avoid specific artists, song titles, or well-known styles (e.g., "Lo-Fi Hip Hop", "Trap", "G-funk")
- Use more descriptive prompts with instruments, moods, and production details
- Click **Random** for a safe, model-tuned prompt

### "Unsupported language detected" (Lyria 2)
**Cause:** Lyria 2 only accepts US English. Short/terse prompts can trigger this incorrectly.  
**Fix:**
- Write prompts in English only
- Make prompts more descriptive (genre + instruments + mood + BPM)
- Use the **Random** button

### "Authentication failed" (Lyria 2 / Lyria 3)
**Cause:** Access token expired (tokens last 1 hour).  
**Fix:** Run `gcloud auth print-access-token` and update in Settings.

### "Model not found" (Lyria 2 / Lyria 3)
**Cause:** Vertex AI API not enabled or incorrect Project ID / Region.  
**Fix:**
- Enable API: `gcloud services enable aiplatform.googleapis.com`
- Verify Project ID and Region in Settings

### "Invalid API Key" (Lyria Realtime)
**Cause:** API key is incorrect or revoked.  
**Fix:** Verify at [Google AI Studio](https://aistudio.google.com/apikey). Create a new key if needed.

### No Audio Output
1. Check console (Cmd+Option+I) for errors
2. Verify API key is saved
3. Reload the app
4. Check internet connection

---

## Technical Details

### Audio Specifications

| Property | Value |
|----------|-------|
| Sample Rate | 48,000 Hz |
| Channels | 2 (Stereo) |
| Bit Depth | 16-bit (internal), 32-bit float (processing) |
| Latency | ~2 seconds (Realtime) |
| Buffer Size | 4096 samples |

### Export Formats

| Format | Bitrate | Use Case |
|--------|---------|----------|
| **MP3 320kbps** | 320 kb/s | Streaming, sharing |
| **MP3 128kbps** | 128 kb/s | Smaller file size |
| **WAV** | 1536 kb/s | Professional editing |

### Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Desktop:** Tauri 2.1 (Rust backend)
- **State:** Zustand
- **UI:** Radix UI, Tailwind CSS
- **Audio:** Web Audio API, lamejs (MP3 encoding)
- **APIs:** Google Gemini SDK, Vertex AI REST

---

## Official Documentation

### Google Lyria

| Resource | URL |
|----------|-----|
| **Lyria Realtime Overview** | [ai.google.dev/gemini-api/docs/music-generation](https://ai.google.dev/gemini-api/docs/music-generation) |
| **Vertex AI Music (Lyria 2)** | [docs.cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music) |
| **Gemini API Quickstart** | [ai.google.dev/gemini-api/docs/quickstart](https://ai.google.dev/gemini-api/docs/quickstart) |
| **Get API Key** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

### Google Cloud

| Resource | URL |
|----------|-----|
| **Cloud Console** | [console.cloud.google.com](https://console.cloud.google.com/) |
| **Vertex AI API** | [cloud.google.com/vertex-ai/docs](https://cloud.google.com/vertex-ai/docs) |
| **Cloud SDK Install** | [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install) |
| **Authentication Guide** | [cloud.google.com/docs/authentication](https://cloud.google.com/docs/authentication) |

---

## Security & Privacy

- **API Keys:** Encrypted and stored locally via Tauri secure storage
- **Access Tokens:** Encrypted and persisted locally (still expire after 1 hour on Google's side)
- **Vertex AI Settings:** Project ID, region, and model selection saved across restarts
- **No Telemetry:** No usage data sent to external servers
- **Local Processing:** All audio processing happens on your machine

---

## Themes

| Theme | Description |
|-------|-------------|
| **Tokyo Night** (default) | Blue-purple dark theme |
| **Dark** | Pure grayscale |
| **Light** | High-contrast for bright environments |

Change in: Settings → Theme
