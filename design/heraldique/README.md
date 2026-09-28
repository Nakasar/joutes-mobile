# Héraldique — redesign global de Joutes Mobile

Les planches d'un canevas Claude Design, dessinant l'application dans le langage
du **rôle d'armes** et des **vitrines** de joutes-app : mouvements, filets d'or,
écus, capitales romaines.

## Ce que dit la proposition

Ce que le rôle d'armes apporte n'est pas une palette, c'est une **structure** —
on la généralise, et le bleu et le teal de Joutes ne bougent pas.

1. Le **mouvement** (titre Cinzel + filet d'or + mention en petite capitale)
   ouvre chaque section, à la place du libellé de section actuel.
2. Le **filet remplace la carte** : une liste est un rôle écrit, des lignes
   séparées d'un filet plutôt que des cartes ombrées. Rayon 20 px → 2 px.
3. **Cinzel dit les noms** — écrans, groupes, lieux, joueurs, cartes, decks.
   Sora se retire ; Inter garde le corps, JetBrains Mono les compteurs.
4. **L'or est une structure** : séparations, liserés de sceaux, action
   principale. Jamais un décor.
5. Les **trois sceaux** (blason, carré, rond — déjà la doctrine de
   `src/styles.css`) deviennent la règle de toute l'application.

Seule couleur qui change : le fond clair se neutralise (`#f3f6f8` au lieu de
`#eaf5fc`), sans quoi l'or se bat contre le cyan.

## Les planches

| Fichier | Ce qu'elle montre |
| --- | --- |
| `Main.dc.html` | Le socle : Accueil, Jeux, Jouer, Agenda, Collection |
| `Lieu.dc.html` | La vitrine d'un lieu de jeu |
| `Groupe.dc.html` | La vitrine d'un groupe de jeu |
| `Profil.dc.html` | La vitrine d'un joueur |
| `Tournoi.dc.html` | Le portail tournoi (ronde, table, saisie du résultat) |
| `Cartes.dc.html` | La galerie de cartes et la fiche d'une carte |
| `Deck.dc.html` | Un deck : liste, courbe de coûts, notes |
| `Vocabulaire.dc.html` | Jetons, typographie, sceaux, commandes, avant/après |

Chaque planche est cliquable (onglets, filtres, « Suivre », saisie de résultat)
et porte un réglage **Sombre / Clair**. Le contenu est réaliste mais **fictif** :
noms, prix et dates sont des exemples.

## Régénérer

Le format Design Components ne connaît ni import ni feuille partagée : chaque
`.dc.html` est un fichier complet. Les jetons et les composants communs vivent
donc dans `_base.css`, le corps de chaque planche sous `parts/`, et `build.mjs`
recopie l'un dans l'autre.

```sh
node build.mjs        # réécrit tous les *.dc.html — ne pas les éditer à la main
```

Puis assembler et publier la planche avec l'outil `seed-canvas.mjs` de la
compétence `design` (le fichier assemblé n'est pas versionné : 2,6 Mo d'éditeur
empaqueté) :

```sh
node <design>/seed-canvas.mjs --template <design>/payload.template.html \
  --out joutes-mobile-heraldique.html --title "Joutes Mobile héraldique" \
  --artboard Main.dc.html --artboard Lieu.dc.html --artboard Groupe.dc.html \
  --artboard Profil.dc.html --artboard Tournoi.dc.html --artboard Cartes.dc.html \
  --artboard Deck.dc.html --artboard Vocabulaire.dc.html --canvas canvas.json
```
