import type { TFunction } from "i18next";
import { contributingZones, zoneRuleKey, type DeckZone } from "../../lib/deck-zones";

/**
 * La règle d'une zone, en toutes lettres et dans la langue de l'app : « 40
 * minimum, champion choisi inclus », « 4 exactement : la légende de départ,
 * puis les 3 de Neeko ». Dérivée des bornes, comme sur le site.
 */
export function zoneRuleText(t: TFunction, zone: DeckZone, zones: DeckZone[]): string {
  const { key, min, max } = zoneRuleKey(zone);
  let rule = t(`decks.editor.rules.${key}`, { min, max });

  const contributing = contributingZones(zones, zone);
  if (contributing.length > 0) {
    rule = t("decks.editor.rules.includes", {
      rule,
      zones: contributing.map((other) => t(`decks.zones.${other.key}`).toLowerCase()).join(", "),
    });
  }
  if (zone.extraLegends) {
    rule = t("decks.editor.rules.extraLegends", { rule, count: zone.extraLegends });
  }
  return rule;
}
