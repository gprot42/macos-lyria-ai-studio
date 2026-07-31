import type { ModelKey } from "@/lib/constants"

const INSTRUMENTS = [
  "303 Acid Bass", "808 Hip Hop Beat", "Accordion", "Alto Saxophone", "Bagpipes",
  "Banjo", "Bass Clarinet", "Bongos", "Cello", "Conga Drums", "Didgeridoo",
  "Djembe", "Dulcimer", "Fiddle", "Flamenco Guitar", "Funk Drums", "Glockenspiel",
  "Guitar", "Hang Drum", "Harmonica", "Harp", "Harpsichord", "Kalimba", "Koto",
  "Mandolin", "Marimba", "Mbira", "Mellotron", "Moog Synth", "Ocarina", "Piano",
  "Rhodes Piano", "Shamisen", "Sitar", "Slide Guitar", "Steel Drum", "Synth Pads",
  "Tabla", "TR-909 Drums", "Trumpet", "Tuba", "Vibraphone", "Viola", "Woodwinds",
  "electric guitar", "funk bass", "warm horn section", "Fender Rhodes",
]

const GENRES = [
  "Acid Jazz", "Afrobeat", "Ambient", "Baroque", "Bluegrass", "Blues",
  "Bossa Nova", "Breakbeat", "Celtic Folk", "Chillout", "Chiptune",
  "Deep House", "Disco Funk", "Drum and Bass", "EDM", "Electro Swing",
  "Funk", "Glitch Hop", "Indie Electronic", "Indie Folk", "Indie Pop",
  "Irish Folk", "Jazz Fusion", "Latin Jazz", "Minimal Techno", "Neo-Soul",
  "Orchestral", "Piano Ballad", "Post-Punk", "Psytrance", "Reggae",
  "Salsa", "Shoegaze", "Ska", "Surf Rock", "Synthpop", "Techno", "Trance",
  "Trip Hop", "Cinematic Score", "World Fusion", "Downtempo", "Progressive Rock",
  "funk pop", "electropop", "hyperpop", "reggaeton", "Afro-pop", "neosoul",
  "French alternative pop", "Brazilian funk carioca",
]

const MOODS = [
  "ambient", "bright", "chill", "danceable", "dreamy", "emotional", "ethereal",
  "experimental", "funky", "groovy", "hypnotic", "intense", "melancholic",
  "peaceful", "psychedelic", "relaxing", "upbeat", "uplifting", "dark", "energetic",
  "nostalgic", "warm", "spacious", "driving", "sensual", "playful", "elegant",
]

const VOCAL_STYLES = [
  "breathy elegant female vocal",
  "deep male baritone vocal",
  "airy soft female vocal",
  "playful male vocal with light scat runs",
  "warm stacked vocal harmonies",
  "half-whispered verses opening into a melodic chorus",
  "expressive R&B-style vocals",
]

const TEMPOS = [
  "60 bpm", "70 bpm", "80 bpm", "90 bpm", "95 bpm", "100 bpm", "110 bpm", "120 bpm",
  "130 bpm", "140 bpm", "150 bpm"
]

const DESCRIPTORS = [
  "with warm analog sound", "with lush reverb", "with crisp production",
  "with layered textures", "with rich harmonies", "studio quality",
  "with deep bass", "with sparkling highs", "with punchy drums",
  "with wide stereo mix", "with vintage tone", "with modern production",
  "clean vocal separation", "emotionally nuanced vocals",
]

const STRUCTURES = [
  "building from minimal to full arrangement",
  "with a slow atmospheric intro leading into a driving rhythm",
  "starting sparse then layering instruments progressively",
  "with dynamic crescendos and quiet breakdowns",
  "alternating between intense sections and ambient interludes",
  "with a cinematic build throughout",
  "clear verse-chorus structure with a bridge and outro",
]

const PRODUCTION_STYLES = [
  "polished studio recording with clean separation between instruments",
  "raw and organic live session feel with room ambiance",
  "heavily processed with creative effects and spatial mixing",
  "warm vintage analog production with subtle tape saturation",
  "modern hi-fi production with crisp transients and wide stereo field",
  "soft ambient production with gentle compression and airy reverb"
]

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function generateRealtimePrompt(): string {
  const genre = pickOne(GENRES)
  const instrument = pickOne(INSTRUMENTS)
  const mood = pickOne(MOODS)
  const tempo = pickOne(TEMPOS)
  return `${genre}, ${instrument}, ${mood}, ${tempo}`
}

function generateLyria3ClipPrompt(): string {
  const genre = pickOne(GENRES)
  const instruments = pickRandom(INSTRUMENTS, 2)
  const mood = pickOne(MOODS)
  const tempo = pickOne(TEMPOS)
  const vocal = pickOne(VOCAL_STYLES)
  const descriptor = pickOne(DESCRIPTORS)
  return `30-second ${genre} clip featuring ${instruments[0]} and ${instruments[1]}, ${mood} mood, ${tempo}, ${vocal}, ${descriptor}`
}

function generateLyria3ProPrompt(): string {
  const genre = pickOne(GENRES)
  const instruments = pickRandom(INSTRUMENTS, 3)
  const mood = pickOne(MOODS)
  const tempo = pickOne(TEMPOS)
  const vocal = pickOne(VOCAL_STYLES)
  const descriptor = pickOne(DESCRIPTORS)
  const structure = pickOne(STRUCTURES)
  const production = pickOne(PRODUCTION_STYLES)
  return `${genre} song featuring ${instruments.join(", ")}, ${mood} mood, ${tempo}, ${vocal}. ${structure}. ${production}, ${descriptor}`
}

function generateMusicgenPrompt(): string {
  const genre = pickOne(GENRES)
  const instruments = pickRandom(INSTRUMENTS, 2)
  const mood = pickOne(MOODS)
  const tempo = pickOne(TEMPOS)
  const descriptor = pickOne(DESCRIPTORS)
  return `${genre} with ${instruments[0]} and ${instruments[1]}, ${mood}, ${tempo}, ${descriptor}`
}

export function generateRandomPrompt(model: ModelKey = "lyria3clip"): string {
  switch (model) {
    case "realtime":
      return generateRealtimePrompt()
    case "lyria3clip":
      return generateLyria3ClipPrompt()
    case "lyria3pro":
      return generateLyria3ProPrompt()
    case "musicgen":
      return generateMusicgenPrompt()
    default:
      return generateLyria3ClipPrompt()
  }
}

export function getDefaultPrompt(model: ModelKey): string {
  switch (model) {
    case "realtime":
      return "Ambient electronic, Piano and Synth Pads, chill, 90 bpm"
    case "lyria3clip":
      return "Neo-soul R&B clip, Rhodes keys, groovy pocket, chill, warm female vocals, 95 bpm"
    case "lyria3pro":
      return "Stylish French alternative pop with warm analog synths, groovy rounded bassline, soft funk guitar, and airy disco-tinged drums. 110 BPM, B minor. Breathy elegant female vocal, half-whispered verses opening into a smooth melodic chorus."
    case "musicgen":
      return "Indie Electronic with Guitar and Synth Pads, upbeat, 120 bpm, with crisp production"
    default:
      return "Neo-soul R&B clip, Rhodes keys, groovy pocket, chill, warm female vocals, 95 bpm"
  }
}

/** Sample lyric scaffold for Clip/Pro users */
export const LYRICS_TEMPLATE = `[Verse 1]
Walking through the neon glow,
city lights reflect below.

[Chorus]
We are the echoes in the night,
burning brighter than the light.

[Verse 2]
Footsteps lost on empty streets,
rhythms sync to heartbeats.

[Bridge]
Hold on tight, don't let me go.

[Chorus]
We are the echoes in the night,
burning brighter than the light.
`
