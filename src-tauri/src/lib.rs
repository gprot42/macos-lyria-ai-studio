use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

mod audio_stream;
mod lyria_ws;
use audio_stream::{get_streamer, init_streamer};

const ENCRYPTION_KEY: &[u8; 32] = b"LyriaStudioSecretKey2024!@#$%^&*";

#[derive(Serialize, Deserialize, Default)]
pub struct Settings {
    pub api_key_encrypted: Option<String>,
    pub vertex_project_id: Option<String>,
    pub vertex_region: Option<String>,
    pub vertex_access_token_encrypted: Option<String>,
    pub lyria_model: Option<String>,
    pub show_api_key: bool,
    pub theme: String,
    pub presets: Vec<Preset>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub prompts: Vec<PromptWeight>,
    pub negative_prompt: String,
    pub bpm: u32,
    pub key: String,
    pub scale: String,
    pub density: f32,
    pub brightness: f32,
    pub guidance: f32,
    pub temperature: f32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PromptWeight {
    pub text: String,
    pub weight: f32,
}

fn get_settings_path() -> PathBuf {
    let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let app_dir = home_dir.join(".lyria-ai-studio");
    fs::create_dir_all(&app_dir).ok();
    app_dir.join("settings.json")
}

fn encrypt_string(plaintext: &str) -> Result<String, String> {
    let cipher = Aes256Gcm::new(ENCRYPTION_KEY.into());
    let mut rng = rand::rng();
    let nonce_bytes: [u8; 12] = rng.random();
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    let mut result = nonce_bytes.to_vec();
    result.extend(ciphertext);
    Ok(hex::encode(result))
}

fn decrypt_string(encrypted: &str) -> Result<String, String> {
    let data = hex::decode(encrypted).map_err(|e| format!("Hex decode failed: {}", e))?;
    
    if data.len() < 12 {
        return Err("Invalid encrypted data".to_string());
    }
    
    let (nonce_bytes, ciphertext) = data.split_at(12);
    let cipher = Aes256Gcm::new(ENCRYPTION_KEY.into());
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    
    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 conversion failed: {}", e))
}

#[tauri::command]
fn save_api_key(api_key: String) -> Result<(), String> {
    let encrypted = encrypt_string(&api_key)?;
    let mut settings = load_settings_internal().unwrap_or_default();
    settings.api_key_encrypted = Some(encrypted);
    save_settings_internal(&settings)
}

#[tauri::command]
fn get_api_key() -> Result<Option<String>, String> {
    let settings = load_settings_internal().unwrap_or_default();
    match settings.api_key_encrypted {
        Some(encrypted) => Ok(Some(decrypt_string(&encrypted)?)),
        None => Ok(None),
    }
}

#[tauri::command]
fn save_vertex_access_token(token: String) -> Result<(), String> {
    let encrypted = encrypt_string(&token)?;
    let mut settings = load_settings_internal().unwrap_or_default();
    settings.vertex_access_token_encrypted = Some(encrypted);
    save_settings_internal(&settings)
}

#[tauri::command]
fn get_vertex_access_token() -> Result<Option<String>, String> {
    let settings = load_settings_internal().unwrap_or_default();
    match settings.vertex_access_token_encrypted {
        Some(encrypted) => Ok(Some(decrypt_string(&encrypted)?)),
        None => Ok(None),
    }
}

#[tauri::command]
fn save_settings(settings_json: String) -> Result<(), String> {
    let mut settings: Settings = serde_json::from_str(&settings_json)
        .map_err(|e| format!("Failed to parse settings: {}", e))?;
    
    if let Some(existing) = load_settings_internal().ok() {
        settings.api_key_encrypted = existing.api_key_encrypted;
        if settings.vertex_access_token_encrypted.is_none() {
            settings.vertex_access_token_encrypted = existing.vertex_access_token_encrypted;
        }
    }
    
    save_settings_internal(&settings)
}

#[tauri::command]
fn load_settings() -> Result<String, String> {
    let settings = load_settings_internal().unwrap_or_default();
    serde_json::to_string(&settings).map_err(|e| format!("Failed to serialize settings: {}", e))
}

fn load_settings_internal() -> Result<Settings, String> {
    let path = get_settings_path();
    if !path.exists() {
        return Ok(Settings::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))
}

fn save_settings_internal(settings: &Settings) -> Result<(), String> {
    let path = get_settings_path();
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write settings: {}", e))
}

#[tauri::command]
fn save_preset(preset_json: String) -> Result<(), String> {
    let preset: Preset = serde_json::from_str(&preset_json)
        .map_err(|e| format!("Failed to parse preset: {}", e))?;
    
    let mut settings = load_settings_internal().unwrap_or_default();
    
    if let Some(pos) = settings.presets.iter().position(|p| p.id == preset.id) {
        settings.presets[pos] = preset;
    } else {
        settings.presets.push(preset);
    }
    
    save_settings_internal(&settings)
}

#[tauri::command]
fn delete_preset(preset_id: String) -> Result<(), String> {
    let mut settings = load_settings_internal().unwrap_or_default();
    settings.presets.retain(|p| p.id != preset_id);
    save_settings_internal(&settings)
}

#[tauri::command]
fn get_presets() -> Result<String, String> {
    let settings = load_settings_internal().unwrap_or_default();
    serde_json::to_string(&settings.presets).map_err(|e| format!("Failed to serialize presets: {}", e))
}

// Audio streaming commands
#[tauri::command]
fn audio_init() -> Result<(), String> {
    init_streamer()
}

#[tauri::command]
fn audio_write_chunk(audio_data: Vec<i16>) -> Result<usize, String> {
    let streamer = get_streamer();
    let mut guard = streamer.lock();
    match guard.as_mut() {
        Some(s) => s.write_chunk(&audio_data),
        None => Err("Audio streamer not initialized".to_string()),
    }
}

#[tauri::command]
fn audio_write_chunk_base64(audio_data_base64: String) -> Result<usize, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    // Decode base64 to bytes
    let bytes = STANDARD.decode(&audio_data_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    // Convert bytes to i16 samples (little-endian)
    let samples: Vec<i16> = bytes
        .chunks_exact(2)
        .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
        .collect();
    
    let streamer = get_streamer();
    let mut guard = streamer.lock();
    match guard.as_mut() {
        Some(s) => s.write_chunk(&samples),
        None => Err("Audio streamer not initialized".to_string()),
    }
}

#[tauri::command]
fn audio_start_playback() -> Result<(), String> {
    let streamer = get_streamer();
    let mut guard = streamer.lock();
    match guard.as_mut() {
        Some(s) => s.start_playback(),
        None => Err("Audio streamer not initialized".to_string()),
    }
}

#[tauri::command]
fn audio_stop_playback() -> Result<(), String> {
    let streamer = get_streamer();
    let mut guard = streamer.lock();
    if let Some(s) = guard.as_mut() {
        s.stop_playback();
    }
    Ok(())
}

#[tauri::command]
fn audio_pause_playback() -> Result<(), String> {
    // Pause not implemented in thread-based approach - just stop
    audio_stop_playback()
}

#[tauri::command]
fn audio_resume_playback() -> Result<(), String> {
    // Resume not implemented - need to restart playback
    audio_start_playback()
}

#[tauri::command]
fn audio_get_status() -> Result<serde_json::Value, String> {
    let streamer = get_streamer();
    let guard = streamer.lock();
    match guard.as_ref() {
        Some(s) => Ok(serde_json::json!({
            "isPlaying": s.is_playing(),
            "position": s.get_position(),
            "duration": s.get_duration(),
            "chunkCount": s.get_chunk_count(),
        })),
        None => Ok(serde_json::json!({
            "isPlaying": false,
            "position": 0.0,
            "duration": 0.0,
            "chunkCount": 0,
        })),
    }
}

#[tauri::command]
fn audio_clear() -> Result<(), String> {
    let streamer = get_streamer();
    let mut guard = streamer.lock();
    if let Some(s) = guard.as_mut() {
        s.clear();
    }
    Ok(())
}

#[tauri::command]
fn audio_export(output_path: String) -> Result<(), String> {
    let streamer = get_streamer();
    let guard = streamer.lock();
    match guard.as_ref() {
        Some(s) => s.export_to_file(&output_path),
        None => Err("Audio streamer not initialized".to_string()),
    }
}

#[tauri::command]
fn audio_export_format(output_path: String, format: String, bitrate: u32) -> Result<(), String> {
    let streamer = get_streamer();
    let guard = streamer.lock();
    match guard.as_ref() {
        Some(s) => s.export_to_file_with_format(&output_path, &format, bitrate),
        None => Err("Audio streamer not initialized".to_string()),
    }
}

#[tauri::command]
fn audio_get_samples() -> Result<Vec<i16>, String> {
    let streamer = get_streamer();
    let guard = streamer.lock();
    match guard.as_ref() {
        Some(s) => s.get_all_samples(),
        None => Err("Audio streamer not initialized".to_string()),
    }
}

// Rust-native Lyria generation (bypasses JavaScript entirely)
#[tauri::command]
fn lyria_start_generation(api_key: String, prompt: String, duration_seconds: u32) -> Result<(), String> {
    lyria_ws::start_generation(&api_key, &prompt, duration_seconds)
}

#[tauri::command]
fn lyria_stop_generation() -> Result<(), String> {
    lyria_ws::stop_generation()
}

#[tauri::command]
fn lyria_get_status() -> lyria_ws::GenerationStatus {
    lyria_ws::get_generation_status()
}

#[tauri::command]
fn lyria_is_generating() -> bool {
    lyria_ws::is_generating()
}

#[tauri::command]
fn js_log(level: String, message: String) {
    match level.as_str() {
        "error" => log::error!("[JS] {}", message),
        "warn" => log::warn!("[JS] {}", message),
        "info" => log::info!("[JS] {}", message),
        "debug" => log::debug!("[JS] {}", message),
        _ => log::info!("[JS] {}", message),
    }
}

#[tauri::command]
fn js_memory_report(heap_used: f64, heap_total: f64, chunk_count: u32, queue_size: u32) {
    log::info!(
        "[JS Memory] Heap: {:.1}MB / {:.1}MB ({:.0}%), Chunks: {}, Queue: {}",
        heap_used / 1_000_000.0,
        heap_total / 1_000_000.0,
        (heap_used / heap_total) * 100.0,
        chunk_count,
        queue_size
    );
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .setup(|_app| {
            log::info!("Lyria AI Studio starting...");
            log::info!("Dialog and FS plugins initialized");
            
            // Initialize audio streamer
            if let Err(e) = init_streamer() {
                log::error!("Failed to initialize audio streamer: {}", e);
            } else {
                log::info!("Audio streamer initialized");
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_api_key,
            get_api_key,
            save_vertex_access_token,
            get_vertex_access_token,
            save_settings,
            load_settings,
            save_preset,
            delete_preset,
            get_presets,
            audio_init,
            audio_write_chunk,
            audio_write_chunk_base64,
            audio_start_playback,
            audio_stop_playback,
            audio_pause_playback,
            audio_resume_playback,
            audio_get_status,
            audio_clear,
            audio_export,
            audio_export_format,
            audio_get_samples,
            lyria_start_generation,
            lyria_stop_generation,
            lyria_get_status,
            lyria_is_generating,
            js_log,
            js_memory_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
