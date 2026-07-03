use base64::{Engine as _, engine::general_purpose::STANDARD};
use futures_util::{SinkExt, StreamExt};
use log::info;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message, tungstenite::http::Request, tungstenite::handshake::client::generate_key};

use crate::audio_stream::{get_streamer, init_streamer};

#[derive(Debug, Clone, Serialize)]
pub struct GenerationStatus {
    pub state: String,
    pub chunks_received: usize,
    pub total_samples: usize,
    pub duration_seconds: f64,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LyriaMessage {
    #[serde(rename = "setupComplete")]
    setup_complete: Option<bool>,
    #[serde(rename = "audioChunk")]
    audio_chunk: Option<AudioChunk>,
    #[serde(rename = "filteredPrompt")]
    filtered_prompt: Option<FilteredPrompt>,
}

#[derive(Debug, Deserialize)]
struct AudioChunk {
    data: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FilteredPrompt {
    #[serde(rename = "filteredReason")]
    filtered_reason: Option<String>,
}

#[derive(Debug, Serialize)]
struct SetupMessage {
    setup: SetupConfig,
}

#[derive(Debug, Serialize)]
struct SetupConfig {
    model: String,
}

#[derive(Debug, Serialize)]
struct PlayMessage {
    #[serde(rename = "liveMusicInput")]
    live_music_input: LiveMusicInput,
}

#[derive(Debug, Serialize)]
struct LiveMusicInput {
    play: PlayConfig,
}

#[derive(Debug, Serialize)]
struct PlayConfig {
    #[serde(rename = "musicGenerationConfig")]
    music_generation_config: MusicGenerationConfig,
}

#[derive(Debug, Serialize)]
struct MusicGenerationConfig {
    #[serde(rename = "textPrompt")]
    text_prompt: TextPrompt,
}

#[derive(Debug, Serialize)]
struct TextPrompt {
    text: String,
}

struct LyriaGenerator {
    is_running: AtomicBool,
    is_connected: AtomicBool,
    status: Mutex<GenerationStatus>,
    stop_signal: Mutex<Option<mpsc::Sender<()>>>,
}

impl LyriaGenerator {
    fn new() -> Self {
        Self {
            is_running: AtomicBool::new(false),
            is_connected: AtomicBool::new(false),
            status: Mutex::new(GenerationStatus {
                state: "idle".to_string(),
                chunks_received: 0,
                total_samples: 0,
                duration_seconds: 0.0,
                error: None,
            }),
            stop_signal: Mutex::new(None),
        }
    }

    fn update_status(&self, state: &str, chunks: usize, samples: usize, duration: f64, error: Option<String>) {
        let mut status = self.status.lock();
        status.state = state.to_string();
        status.chunks_received = chunks;
        status.total_samples = samples;
        status.duration_seconds = duration;
        status.error = error;
    }
}

lazy_static::lazy_static! {
    static ref GENERATOR: Arc<LyriaGenerator> = Arc::new(LyriaGenerator::new());
    static ref TOKIO_RT: tokio::runtime::Runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .expect("Failed to create tokio runtime");
}

pub fn start_generation(api_key: &str, prompt: &str, duration_seconds: u32) -> Result<(), String> {
    if GENERATOR.is_running.load(Ordering::SeqCst) {
        return Err("Generation already in progress".to_string());
    }

    init_streamer()?;

    let api_key = api_key.to_string();
    let prompt = prompt.to_string();
    let generator = Arc::clone(&GENERATOR);

    let (stop_tx, stop_rx) = mpsc::channel::<()>(1);
    *generator.stop_signal.lock() = Some(stop_tx);

    generator.is_running.store(true, Ordering::SeqCst);
    generator.update_status("connecting", 0, 0, 0.0, None);

    TOKIO_RT.spawn(async move {
        match run_generation(&api_key, &prompt, duration_seconds, stop_rx, &generator).await {
            Ok(_) => {
                info!("Generation completed successfully");
                generator.update_status("completed", 
                    generator.status.lock().chunks_received,
                    generator.status.lock().total_samples,
                    generator.status.lock().duration_seconds,
                    None);
            }
            Err(e) => {
                info!("Generation failed: {}", e);
                generator.update_status("error", 0, 0, 0.0, Some(e));
            }
        }
        generator.is_running.store(false, Ordering::SeqCst);
        generator.is_connected.store(false, Ordering::SeqCst);
        *generator.stop_signal.lock() = None;
    });

    Ok(())
}

async fn run_generation(
    api_key: &str,
    prompt: &str,
    target_duration: u32,
    mut stop_rx: mpsc::Receiver<()>,
    generator: &Arc<LyriaGenerator>,
) -> Result<(), String> {
    let encoded_key = urlencoding::encode(api_key);
    let url = format!(
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic?key={}",
        encoded_key
    );

    info!("Connecting to Lyria API...");
    info!("URL: wss://generativelanguage.googleapis.com/ws/...?key=<redacted>");

    let ws_key = generate_key();
    let request = Request::builder()
        .method("GET")
        .uri(&url)
        .header("Host", "generativelanguage.googleapis.com")
        .header("Connection", "Upgrade")
        .header("Upgrade", "websocket")
        .header("Sec-WebSocket-Version", "13")
        .header("Sec-WebSocket-Key", &ws_key)
        .header("User-Agent", "google-genai-sdk/1.30.0 lyria-ai-studio")
        .header("x-goog-api-client", "google-genai-sdk/1.30.0 lyria-ai-studio")
        .body(())
        .map_err(|e| format!("Failed to build request: {}", e))?;

    let (ws_stream, _) = connect_async(request)
        .await
        .map_err(|e| format!("WebSocket connection failed: {}", e))?;

    info!("WebSocket connected");
    generator.is_connected.store(true, Ordering::SeqCst);
    generator.update_status("connected", 0, 0, 0.0, None);

    let (mut write, mut read) = ws_stream.split();

    let setup_msg = SetupMessage {
        setup: SetupConfig {
            model: "models/lyria-realtime-exp".to_string(),
        },
    };
    let setup_json = serde_json::to_string(&setup_msg)
        .map_err(|e| format!("Failed to serialize setup: {}", e))?;
    
    info!("Sending setup: {}", setup_json);
    
    write.send(Message::Text(setup_json))
        .await
        .map_err(|e| format!("Failed to send setup: {}", e))?;

    info!("Sent setup message, waiting for setupComplete...");

    let mut _setup_complete = false;
    let mut chunks_received: usize = 0;
    let mut total_samples: usize = 0;
    let target_samples = (target_duration as usize) * 48000;
    let mut playback_started = false;
    const BUFFER_CHUNKS: usize = 15;

    loop {
        tokio::select! {
            _ = stop_rx.recv() => {
                info!("Stop signal received");
                break;
            }
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        info!("Received message: {}", if text.len() > 200 { &text[..200] } else { &text });
                        if let Ok(lyria_msg) = serde_json::from_str::<LyriaMessage>(&text) {
                            if lyria_msg.setup_complete.unwrap_or(false) {
                                info!("Setup complete, sending play command");
                                _setup_complete = true;
                                generator.update_status("generating", 0, 0, 0.0, None);

                                let play_msg = PlayMessage {
                                    live_music_input: LiveMusicInput {
                                        play: PlayConfig {
                                            music_generation_config: MusicGenerationConfig {
                                                text_prompt: TextPrompt {
                                                    text: prompt.to_string(),
                                                },
                                            },
                                        },
                                    },
                                };
                                let play_json = serde_json::to_string(&play_msg)
                                    .map_err(|e| format!("Failed to serialize play: {}", e))?;
                                
                                info!("Sending play command: {}", play_json);
                                write.send(Message::Text(play_json))
                                    .await
                                    .map_err(|e| format!("Failed to send play: {}", e))?;
                            }

                            if let Some(filtered) = lyria_msg.filtered_prompt {
                                let reason = filtered.filtered_reason.unwrap_or_else(|| "Unknown".to_string());
                                return Err(format!("Prompt filtered: {}", reason));
                            }

                            if let Some(chunk) = lyria_msg.audio_chunk {
                                if let Some(data) = chunk.data {
                                    let bytes = STANDARD.decode(&data)
                                        .map_err(|e| format!("Base64 decode failed: {}", e))?;
                                    
                                    let samples: Vec<i16> = bytes
                                        .chunks_exact(2)
                                        .map(|c| i16::from_le_bytes([c[0], c[1]]))
                                        .collect();

                                    let streamer = get_streamer();
                                    let mut guard = streamer.lock();
                                    if let Some(s) = guard.as_mut() {
                                        s.write_chunk(&samples)?;
                                    }

                                    chunks_received += 1;
                                    total_samples += samples.len() / 2;
                                    let duration = total_samples as f64 / 48000.0;

                                    if chunks_received % 10 == 0 {
                                        info!("Received chunk {}, {:.1}s generated", chunks_received, duration);
                                    }

                                    generator.update_status(
                                        if playback_started { "playing" } else { "buffering" },
                                        chunks_received,
                                        total_samples,
                                        duration,
                                        None
                                    );

                                    if chunks_received >= BUFFER_CHUNKS && !playback_started {
                                        info!("Buffer ready, starting playback");
                                        playback_started = true;
                                        let streamer = get_streamer();
                                        let mut guard = streamer.lock();
                                        if let Some(s) = guard.as_mut() {
                                            s.start_playback()?;
                                        }
                                    }

                                    if total_samples >= target_samples {
                                        info!("Target duration reached ({} samples)", total_samples);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    Some(Ok(Message::Close(frame))) => {
                        if let Some(cf) = frame {
                            info!("WebSocket closed by server: code={:?}, reason={}", cf.code, cf.reason);
                            if !cf.reason.is_empty() {
                                return Err(format!("Server closed connection: {}", cf.reason));
                            }
                        } else {
                            info!("WebSocket closed by server (no frame)");
                        }
                        break;
                    }
                    Some(Err(e)) => {
                        return Err(format!("WebSocket error: {}", e));
                    }
                    None => {
                        info!("WebSocket stream ended");
                        break;
                    }
                    _ => {}
                }
            }
        }
    }

    Ok(())
}

pub fn stop_generation() -> Result<(), String> {
    if let Some(tx) = GENERATOR.stop_signal.lock().take() {
        let _ = tx.blocking_send(());
    }
    
    let streamer = get_streamer();
    let mut guard = streamer.lock();
    if let Some(s) = guard.as_mut() {
        s.stop_playback();
    }

    GENERATOR.is_running.store(false, Ordering::SeqCst);
    GENERATOR.update_status("stopped", 0, 0, 0.0, None);
    
    Ok(())
}

pub fn get_generation_status() -> GenerationStatus {
    GENERATOR.status.lock().clone()
}

pub fn is_generating() -> bool {
    GENERATOR.is_running.load(Ordering::SeqCst)
}
