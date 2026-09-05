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

/// Les marges des barres système, en pixels CSS.
///
/// Android 15 impose le mode *edge-to-edge* aux applications qui ciblent
/// l'API 35 : le WebView est dessiné sous la barre d'état **et** sous la barre
/// de navigation, sans le déclarer — `env(safe-area-inset-*)` y vaut zéro. La
/// barre d'onglets se retrouvait donc sous les trois boutons de navigation.
/// Un plancher fixe ne convient pas : quarante-huit points en navigation à
/// trois boutons, une vingtaine en navigation gestuelle.
///
/// D'où cette commande, qui demande au natif ce qu'il sait : les marges du
/// `WindowInsets` de la racine, converties en pixels CSS par la densité de
/// l'écran (dans un WebView réglé sur `width=device-width`, le pixel CSS est le
/// pixel indépendant de la densité). Hors Android, tout vaut zéro : iOS
/// renseigne déjà `env()` et la feuille de style retient le maximum des deux.
#[derive(serde::Serialize, Default, Clone, Copy)]
struct SystemInsets {
    top: f32,
    bottom: f32,
    left: f32,
    right: f32,
}

#[cfg(target_os = "android")]
fn read_system_insets(
    env: &mut jni::JNIEnv,
    webview: &jni::objects::JObject,
) -> jni::errors::Result<SystemInsets> {
    use jni::objects::JValue;

    let insets = env
        .call_method(webview, "getRootWindowInsets", "()Landroid/view/WindowInsets;", &[])?
        .l()?;
    if insets.is_null() {
        return Ok(SystemInsets::default());
    }

    // `WindowInsets.Type` n'existe qu'à partir de l'API 30 ; en dessous, les
    // accesseurs historiques répondent la même chose pour les barres système.
    let sdk = env
        .get_static_field("android/os/Build$VERSION", "SDK_INT", "I")?
        .i()?;

    let (top, bottom, left, right) = if sdk >= 30 {
        let bars = env
            .call_static_method("android/view/WindowInsets$Type", "systemBars", "()I", &[])?
            .i()?;
        let cutout = env
            .call_static_method("android/view/WindowInsets$Type", "displayCutout", "()I", &[])?
            .i()?;
        let both = env
            .call_method(
                &insets,
                "getInsets",
                "(I)Landroid/graphics/Insets;",
                &[JValue::Int(bars | cutout)],
            )?
            .l()?;
        (
            env.get_field(&both, "top", "I")?.i()?,
            env.get_field(&both, "bottom", "I")?.i()?,
            env.get_field(&both, "left", "I")?.i()?,
            env.get_field(&both, "right", "I")?.i()?,
        )
    } else {
        (
            env.call_method(&insets, "getSystemWindowInsetTop", "()I", &[])?.i()?,
            env.call_method(&insets, "getSystemWindowInsetBottom", "()I", &[])?.i()?,
            env.call_method(&insets, "getSystemWindowInsetLeft", "()I", &[])?.i()?,
            env.call_method(&insets, "getSystemWindowInsetRight", "()I", &[])?.i()?,
        )
    };

    let context = env
        .call_method(webview, "getContext", "()Landroid/content/Context;", &[])?
        .l()?;
    let resources = env
        .call_method(&context, "getResources", "()Landroid/content/res/Resources;", &[])?
        .l()?;
    let metrics = env
        .call_method(&resources, "getDisplayMetrics", "()Landroid/util/DisplayMetrics;", &[])?
        .l()?;
    let density = env.get_field(&metrics, "density", "F")?.f()?;
    let density = if density > 0.0 { density } else { 1.0 };

    Ok(SystemInsets {
        top: top as f32 / density,
        bottom: bottom as f32 / density,
        left: left as f32 / density,
        right: right as f32 / density,
    })
}

/// Voir `SystemInsets`. `async` pour la même raison que la commande du dessus :
/// l'attente de la réponse du fil principal ne doit pas se faire sur lui.
#[cfg(target_os = "android")]
#[tauri::command]
async fn android_system_insets(webview: tauri::Webview) -> Result<SystemInsets, String> {
    let (sender, receiver) = std::sync::mpsc::channel::<Result<SystemInsets, String>>();

    webview
        .with_webview(move |platform| {
            platform.jni_handle().exec(move |env, _activity, webview| {
                let result = read_system_insets(env, webview).map_err(|error| error.to_string());
                let _ = sender.send(result);
            });
        })
        .map_err(|error| error.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(std::time::Duration::from_secs(5))
            .map_err(|error| error.to_string())?
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn android_system_insets() -> Result<SystemInsets, String> {
    Ok(SystemInsets::default())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_barcode_scanner::init())
        .plugin(tauri_plugin_notifications::init());

    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        set_push_click_listener_active,
        android_system_insets
    ]);

    #[cfg(not(mobile))]
    let builder = builder.invoke_handler(tauri::generate_handler![android_system_insets]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
