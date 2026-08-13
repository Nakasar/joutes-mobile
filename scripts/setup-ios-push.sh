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

mapfile -t ENTITLEMENTS < <(find src-tauri/gen/apple -name "*.entitlements" 2>/dev/null || true)

if [ "${#ENTITLEMENTS[@]}" -eq 0 ]; then
  echo "setup-ios-push: aucun fichier .entitlements dans src-tauri/gen/apple." >&2
  echo "  Le scaffolding de Tauri a changé — le script doit être mis à jour." >&2
  exit 1
fi

for file in "${ENTITLEMENTS[@]}"; do
  if /usr/libexec/PlistBuddy -c "Print :aps-environment" "$file" >/dev/null 2>&1; then
    /usr/libexec/PlistBuddy -c "Set :aps-environment $ENVIRONMENT" "$file"
  else
    /usr/libexec/PlistBuddy -c "Add :aps-environment string $ENVIRONMENT" "$file"
  fi
  echo "setup-ios-push: aps-environment=$ENVIRONMENT dans $file"
done

echo "setup-ios-push: terminé."
