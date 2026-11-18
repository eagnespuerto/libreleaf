//! LibreLeaf desktop shell. The editor itself is the web app in `../src`;
//! Rust provides the window, native file dialogs and file access.
//! Later releases add the Tectonic compile here (ADR 0002).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running LibreLeaf");
}
