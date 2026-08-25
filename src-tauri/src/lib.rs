/// Active ou désactive l'écouteur natif des touchers de notification.
///
/// Doublon délibéré de `plugin:notifications|set_click_listener_active`, et la
/// raison tient à un seul mot : la commande du plugin n'est pas `async`. Tauri
/// exécute les commandes non-`async` **sur le fil principal**, et celle-là y
/// appelle `run_mobile_plugin`, qui bloque le fil appelant jusqu'à la réponse
/// de Swift.
///
/// Sur iOS, cette réponse ne peut pas arriver. Swift traite l'appel sur sa file
/// `ipc` et, s'il gardait un toucher en attente — le cas d'une application
/// ouverte *depuis* une notification — le remet d'abord au JavaScript par un
/// `Channel`, dont l'envoi passe par un `eval` qui attend la boucle
/// d'événements du fil principal. Ce fil, lui, attend Swift. Les deux
/// s'attendent, et l'application gèle quelques instants après le démarrage.
///
/// `async` suffit à dénouer : l'attente part sur le runtime asynchrone, le fil
/// principal reste libre de servir l'`eval`, Swift finit son travail et répond.
/// `spawn_blocking` par-dessus, parce que l'attente est bloquante et n'a rien à
/// faire sur un fil d'exécution de tâches.
#[cfg(mobile)]
#[tauri::command]
async fn set_push_click_listener_active(app: tauri::AppHandle, active: bool) -> Result<(), String> {
    use tauri_plugin_notifications::NotificationsExt;

    tauri::async_runtime::spawn_blocking(move || {
        app.notifications()
            .set_click_listener_active(active)
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_barcode_scanner::init())
        .plugin(tauri_plugin_notifications::init());

    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![set_push_click_listener_active]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
