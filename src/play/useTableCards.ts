import { useEffect, useState } from "react";

import { api } from "../api/client";

import type { TableCards } from "../engine/cards";
import { ENGINE_VERSION } from "../engine/version";

/**
 * Change quand la forme des cartes change (ici : `def` et `fx` pour les effets).
 * Avec la version du moteur, elle entre dans l'adresse : la réponse se garde une
 * heure dans le navigateur, et un déploiement ne doit pas servir l'ancienne.
 */
const TABLE_CARDS_SHAPE = 2;

let shared: Promise<TableCards> | undefined;

function fetchTableCards(): Promise<TableCards> {
  shared ??= api.get<TableCards>(`/games/riftbound/play/cards`, { v: `${ENGINE_VERSION}.${TABLE_CARDS_SHAPE}` });
  shared.catch(() => {
    shared = undefined;
  });
  return shared;
}

/**
 * Les cartes de la table (nom, illustration, texte). Vide tant qu'elles ne sont
 * pas arrivées : la table se joue quand même, avec les noms du moteur.
 */
export function useTableCards(): TableCards {
  const [cards, setCards] = useState<TableCards>({});
  useEffect(() => {
    let cancelled = false;
    fetchTableCards()
      .then((loaded) => {
        if (!cancelled) setCards(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return cards;
}
