#!/usr/bin/env bash
#
# Capacité APNs du projet Xcode généré.
#
# Comme son équivalent Android, ce script rejoue après `tauri ios init` ce que
# `src-tauri/gen/`, non versionné, ne peut pas conserver.
#
# `UIBackgroundModes` n'est pas ici : il vit dans `src-tauri/Info.ios.plist`,
# qui est versionné et que Tauri fusionne lui-même.
#
# Rappel de ce qui ne peut pas être automatisé : la capacité **Push
# Notifications** doit être activée sur l'App ID `app.joutes.mobile` dans le
# portail Apple Developer. Sans elle, `-allowProvisioningUpdates` régénère un
# profil sans `aps-environment` — au mieux la signature échoue, au pire elle
# passe et l'application ne reçoit jamais rien.
set -euo pipefail

# `production` même pour TestFlight : seul un build lancé depuis Xcode en
# développement utilise le bac à sable d'Apple, et la CI ne produit que des
# binaires App Store Connect.
ENVIRONMENT="${APS_ENVIRONMENT:-production}"

# Boucle `while read` et non `mapfile` : ce dernier est un builtin de bash 4,
# et macOS livre encore bash 3.2 — celui-là même qui exécute ce script, en
# local comme sur les agents `macos-latest`.
#
# Le `< <(...)` évite le sous-shell d'un tube, où le compteur ne survivrait pas
# à la fin de la boucle.
FOUND=0

while IFS= read -r file; do
  if /usr/libexec/PlistBuddy -c "Print :aps-environment" "$file" >/dev/null 2>&1; then
    /usr/libexec/PlistBuddy -c "Set :aps-environment $ENVIRONMENT" "$file"
  else
    /usr/libexec/PlistBuddy -c "Add :aps-environment string $ENVIRONMENT" "$file"
  fi
  echo "setup-ios-push: aps-environment=$ENVIRONMENT dans $file"
  FOUND=$((FOUND + 1))
done < <(find src-tauri/gen/apple -name "*.entitlements" 2>/dev/null || true)

if [ "$FOUND" -eq 0 ]; then
  echo "setup-ios-push: aucun fichier .entitlements dans src-tauri/gen/apple." >&2
  echo "  Le projet Xcode n'a pas été généré, ou le scaffolding de Tauri a changé." >&2
  exit 1
fi

echo "setup-ios-push: terminé."
