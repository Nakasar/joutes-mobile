#!/usr/bin/env bash
#
# Configuration Firebase du projet Android généré.
#
# `src-tauri/gen/` n'est pas versionné : `tauri android init` le recrée à chaque
# construction et écrase tout ce qu'on y aurait déposé. Ce script rejoue donc
# les trois retouches nécessaires au push, **après** l'init — exactement comme
# l'étape « Apply Joutes app icon » rejoue les icônes, et pour la même raison.
#
# Il est idempotent : le relancer sur un projet déjà configuré ne fait rien.
#
# Entrée : GOOGLE_SERVICES_JSON, le contenu base64 du google-services.json du
# projet Firebase (secret du dépôt).
set -euo pipefail

GEN="src-tauri/gen/android"
APP_GRADLE="$GEN/app/build.gradle.kts"
ROOT_GRADLE="$GEN/build.gradle.kts"
MANIFEST="$GEN/app/src/main/AndroidManifest.xml"

# Si Tauri renomme un de ces fichiers, il vaut mieux que la construction casse
# franchement que de produire un APK muet dont personne ne comprendra le silence.
for file in "$APP_GRADLE" "$ROOT_GRADLE" "$MANIFEST"; do
  if [ ! -f "$file" ]; then
    echo "setup-android-push: fichier attendu introuvable : $file" >&2
    echo "  Le scaffolding de Tauri a changé — le script doit être mis à jour." >&2
    exit 1
  fi
done

if [ -z "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "setup-android-push: GOOGLE_SERVICES_JSON absent, push Android non configuré." >&2
  exit 1
fi

echo "$GOOGLE_SERVICES_JSON" | base64 -d > "$GEN/app/google-services.json"
echo "setup-android-push: google-services.json déposé."

# Le plugin Gradle de Google, déclaré à la racine puis appliqué à l'application.
if ! grep -q "com.google.gms:google-services" "$ROOT_GRADLE"; then
  python3 - "$ROOT_GRADLE" <<'PY'
import re, sys

path = sys.argv[1]
source = open(path, encoding="utf-8").read()
classpath = '        classpath("com.google.gms:google-services:4.4.2")\n'

# On vise le bloc `dependencies` du `buildscript`, seul endroit où un classpath
# a un sens. S'il n'y a pas de `buildscript`, on en ajoute un en tête.
match = re.search(r"buildscript\s*\{.*?dependencies\s*\{\n", source, re.S)
if match:
    source = source[: match.end()] + classpath + source[match.end() :]
else:
    source = (
        "buildscript {\n    repositories {\n        google()\n        mavenCentral()\n    }\n"
        "    dependencies {\n" + classpath + "    }\n}\n\n" + source
    )

open(path, "w", encoding="utf-8").write(source)
PY
  echo "setup-android-push: classpath Google Services ajouté."
fi

if ! grep -q "com.google.gms.google-services" "$APP_GRADLE"; then
  printf '\napply(plugin = "com.google.gms.google-services")\n' >> "$APP_GRADLE"
  echo "setup-android-push: plugin Google Services appliqué."
fi

# Android 13 et au-delà : sans cette permission au manifeste, la demande à
# l'exécution rend « denied » sans jamais afficher d'invite à l'utilisateur.
if ! grep -q "android.permission.POST_NOTIFICATIONS" "$MANIFEST"; then
  python3 - "$MANIFEST" <<'PY'
import sys

path = sys.argv[1]
source = open(path, encoding="utf-8").read()
permission = '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n'
marker = ">"
index = source.index(marker, source.index("<manifest")) + 1

open(path, "w", encoding="utf-8").write(source[:index] + "\n" + permission + source[index:])
PY
  echo "setup-android-push: permission POST_NOTIFICATIONS ajoutée."
fi

# Le canal par défaut des notifications poussées. Le serveur le nomme déjà dans
# chaque message (`android.notification.channel_id`) ; cette méta-donnée couvre
# ce qu'il ne nomme pas — un message d'une version antérieure de l'API. Sans
# elle, Firebase range la notification dans son canal de repli « Divers », sans
# bandeau ni son. L'identifiant doit rester celui de `PUSH_CHANNEL_ID`
# (`src/lib/push.ts`), qui crée le canal au démarrage de l'application.
if ! grep -q "default_notification_channel_id" "$MANIFEST"; then
  python3 - "$MANIFEST" <<'PY'
import sys

path = sys.argv[1]
source = open(path, encoding="utf-8").read()
meta = (
    '        <meta-data\n'
    '            android:name="com.google.firebase.messaging.default_notification_channel_id"\n'
    '            android:value="joutes-alerts" />\n'
)
# On insère au début de la ligne qui ferme `<application>`, pour ne pas hériter
# de son indentation.
index = source.rindex("\n", 0, source.index("</application>")) + 1

open(path, "w", encoding="utf-8").write(source[:index] + meta + source[index:])
PY
  echo "setup-android-push: canal de notification par défaut déclaré."
fi

echo "setup-android-push: terminé."
