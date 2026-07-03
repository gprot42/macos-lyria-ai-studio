import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export const SCALES = [
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "dorian", label: "Dorian" },
  { value: "phrygian", label: "Phrygian" },
  { value: "lydian", label: "Lydian" },
  { value: "mixolydian", label: "Mixolydian" },
  { value: "aeolian", label: "Aeolian" },
  { value: "locrian", label: "Locrian" },
  { value: "pentatonic_major", label: "Pentatonic Major" },
  { value: "pentatonic_minor", label: "Pentatonic Minor" },
  { value: "blues", label: "Blues" },
  { value: "harmonic_minor", label: "Harmonic Minor" },
  { value: "melodic_minor", label: "Melodic Minor" },
]

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

export const INSTRUMENT_GROUPS = [
  { id: "drums", label: "Drums", icon: "drum" },
  { id: "bass", label: "Bass", icon: "bass" },
  { id: "melodic", label: "Melodic", icon: "music" },
  { id: "pads", label: "Pads", icon: "waves" },
  { id: "fx", label: "FX", icon: "sparkles" },
]
