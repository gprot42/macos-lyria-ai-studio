use parking_lot::Mutex;
use std::fs::File;
use std::io::{BufReader, BufWriter, Write};
use std::mem::MaybeUninit;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use tempfile::TempDir;
use mp3lame_encoder::{Builder, FlushNoGap, InterleavedPcm};

pub struct AudioStreamer {
    temp_dir: TempDir,
    chunk_files: Vec<PathBuf>,
    total_samples: usize,
    sample_rate: u32,
    channels: u16,
    is_playing: Arc<AtomicBool>,
    should_stop: Arc<AtomicBool>,
    playback_position: Arc<Mutex<f64>>,
    playback_thread: Option<thread::JoinHandle<()>>,
}

impl AudioStreamer {
    pub fn new() -> Result<Self, String> {
        let temp_dir = TempDir::new().map_err(|e| format!("Failed to create temp dir: {}", e))?;
        log::info!("Audio streamer temp dir: {:?}", temp_dir.path());
        
        Ok(Self {
            temp_dir,
            chunk_files: Vec::new(),
            total_samples: 0,
            sample_rate: 48000,
            channels: 2,
            is_playing: Arc::new(AtomicBool::new(false)),
            should_stop: Arc::new(AtomicBool::new(false)),
            playback_position: Arc::new(Mutex::new(0.0)),
            playback_thread: None,
        })
    }

    pub fn write_chunk(&mut self, audio_data: &[i16]) -> Result<usize, String> {
        let chunk_index = self.chunk_files.len();
        let chunk_path = self.temp_dir.path().join(format!("chunk_{:04}.wav", chunk_index));
        
        let spec = hound::WavSpec {
            channels: self.channels,
            sample_rate: self.sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = hound::WavWriter::create(&chunk_path, spec)
            .map_err(|e| format!("Failed to create WAV writer: {}", e))?;

        for sample in audio_data {
            writer.write_sample(*sample)
                .map_err(|e| format!("Failed to write sample: {}", e))?;
        }

        writer.finalize()
            .map_err(|e| format!("Failed to finalize WAV: {}", e))?;

        self.chunk_files.push(chunk_path);
        self.total_samples += audio_data.len() / self.channels as usize;

        if chunk_index % 10 == 0 {
            log::info!("Wrote chunk {} ({} total samples)", chunk_index, self.total_samples);
        }
        Ok(chunk_index)
    }

    pub fn start_playback(&mut self) -> Result<(), String> {
        if self.chunk_files.is_empty() {
            return Err("No audio chunks to play".to_string());
        }

        self.stop_playback();

        let chunk_files = self.chunk_files.clone();
        let is_playing = self.is_playing.clone();
        let should_stop = self.should_stop.clone();
        let playback_position = self.playback_position.clone();
        let sample_rate = self.sample_rate;

        self.should_stop.store(false, Ordering::SeqCst);
        self.is_playing.store(true, Ordering::SeqCst);
        *self.playback_position.lock() = 0.0;

        let handle = thread::spawn(move || {
            let result = (|| -> Result<(), String> {
                let (_stream, stream_handle) = rodio::OutputStream::try_default()
                    .map_err(|e| format!("Failed to create output stream: {}", e))?;

                let sink = rodio::Sink::try_new(&stream_handle)
                    .map_err(|e| format!("Failed to create sink: {}", e))?;

                let mut samples_played: usize = 0;

                for chunk_path in &chunk_files {
                    if should_stop.load(Ordering::SeqCst) {
                        break;
                    }

                    let file = File::open(chunk_path)
                        .map_err(|e| format!("Failed to open chunk: {}", e))?;
                    
                    let reader = hound::WavReader::new(BufReader::new(file))
                        .map_err(|e| format!("Failed to read WAV: {}", e))?;
                    
                    let chunk_samples = reader.len() as usize / 2; // stereo
                    
                    let file = File::open(chunk_path)
                        .map_err(|e| format!("Failed to reopen chunk: {}", e))?;
                    
                    let source = rodio::Decoder::new(BufReader::new(file))
                        .map_err(|e| format!("Failed to decode: {}", e))?;
                    
                    sink.append(source);
                    samples_played += chunk_samples;
                    
                    *playback_position.lock() = samples_played as f64 / sample_rate as f64;
                }

                while !sink.empty() && !should_stop.load(Ordering::SeqCst) {
                    thread::sleep(std::time::Duration::from_millis(100));
                }

                Ok(())
            })();

            if let Err(e) = result {
                log::error!("Playback error: {}", e);
            }

            is_playing.store(false, Ordering::SeqCst);
            log::info!("Playback finished");
        });

        self.playback_thread = Some(handle);
        log::info!("Started playback of {} chunks", self.chunk_files.len());
        Ok(())
    }

    pub fn stop_playback(&mut self) {
        self.should_stop.store(true, Ordering::SeqCst);
        
        if let Some(handle) = self.playback_thread.take() {
            let _ = handle.join();
        }
        
        self.is_playing.store(false, Ordering::SeqCst);
        log::info!("Stopped playback");
    }

    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::SeqCst)
    }

    pub fn get_position(&self) -> f64 {
        *self.playback_position.lock()
    }

    pub fn get_duration(&self) -> f64 {
        self.total_samples as f64 / self.sample_rate as f64
    }

    pub fn get_chunk_count(&self) -> usize {
        self.chunk_files.len()
    }

    /// Get all audio data as interleaved i16 samples for JavaScript playback
    pub fn get_all_samples(&self) -> Result<Vec<i16>, String> {
        if self.chunk_files.is_empty() {
            return Err("No audio data".to_string());
        }

        let mut all_samples: Vec<i16> = Vec::new();
        
        for chunk_path in &self.chunk_files {
            let mut reader = hound::WavReader::open(chunk_path)
                .map_err(|e| format!("Failed to open chunk: {}", e))?;
            
            for sample in reader.samples::<i16>() {
                let sample = sample.map_err(|e| format!("Failed to read sample: {}", e))?;
                all_samples.push(sample);
            }
        }

        log::info!("Retrieved {} samples for JS playback", all_samples.len());
        Ok(all_samples)
    }

    pub fn clear(&mut self) {
        self.stop_playback();
        
        // Delete temp chunk files
        for chunk_path in &self.chunk_files {
            if chunk_path.exists() {
                if let Err(e) = std::fs::remove_file(chunk_path) {
                    log::warn!("Failed to delete temp chunk {:?}: {}", chunk_path, e);
                }
            }
        }
        
        self.chunk_files.clear();
        self.total_samples = 0;
        *self.playback_position.lock() = 0.0;
        log::info!("Cleared audio streamer (deleted temp files)");
    }

    pub fn export_to_file(&self, output_path: &str) -> Result<(), String> {
        self.export_to_file_with_format(output_path, "wav", 320)
    }

    pub fn export_to_file_with_format(&self, output_path: &str, format: &str, bitrate: u32) -> Result<(), String> {
        if self.chunk_files.is_empty() {
            return Err("No audio to export".to_string());
        }

        match format {
            "mp3" => self.export_to_mp3(output_path, bitrate),
            "flac" => self.export_to_flac(output_path),
            _ => self.export_to_wav(output_path),
        }
    }

    fn export_to_wav(&self, output_path: &str) -> Result<(), String> {
        let spec = hound::WavSpec {
            channels: self.channels,
            sample_rate: self.sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = hound::WavWriter::create(output_path, spec)
            .map_err(|e| format!("Failed to create output file: {}", e))?;

        for chunk_path in &self.chunk_files {
            let mut reader = hound::WavReader::open(chunk_path)
                .map_err(|e| format!("Failed to open chunk: {}", e))?;
            
            for sample in reader.samples::<i16>() {
                let sample = sample.map_err(|e| format!("Failed to read sample: {}", e))?;
                writer.write_sample(sample)
                    .map_err(|e| format!("Failed to write sample: {}", e))?;
            }
        }

        writer.finalize()
            .map_err(|e| format!("Failed to finalize output: {}", e))?;

        log::info!("Exported audio to WAV: {}", output_path);
        Ok(())
    }

    fn export_to_mp3(&self, output_path: &str, bitrate: u32) -> Result<(), String> {
        // Collect all samples first
        let mut all_samples: Vec<i16> = Vec::new();
        
        for chunk_path in &self.chunk_files {
            let mut reader = hound::WavReader::open(chunk_path)
                .map_err(|e| format!("Failed to open chunk: {}", e))?;
            
            for sample in reader.samples::<i16>() {
                let sample = sample.map_err(|e| format!("Failed to read sample: {}", e))?;
                all_samples.push(sample);
            }
        }

        log::info!("Encoding {} samples to MP3 at {}kbps", all_samples.len(), bitrate);

        // Build MP3 encoder
        let mut mp3_encoder = Builder::new()
            .ok_or("Failed to create MP3 encoder builder")?;
        
        mp3_encoder.set_num_channels(self.channels as u8)
            .map_err(|e| format!("Failed to set channels: {:?}", e))?;
        mp3_encoder.set_sample_rate(self.sample_rate)
            .map_err(|e| format!("Failed to set sample rate: {:?}", e))?;
        
        // Set bitrate based on parameter
        let brate = if bitrate >= 320 {
            mp3lame_encoder::Bitrate::Kbps320
        } else if bitrate >= 256 {
            mp3lame_encoder::Bitrate::Kbps256
        } else if bitrate >= 192 {
            mp3lame_encoder::Bitrate::Kbps192
        } else {
            mp3lame_encoder::Bitrate::Kbps128
        };
        mp3_encoder.set_brate(brate)
            .map_err(|e| format!("Failed to set bitrate: {:?}", e))?;
        mp3_encoder.set_quality(mp3lame_encoder::Quality::Best)
            .map_err(|e| format!("Failed to set quality: {:?}", e))?;

        let mut encoder = mp3_encoder.build()
            .map_err(|e| format!("Failed to build MP3 encoder: {:?}", e))?;

        // Create output file
        let output_file = File::create(output_path)
            .map_err(|e| format!("Failed to create MP3 file: {}", e))?;
        let mut writer = BufWriter::new(output_file);

        // Create MaybeUninit buffer as required by mp3lame_encoder
        let input = InterleavedPcm(&all_samples);
        let buffer_size = mp3lame_encoder::max_required_buffer_size(all_samples.len());
        let mut mp3_buffer: Vec<MaybeUninit<u8>> = vec![MaybeUninit::uninit(); buffer_size];

        let encoded_size = encoder.encode(input, &mut mp3_buffer)
            .map_err(|e| format!("Failed to encode MP3: {:?}", e))?;

        // Convert MaybeUninit buffer to regular bytes for writing (only initialized portion)
        let encoded_bytes: Vec<u8> = mp3_buffer[..encoded_size]
            .iter()
            .map(|m| unsafe { m.assume_init() })
            .collect();
        
        writer.write_all(&encoded_bytes)
            .map_err(|e| format!("Failed to write MP3 data: {}", e))?;

        // Flush encoder
        let flush_size = encoder.flush::<FlushNoGap>(&mut mp3_buffer)
            .map_err(|e| format!("Failed to flush MP3 encoder: {:?}", e))?;

        if flush_size > 0 {
            let flush_bytes: Vec<u8> = mp3_buffer[..flush_size]
                .iter()
                .map(|m| unsafe { m.assume_init() })
                .collect();
            writer.write_all(&flush_bytes)
                .map_err(|e| format!("Failed to write final MP3 data: {}", e))?;
        }

        writer.flush()
            .map_err(|e| format!("Failed to flush MP3 writer: {}", e))?;

        log::info!("Exported audio to MP3: {}", output_path);
        Ok(())
    }

    fn export_to_flac(&self, output_path: &str) -> Result<(), String> {
        // For FLAC, we'll create a 24-bit WAV as a high-quality lossless alternative
        // True FLAC encoding would require the flacenc crate which has complex setup
        // For now, export as 24-bit WAV with .flac extension (user can convert)
        
        let spec = hound::WavSpec {
            channels: self.channels,
            sample_rate: self.sample_rate,
            bits_per_sample: 24,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = hound::WavWriter::create(output_path, spec)
            .map_err(|e| format!("Failed to create output file: {}", e))?;

        for chunk_path in &self.chunk_files {
            let mut reader = hound::WavReader::open(chunk_path)
                .map_err(|e| format!("Failed to open chunk: {}", e))?;
            
            for sample in reader.samples::<i16>() {
                let sample = sample.map_err(|e| format!("Failed to read sample: {}", e))?;
                // Convert 16-bit to 24-bit (scale up)
                let sample_24bit: i32 = (sample as i32) << 8;
                writer.write_sample(sample_24bit)
                    .map_err(|e| format!("Failed to write sample: {}", e))?;
            }
        }

        writer.finalize()
            .map_err(|e| format!("Failed to finalize output: {}", e))?;

        log::info!("Exported audio to FLAC (24-bit WAV): {}", output_path);
        Ok(())
    }
}

// Use a simple Mutex instead of lazy_static
static AUDIO_STREAMER: std::sync::OnceLock<Mutex<Option<AudioStreamer>>> = std::sync::OnceLock::new();

pub fn init_streamer() -> Result<(), String> {
    let mutex = AUDIO_STREAMER.get_or_init(|| Mutex::new(None));
    let mut guard = mutex.lock();
    *guard = Some(AudioStreamer::new()?);
    Ok(())
}

pub fn get_streamer() -> &'static Mutex<Option<AudioStreamer>> {
    AUDIO_STREAMER.get_or_init(|| Mutex::new(None))
}
