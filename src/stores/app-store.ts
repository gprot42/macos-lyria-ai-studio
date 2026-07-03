import { create } from "zustand"
import { getDefaultPrompt } from "@/lib/random-prompt"
import { getTrackLengthForModel, type LyriaModelKey, type ModelKey } from "@/lib/constants"

function extractBpmFromText(text: string): number | null {
  const patterns = [
    /(\d{2,3})\s*bpm/i,
    /bpm\s*[:\-]?\s*(\d{2,3})/i,
    /tempo\s*[:\-]?\s*(\d{2,3})/i,
    /(\d{2,3})\s*beats?\s*per\s*min/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const bpm = parseInt(match[1], 10)
      if (bpm >= 60 && bpm <= 200) {
        return bpm
      }
    }
  }
  return null
}

function extractKeyFromText(text: string): { key: string; scale: string } | null {
  const keyPattern = /\b([A-G])\s*(#|sharp|flat|b)?\s*(maj|major|min|minor|m)?\b/i
  const match = text.match(keyPattern)
  
  if (match) {
    let key = match[1].toUpperCase()
    const modifier = match[2]?.toLowerCase()
    const scaleType = match[3]?.toLowerCase()
    
    if (modifier === '#' || modifier === 'sharp') {
      key = key + '#'
    } else if (modifier === 'b' || modifier === 'flat') {
      const flatToSharp: Record<string, string> = {
        'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
      }
      key = flatToSharp[key + 'b'] || key
    }
    
    const scale = (scaleType === 'min' || scaleType === 'minor' || scaleType === 'm') 
      ? 'Minor' 
      : 'Major'
    
    return { key, scale }
  }
  return null
}

export interface PromptWeight {
  id: string
  text: string
  weight: number
}

export interface Preset {
  id: string
  name: string
  prompts: PromptWeight[]
  negativePrompt: string
  bpm: number
  key: string
  scale: string
  density: number
  brightness: number
  guidance: number
  temperature: number
  instrumentMutes: Record<string, boolean>
}

export interface SavedTrack {
  id: string
  name: string
  path: string
  duration: number
  createdAt: number
}

export interface VocalTrack {
  id: string
  name: string
  file: File | null
  volume: number
  pan: number
  muted: boolean
  startTime: number // Start time in seconds (when to insert the vocal in the track)
}

interface AppState {
  isPlaying: boolean
  isGenerating: boolean
  isRecording: boolean
  isConnecting: boolean
  isPlayingBack: boolean
  connectionStatus: string | null
  connectionError: string | null
  elapsedTime: number
  trackLength: number
  preGenerateMode: boolean
  selectedModel: ModelKey
  lyriaModel: LyriaModelKey
  vertexProjectId: string
  vertexRegion: string
  vertexAccessToken: string
  huggingFaceToken: string
  musicgenModelSize: "small" | "medium" | "large"
  prompts: PromptWeight[]
  negativePrompt: string
  bpm: number
  key: string
  scale: string
  density: number
  brightness: number
  guidance: number
  temperature: number
  instrumentMutes: Record<string, boolean>
  instrumentSolos: Record<string, boolean>
  vocalTracks: VocalTrack[]
  savedTracks: SavedTrack[]
  currentPlayingTrackId: string | null
  presets: Preset[]
  activePresetId: string | null
  apiKey: string | null
  showApiKey: boolean
  theme: "tokyo-night" | "dark" | "light"
  settingsOpen: boolean
  analyzerData: Float32Array | null
  waveformData: Float32Array | null
  hasCapturedAudio: boolean

  setIsPlaying: (playing: boolean) => void
  setIsGenerating: (generating: boolean) => void
  setIsRecording: (recording: boolean) => void
  setIsConnecting: (connecting: boolean) => void
  setIsPlayingBack: (playingBack: boolean) => void
  setConnectionStatus: (status: string | null) => void
  setConnectionError: (error: string | null) => void
  setElapsedTime: (time: number) => void
  setTrackLength: (length: number) => void
  setPreGenerateMode: (mode: boolean) => void
  setSelectedModel: (model: ModelKey) => void
  setLyriaModel: (model: LyriaModelKey) => void
  setVertexProjectId: (projectId: string) => void
  setVertexRegion: (region: string) => void
  setVertexAccessToken: (token: string) => void
  setHuggingFaceToken: (token: string) => void
  setMusicgenModelSize: (size: "small" | "medium" | "large") => void
  addPrompt: () => void
  updatePrompt: (id: string, updates: Partial<PromptWeight>) => void
  removePrompt: (id: string) => void
  setNegativePrompt: (prompt: string) => void
  setBpm: (bpm: number) => void
  setKey: (key: string) => void
  setScale: (scale: string) => void
  setDensity: (density: number) => void
  setBrightness: (brightness: number) => void
  setGuidance: (guidance: number) => void
  setTemperature: (temperature: number) => void
  toggleInstrumentMute: (id: string) => void
  toggleInstrumentSolo: (id: string) => void
  addVocalTrack: () => void
  updateVocalTrack: (id: string, updates: Partial<VocalTrack>) => void
  removeVocalTrack: (id: string) => void
  addSavedTrack: (track: SavedTrack) => void
  removeSavedTrack: (id: string) => void
  setSavedTracks: (tracks: SavedTrack[]) => void
  setCurrentPlayingTrackId: (id: string | null) => void
  setPresets: (presets: Preset[]) => void
  setActivePreset: (id: string | null) => void
  loadPreset: (preset: Preset) => void
  setApiKey: (key: string | null) => void
  setShowApiKey: (show: boolean) => void
  setTheme: (theme: "tokyo-night" | "dark" | "light") => void
  setSettingsOpen: (open: boolean) => void
  setAnalyzerData: (data: Float32Array | null) => void
  setWaveformData: (data: Float32Array | null) => void
  setHasCapturedAudio: (has: boolean) => void
  getCurrentSettings: () => Omit<Preset, "id" | "name">
}

export const useAppStore = create<AppState>((set, get) => ({
  isPlaying: false,
  isGenerating: false,
  isRecording: false,
  isConnecting: false,
  isPlayingBack: false,
  connectionStatus: null,
  connectionError: null,
  elapsedTime: 0,
  trackLength: 15,
  preGenerateMode: false,
  selectedModel: "realtime",
  lyriaModel: "realtime",
  vertexProjectId: "",
  vertexRegion: "us-central1",
  vertexAccessToken: "",
  huggingFaceToken: "",
  musicgenModelSize: "medium",
  prompts: [{ id: "1", text: "Ambient electronic, Piano and Synth Pads, chill, 90 bpm", weight: 1.0 }],
  negativePrompt: "",
  bpm: 120,
  key: "A",
  scale: "minor",
  density: 0.5,
  brightness: 0.5,
  guidance: 3.0,
  temperature: 0.8,
  instrumentMutes: {},
  instrumentSolos: {},
  vocalTracks: [],
  savedTracks: [],
  currentPlayingTrackId: null,
  presets: [],
  activePresetId: null,
  apiKey: null,
  showApiKey: false,
  theme: "tokyo-night",
  settingsOpen: false,
  analyzerData: null,
  waveformData: null,
  hasCapturedAudio: false,

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setIsConnecting: (connecting) => set({ isConnecting: connecting }),
  setIsPlayingBack: (playingBack) => set({ isPlayingBack: playingBack }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setConnectionError: (error) => set({ connectionError: error }),
  setElapsedTime: (time) => set({ elapsedTime: time }),
  setTrackLength: (length) => set({ trackLength: length }),
  setPreGenerateMode: (mode) => set({ preGenerateMode: mode }),
  setSelectedModel: (model) => set((state) => ({
    selectedModel: model,
    connectionError: null,
    trackLength: getTrackLengthForModel(model, state.trackLength),
    ...(model === "realtime" || model === "lyria3clip" || model === "lyria3pro"
      ? { lyriaModel: model }
      : {}),
  })),
  setLyriaModel: (model) => set((state) => {
    const currentText = state.prompts[0]?.text?.trim() || ""
    const isDefault = !currentText || currentText === getDefaultPrompt(state.lyriaModel)
    const newPrompt = isDefault ? getDefaultPrompt(model) : currentText
    return {
      lyriaModel: model,
      connectionError: null,
      selectedModel: model,
      trackLength: getTrackLengthForModel(model, state.trackLength),
      prompts: [{ ...state.prompts[0], text: newPrompt }, ...state.prompts.slice(1)],
    }
  }),
  setVertexProjectId: (projectId) => set({ vertexProjectId: projectId }),
  setVertexRegion: (region) => set({ vertexRegion: region }),
  setVertexAccessToken: (token) => set({ vertexAccessToken: token }),
  setHuggingFaceToken: (token) => set({ huggingFaceToken: token }),
  setMusicgenModelSize: (size) => set({ musicgenModelSize: size }),

  addPrompt: () =>
    set((state) => ({
      prompts: [
        ...state.prompts,
        { id: `${Date.now()}`, text: "", weight: 0.5 },
      ],
    })),

  updatePrompt: (id, updates) =>
    set((state) => {
      const newState: Partial<AppState> = {
        prompts: state.prompts.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      }
      
      if (updates.text) {
        const detectedBpm = extractBpmFromText(updates.text)
        if (detectedBpm !== null && detectedBpm !== state.bpm) {
          newState.bpm = detectedBpm
        }
        
        const detectedKey = extractKeyFromText(updates.text)
        if (detectedKey) {
          if (detectedKey.key !== state.key) {
            newState.key = detectedKey.key
          }
          if (detectedKey.scale !== state.scale) {
            newState.scale = detectedKey.scale
          }
        }
      }
      
      return newState
    }),

  removePrompt: (id) =>
    set((state) => ({
      prompts: state.prompts.filter((p) => p.id !== id),
    })),

  setNegativePrompt: (prompt) => set({ negativePrompt: prompt }),
  setBpm: (bpm) => set({ bpm }),
  setKey: (key) => set({ key }),
  setScale: (scale) => set({ scale }),
  setDensity: (density) => set({ density }),
  setBrightness: (brightness) => set({ brightness }),
  setGuidance: (guidance) => set({ guidance }),
  setTemperature: (temperature) => set({ temperature }),

  toggleInstrumentMute: (id) =>
    set((state) => ({
      instrumentMutes: {
        ...state.instrumentMutes,
        [id]: !state.instrumentMutes[id],
      },
    })),

  toggleInstrumentSolo: (id) =>
    set((state) => ({
      instrumentSolos: {
        ...state.instrumentSolos,
        [id]: !state.instrumentSolos[id],
      },
    })),

  addVocalTrack: () =>
    set((state) => ({
      vocalTracks: [
        ...state.vocalTracks,
        {
          id: `${Date.now()}`,
          name: `Vocal ${state.vocalTracks.length + 1}`,
          file: null,
          volume: 1.0,
          pan: 0,
          muted: false,
          startTime: 0,
        },
      ],
    })),

  updateVocalTrack: (id, updates) =>
    set((state) => ({
      vocalTracks: state.vocalTracks.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

  removeVocalTrack: (id) =>
    set((state) => ({
      vocalTracks: state.vocalTracks.filter((t) => t.id !== id),
    })),

  addSavedTrack: (track) =>
    set((state) => ({
      savedTracks: [track, ...state.savedTracks].slice(0, 20),
    })),

  removeSavedTrack: (id) =>
    set((state) => ({
      savedTracks: state.savedTracks.filter((t) => t.id !== id),
    })),

  setSavedTracks: (tracks) => set({ savedTracks: tracks }),
  
  setCurrentPlayingTrackId: (id) => set({ currentPlayingTrackId: id }),

  setPresets: (presets) => set({ presets }),
  setActivePreset: (id) => set({ activePresetId: id }),

  loadPreset: (preset) =>
    set({
      prompts: preset.prompts.map((p, i) => ({ ...p, id: `${i}` })),
      negativePrompt: preset.negativePrompt,
      bpm: preset.bpm,
      key: preset.key,
      scale: preset.scale,
      density: preset.density,
      brightness: preset.brightness,
      guidance: preset.guidance,
      temperature: preset.temperature,
      instrumentMutes: preset.instrumentMutes,
      activePresetId: preset.id,
    }),

  setApiKey: (key) => set({ apiKey: key }),
  setShowApiKey: (show) => set({ showApiKey: show }),
  setTheme: (theme) => set({ theme }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setAnalyzerData: (data) => set({ analyzerData: data }),
  setWaveformData: (data) => set({ waveformData: data }),
  setHasCapturedAudio: (has) => set({ hasCapturedAudio: has }),

  getCurrentSettings: () => {
    const state = get()
    return {
      prompts: state.prompts,
      negativePrompt: state.negativePrompt,
      bpm: state.bpm,
      key: state.key,
      scale: state.scale,
      density: state.density,
      brightness: state.brightness,
      guidance: state.guidance,
      temperature: state.temperature,
      instrumentMutes: state.instrumentMutes,
    }
  },
}))
