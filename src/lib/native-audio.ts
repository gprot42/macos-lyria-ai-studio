import { invoke } from "@tauri-apps/api/core"

export interface AudioStatus {
  isPlaying: boolean
  position: number
  duration: number
  chunkCount: number
}

export async function audioInit(): Promise<void> {
  await invoke("audio_init")
}

// For native mode: pass base64 directly to Rust (no JS decoding)
export async function audioWriteChunkBase64(base64Data: string): Promise<number> {
  return await invoke<number>("audio_write_chunk_base64", { audioDataBase64: base64Data })
}

// Legacy: for Web Audio mode compatibility
export async function audioWriteChunk(audioData: Int16Array): Promise<number> {
  const uint8View = new Uint8Array(audioData.buffer, audioData.byteOffset, audioData.byteLength)
  const base64 = uint8ArrayToBase64Chunked(uint8View)
  return await invoke<number>("audio_write_chunk_base64", { audioDataBase64: base64 })
}

function uint8ArrayToBase64Chunked(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length))
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }
  return btoa(binary)
}

export async function audioStartPlayback(): Promise<void> {
  await invoke("audio_start_playback")
}

export async function audioStopPlayback(): Promise<void> {
  await invoke("audio_stop_playback")
}

export async function audioPausePlayback(): Promise<void> {
  await invoke("audio_pause_playback")
}

export async function audioResumePlayback(): Promise<void> {
  await invoke("audio_resume_playback")
}

export async function audioGetStatus(): Promise<AudioStatus> {
  return await invoke<AudioStatus>("audio_get_status")
}

export async function audioClear(): Promise<void> {
  await invoke("audio_clear")
}

export async function audioGetSamples(): Promise<Int16Array> {
  const samples = await invoke<number[]>("audio_get_samples")
  return new Int16Array(samples)
}

export async function audioExport(outputPath: string): Promise<void> {
  await invoke("audio_export", { outputPath })
}

export async function audioExportFormat(outputPath: string, format: string, bitrate: number): Promise<void> {
  await invoke("audio_export_format", { outputPath, format, bitrate })
}

export function floatToInt16(floatData: Float32Array): Int16Array {
  const int16Data = new Int16Array(floatData.length)
  for (let i = 0; i < floatData.length; i++) {
    const s = Math.max(-1, Math.min(1, floatData[i]))
    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16Data
}

export function convertStereoToInt16(leftChannel: Float32Array, rightChannel: Float32Array): Int16Array {
  const length = leftChannel.length
  const int16Data = new Int16Array(length * 2)
  
  for (let i = 0; i < length; i++) {
    const left = Math.max(-1, Math.min(1, leftChannel[i]))
    const right = Math.max(-1, Math.min(1, rightChannel[i]))
    int16Data[i * 2] = left < 0 ? left * 0x8000 : left * 0x7fff
    int16Data[i * 2 + 1] = right < 0 ? right * 0x8000 : right * 0x7fff
  }
  
  return int16Data
}
