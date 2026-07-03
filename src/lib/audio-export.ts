export function encodeWavDirect(
  audioData: Float32Array,
  sampleRate: number = 48000
): Blob {
  console.log("[AudioExport] Direct WAV encoding:", audioData.length, "samples")
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = audioData.length * bytesPerSample
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, totalSize - 8, true)
  writeString(8, "WAVE")

  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  writeString(36, "data")
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]))
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, intSample, true)
    offset += 2
  }

  console.log("[AudioExport] WAV blob created:", totalSize, "bytes")
  return new Blob([buffer], { type: "audio/wav" })
}

export async function encodeToWav(
  audioData: Float32Array,
  sampleRate: number = 48000
): Promise<Blob> {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = audioData.length * bytesPerSample
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, totalSize - 8, true)
  writeString(8, "WAVE")

  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  writeString(36, "data")
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]))
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, intSample, true)
    offset += 2
  }

  return new Blob([buffer], { type: "audio/wav" })
}

export async function encodeToMp3(
  audioData: Float32Array,
  sampleRate: number = 48000,
  bitrate: number = 320
): Promise<Blob> {
  console.log(`[AudioExport] Starting MP3 encoding: ${audioData.length} samples, ${bitrate}kbps`)
  
  try {
    const lamejs = await import("lamejs")
    console.log("[AudioExport] lamejs loaded successfully")
    
    const samples = new Int16Array(audioData.length)
    for (let i = 0; i < audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]))
      samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    console.log("[AudioExport] Samples converted to Int16")

    const mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, bitrate)
    const mp3Chunks: Int8Array[] = []

    const blockSize = 1152
    for (let i = 0; i < samples.length; i += blockSize) {
      const chunk = samples.subarray(i, i + blockSize)
      const mp3buf = mp3Encoder.encodeBuffer(chunk)
      if (mp3buf.length > 0) {
        mp3Chunks.push(mp3buf)
      }
    }
    console.log("[AudioExport] Encoding complete, flushing...")

    const mp3End = mp3Encoder.flush()
    if (mp3End.length > 0) {
      mp3Chunks.push(mp3End)
    }

    console.log(`[AudioExport] MP3 encoded: ${mp3Chunks.length} chunks`)
    return new Blob(mp3Chunks as unknown as BlobPart[], { type: "audio/mp3" })
  } catch (err) {
    console.warn("[AudioExport] MP3 encoding failed, falling back to WAV:", err)
    return encodeToWav(audioData, sampleRate)
  }
}

export function encodeToWav24(
  audioData: Float32Array,
  sampleRate: number = 48000
): Blob {
  const numChannels = 1
  const bitsPerSample = 24
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = audioData.length * bytesPerSample
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, totalSize - 8, true)
  writeString(8, "WAVE")

  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  writeString(36, "data")
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]))
    const intSample = Math.round(sample * 0x7fffff)
    view.setUint8(offset, intSample & 0xff)
    view.setUint8(offset + 1, (intSample >> 8) & 0xff)
    view.setUint8(offset + 2, (intSample >> 16) & 0xff)
    offset += 3
  }

  return new Blob([buffer], { type: "audio/wav" })
}

function encodeToWavSync(
  audioData: Float32Array,
  sampleRate: number = 48000
): Blob {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = audioData.length * bytesPerSample
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, totalSize - 8, true)
  writeString(8, "WAVE")

  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  writeString(36, "data")
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]))
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, intSample, true)
    offset += 2
  }

  return new Blob([buffer], { type: "audio/wav" })
}

export async function saveAudioFile(
  audioData: Float32Array,
  format: "mp3-320" | "mp3-128" | "flac" | "wav",
  sampleRate: number = 48000
): Promise<Blob> {
  if (format === "mp3-320") {
    return encodeToMp3(audioData, sampleRate, 320)
  } else if (format === "mp3-128") {
    return encodeToMp3(audioData, sampleRate, 128)
  } else if (format === "flac") {
    return encodeToWav24(audioData, sampleRate) // 24-bit WAV as FLAC alternative
  } else {
    return encodeToWav(audioData, sampleRate)
  }
}
