import type { ModelKey } from "@/lib/constants"

const INSTRUMENTS = [
  "303 Acid Bass", "808 Hip Hop Beat", "Accordion", "Alto Saxophone", "Bagpipes",
  "Banjo", "Bass Clarinet", "Bongos", "Cello", "Conga Drums", "Didgeridoo",
  "Djembe", "Dulcimer", "Fiddle", "Flamenco Guitar", "Funk Drums", "Glockenspiel",
  "Guitar", "Hang Drum", "Harmonica", "Harp", "Harpsichord", "Kalimba", "Koto",
  "Mandolin", "Marimba", "Mbira", "Mellotron", "Moog Synth", "Ocarina", "Piano",
  "Rhodes Piano", "Shamisen", "Sitar", "Slide Guitar", "Steel Drum", "Synth Pads",
  "Tabla", "TR-909 Drums", "Trumpet", "Tuba", "Vibraphone", "Viola", "Woodwinds"
]

const GENRES = [
  "Acid Jazz", "Afrobeat", "Ambient", "Baroque", "Bluegrass", "Blues",
  "Bossa Nova", "Breakbeat", "Celtic Folk", "Chillout", "Chiptune",
  "Deep House", "Disco Funk", "Drum and Bass", "EDM", "Electro Swing",
  "Funk", "Glitch Hop", "Indie Electronic", "Indie Folk", "Indie Pop",
  "Irish Folk", "Jazz Fusion", "Latin Jazz", "Minimal Techno", "Neo-Soul",
  "Orchestral", "Piano Ballad", "Post-Punk", "Psytrance", "Reggae",
  "Salsa", "Shoegaze", "Ska", "Surf Rock", "Synthpop", "Techno", "Trance",
  "Trip Hop", "Cinematic Score", "World Fusion", "Downtempo", "Progressive Rock"
]

const MOODS = [
  "ambient", "bright", "chill", "danceable", "dreamy", "emotional", "ethereal",
  "experimental", "funky", "groovy", "hypnotic", "intense", "melancholic",
  "peaceful", "psychedelic", "relaxing", "upbeat", "uplifting", "dark", "energetic",
  "nostalgic", "warm", "spacious", "driving"
]

const TEMPOS = [
  "60 bpm", "70 bpm", "80 bpm", "90 bpm", "100 bpm", "110 bpm", "120 bpm",
  "130 bpm", "140 bpm", "150 bpm"
]

const DESCRIPTORS = [
  "with warm analog sound", "with lush reverb", "with crisp production",
  "with layered textures", "with rich harmonies", "studio quality",
  "with deep bass", "with sparkling highs", "with punchy drums",
  "with wide stereo mix", "with vintage tone", "with modern production"
]

const STRUCTURES = [
  "building from minimal to full arrangement",
  "with a slow atmospheric intro leading into a driving rhythm",
  "starting sparse then layering instruments progressively",
  "with dynamic crescendos and quiet breakdowns",
  "alternating between intense sections and ambient interludes",
  "with a cinematic build throughout"
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
  const descriptor = pickOne(DESCRIPTORS)
  return `30-second ${genre} clip featuring ${instruments[0]} and ${instruments[1]}, ${mood} mood, ${tempo}, ${descriptor}`
}

function generateLyria3ProPrompt(): string {
  const genre = pickOne(GENRES)
  const instruments = pickRandom(INSTRUMENTS, 3)
  const mood = pickOne(MOODS)
  const tempo = pickOne(TEMPOS)
  const descriptor = pickOne(DESCRIPTORS)
  const structure = pickOne(STRUCTURES)
  const production = pickOne(PRODUCTION_STYLES)
  return `${genre} song featuring ${instruments.join(", ")}, ${mood} mood, ${tempo}. ${structure}. ${production}, ${descriptor}`
}

function generateMusicgenPrompt(): string {
  const genre = pickOne(GENRES)
  const instruments = pickRandom(INSTRUMENTS, 2)
  const mood = pickOne(MOODS)
  const tempo = pickOne(TEMPOS)
  const descriptor = pickOne(DESCRIPTORS)
  return `${genre} with ${instruments[0]} and ${instruments[1]}, ${mood}, ${tempo}, ${descriptor}`
}

export function generateRandomPrompt(model: ModelKey = "realtime"): string {
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
      return generateRealtimePrompt()
  }
}

export function getDefaultPrompt(model: ModelKey): string {
  switch (model) {
    case "realtime":
      return "Ambient electronic, Piano and Synth Pads, chill, 90 bpm"
    case "lyria3clip":
      return "30-second Neo-Soul clip featuring Rhodes Piano and Cello, dreamy mood, 95 bpm, with rich harmonies and warm vintage tone"
    case "lyria3pro":
      return "Neo-Soul song featuring Rhodes Piano, Cello, and Moog Synth, dreamy mood, 95 bpm. Building from minimal to full arrangement. Warm vintage analog production with subtle tape saturation, with rich harmonies"
    case "musicgen":
      return "Indie Electronic with Guitar and Synth Pads, upbeat, 120 bpm, with crisp production"
    default:
      return "Ambient electronic, Piano and Synth Pads, chill, 90 bpm"
  }
}