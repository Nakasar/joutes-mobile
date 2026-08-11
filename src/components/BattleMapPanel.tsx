import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { updateBattleMap } from "../api/game-matches";
import type {
  BattleMap,
  BattleMapSnapshot,
  BattleMapUnitToken,
  BattleReportArmy,
  GameMatchPlayer,
} from "../api/types";
import {
  DEFAULT_TOKEN_DIAMETER,
  MAX_SNAPSHOTS,
  MAX_UNIT_TOKENS,
  colorForPlayer,
  defaultTableForGame,
  trianglePoints,
} from "../lib/battle-map";
import { PlusIcon, TrashIcon } from "./icons";

/** Identifiant court d'un jeton ou d'un instant, dans la forme attendue par l'API. */
function newId(): string {
  return (
    Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-2)
  );
}

/**
 * La table de jeu d'un rapport de bataille, et ses instants.
 *
 * Tout est en centimètres : la `viewBox` **est** la table, l'affichage n'en est
 * qu'une mise à l'échelle. Un socle de 4 cm occupe donc la même fraction du
 * plateau sur un téléphone que sur l'écran du web.
 *
 * Le décor appartient à la table, les unités à l'instant. Le mobile ne pose ni
 * ne redimensionne le décor — cela se fait au doigt sur un grand écran, et le
 * décor est posé une fois pour toutes en début de partie —, mais il le montre :
 * sans lui, les positions ne voudraient rien dire. Ce qui bouge d'un instant à
 * l'autre, ce sont les figurines, et c'est cela qu'on note en cours de partie,
 * la table devant soi.
 *
 * L'écriture est réservée au créateur, comme sur le web : la table est un
 * dessin unique, et deux joueurs qui déplaceraient des jetons dans le même
 * instant ne s'écraseraient pas un champ, ils repositionneraient toute la
 * partie.
 */
export function BattleMapPanel({
  matchId,
  gameSlug,
  players,
  armies,
  map: savedMap,
  editable,
}: {
  matchId: string;
  gameSlug?: string;
  /** Comptes et invités mêlés : les uns comme les autres posent des jetons. */
  players: GameMatchPlayer[];
  armies: Record<string, BattleReportArmy>;
  map?: BattleMap;
  editable: boolean;
}) {
  const { t } = useTranslation();

  const [map, setMap] = useState<BattleMap>(
    () =>
      savedMap ?? {
        table: defaultTableForGame(gameSlug),
        terrain: [],
        snapshots: [{ id: newId(), label: t("battleMap.firstSnapshot"), units: [] }],
      },
  );
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  /** Ce qu'on tient sous le doigt, et l'écart entre son centre et le point saisi. */
  const drag = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const known = useMemo(() => new Set(players.map((player) => player.id)), [players]);
  const stored = map.snapshots[snapshotIndex] ?? map.snapshots[0];
  // Les jetons d'un participant sorti de la partie ne sont plus montrés : c'est
  // ce que la normalisation en fait au prochain enregistrement, et les laisser
  // afficherait un nom que la liste des joueurs ne porte plus.
  const snapshot: BattleMapSnapshot | undefined = stored
    ? { ...stored, units: stored.units.filter((unit) => known.has(unit.playerId)) }
    : undefined;

  const playerColor = (playerId: string) =>
    colorForPlayer(
      map,
      playerId,
      players.findIndex((player) => player.id === playerId),
    );

  const update = (next: BattleMap) => {
    setMap(next);
    setDirty(true);
  };

  const updateUnits = (units: BattleMapUnitToken[]) => {
    update({
      ...map,
      snapshots: map.snapshots.map((entry, index) =>
        index === snapshotIndex ? { ...entry, units } : entry,
      ),
    });
  };

  /**
   * Un doigt qui file au-delà du plateau ne doit pas emporter le jeton avec
   * lui. Le serveur ramène déjà tout au bord à l'enregistrement — le faire au
   * déplacement, c'est montrer tout de suite ce qui sera gardé.
   */
  const clampToTable = (x: number, y: number) => ({
    x: Math.min(map.table.width, Math.max(0, Math.round(x * 10) / 10)),
    y: Math.min(map.table.height, Math.max(0, Math.round(y * 10) / 10)),
  });

  /** Point de l'écran ramené en centimètres de table. */
  const toTable = (event: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * map.table.width,
      y: ((event.clientY - rect.top) / rect.height) * map.table.height,
    };
  };

  const startDrag = (event: React.PointerEvent, unit: BattleMapUnitToken) => {
    setSelectedId(unit.id);
    if (!editable) return;
    event.stopPropagation();
    const point = toTable(event);
    drag.current = { id: unit.id, offsetX: unit.x - point.x, offsetY: unit.y - point.y };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || !snapshot) return;
    const point = toTable(event);
    const { x, y } = clampToTable(point.x + current.offsetX, point.y + current.offsetY);
    updateUnits(
      snapshot.units.map((unit) => (unit.id === current.id ? { ...unit, x, y } : unit)),
    );
  };

  const endDrag = () => {
    drag.current = null;
  };

  const addToken = (playerId: string, unit: { name: string; image?: string; productId?: string }) => {
    if (!snapshot || snapshot.units.length >= MAX_UNIT_TOKENS) return;
    const token: BattleMapUnitToken = {
      id: newId(),
      playerId,
      unitName: unit.name,
      ...(unit.productId ? { productId: unit.productId } : {}),
      ...(unit.image ? { image: unit.image } : {}),
      // Au centre : c'est de là qu'on le tire à sa place, et c'est le seul
      // point dont on soit sûr qu'il est sur la table.
      x: Math.round(map.table.width / 2),
      y: Math.round(map.table.height / 2),
      diameter: DEFAULT_TOKEN_DIAMETER,
    };
    updateUnits([...snapshot.units, token]);
    setSelectedId(token.id);
    setAdding(false);
  };

  const removeSelected = () => {
    if (!snapshot || !selectedId) return;
    updateUnits(snapshot.units.filter((unit) => unit.id !== selectedId));
    setSelectedId(null);
  };

  /**
   * Un nouvel instant part de l'état courant plutôt que d'une table vide : on
   * capture une évolution, pas un nouveau déploiement — les figurines ont bougé
   * de quelques centimètres, elles n'ont pas été reposées.
   */
  const addSnapshot = () => {
    if (!snapshot || map.snapshots.length >= MAX_SNAPSHOTS) return;
    const copy: BattleMapSnapshot = {
      id: newId(),
      label: t("battleMap.snapshotDefault", { number: map.snapshots.length + 1 }),
      units: snapshot.units.map((unit) => ({ ...unit, id: newId() })),
    };
    update({ ...map, snapshots: [...map.snapshots, copy] });
    setSnapshotIndex(map.snapshots.length);
    setSelectedId(null);
  };

  const renameSnapshot = (label: string) => {
    update({
      ...map,
      snapshots: map.snapshots.map((entry, index) =>
        index === snapshotIndex ? { ...entry, label } : entry,
      ),
    });
  };

  const removeSnapshot = () => {
    // Le dernier instant ne se supprime pas : une table sans instant n'a plus
    // de positions à montrer.
    if (map.snapshots.length <= 1) return;
    update({
      ...map,
      snapshots: map.snapshots.filter((_, index) => index !== snapshotIndex),
    });
    setSnapshotIndex(Math.max(0, snapshotIndex - 1));
    setSelectedId(null);
  };

  const save = () => {
    setSaving(true);
    setError(null);
    updateBattleMap(matchId, map)
      .then((normalized) => {
        // C'est la table retenue par le serveur qui fait foi : jetons ramenés
        // au bord, instants plafonnés. L'afficher évite de laisser croire à un
        // enregistrement qui n'a pas gardé ce qu'on voit.
        setMap(normalized);
        setSnapshotIndex((index) => Math.min(index, Math.max(0, normalized.snapshots.length - 1)));
        setDirty(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("battleMap.saveError"));
      })
      .finally(() => setSaving(false));
  };

  if (!snapshot) return null;

  // Épaisseurs et tailles de texte exprimées dans l'échelle de la table, pour
  // qu'elles restent constantes quelle que soit la taille du plateau.
  const strokeWidth = Math.max(0.2, Math.min(map.table.width, map.table.height) / 250);
  const fontSize = Math.min(map.table.width, map.table.height) / 30;
  const selectedUnit = snapshot.units.find((unit) => unit.id === selectedId);

  return (
    <div className="battle-map">
      <div className="chip-row">
        {map.snapshots.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            className={`chip-filter${index === snapshotIndex ? " chip-filter--active" : ""}`}
            onClick={() => {
              setSnapshotIndex(index);
              setSelectedId(null);
            }}
          >
            {entry.label}
          </button>
        ))}
        {editable && map.snapshots.length < MAX_SNAPSHOTS && (
          <button type="button" className="chip-filter" onClick={addSnapshot}>
            <PlusIcon size={14} />
            {t("battleMap.addSnapshot")}
          </button>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${map.table.width} ${map.table.height}`}
        className="battle-map__table"
        role="img"
        aria-label={t("battleMap.tableLabel", {
          width: map.table.width,
          height: map.table.height,
          snapshot: snapshot.label,
        })}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={() => setSelectedId(null)}
      >
        <defs>
          {/* Une graduation tous les 10 cm : de quoi juger une distance sans
              avoir à mesurer. */}
          <pattern
            id={`grid-${matchId}`}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 10 0 L 0 0 0 10"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeWidth={strokeWidth / 2}
            />
          </pattern>
          {snapshot.units
            .filter((unit) => unit.image)
            .map((unit) => (
              <clipPath key={unit.id} id={`token-${matchId}-${unit.id}`}>
                <circle cx={unit.x} cy={unit.y} r={unit.diameter / 2} />
              </clipPath>
            ))}
        </defs>

        <rect width={map.table.width} height={map.table.height} fill={`url(#grid-${matchId})`} />

        {map.terrain.map((piece) => {
          const common = {
            fill: piece.color,
            fillOpacity: 0.75,
            stroke: piece.color,
            strokeWidth,
          };
          return (
            <g key={piece.id}>
              {piece.shape === "circle" && (
                <ellipse
                  cx={piece.x}
                  cy={piece.y}
                  rx={piece.width / 2}
                  ry={piece.height / 2}
                  {...common}
                />
              )}
              {piece.shape === "rectangle" && (
                <rect
                  x={piece.x - piece.width / 2}
                  y={piece.y - piece.height / 2}
                  width={piece.width}
                  height={piece.height}
                  {...common}
                />
              )}
              {piece.shape === "triangle" && <polygon points={trianglePoints(piece)} {...common} />}
              {piece.name && (
                <text
                  x={piece.x}
                  y={piece.y + piece.height / 2 + fontSize}
                  textAnchor="middle"
                  fontSize={fontSize}
                  className="battle-map__label"
                >
                  {piece.name}
                </text>
              )}
            </g>
          );
        })}

        {snapshot.units.map((unit) => {
          const color = playerColor(unit.playerId);
          const radius = unit.diameter / 2;
          const isSelected = unit.id === selectedId;

          return (
            <g key={unit.id} onPointerDown={(event) => startDrag(event, unit)}>
              {unit.image ? (
                <>
                  <image
                    href={unit.image}
                    x={unit.x - radius}
                    y={unit.y - radius}
                    width={unit.diameter}
                    height={unit.diameter}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#token-${matchId}-${unit.id})`}
                  />
                  {/* Image dans le rond, et de la couleur du joueur seulement la
                      bordure : c'est elle qui dit à qui appartient l'unité. */}
                  <circle
                    cx={unit.x}
                    cy={unit.y}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={isSelected ? strokeWidth * 4 : strokeWidth * 2}
                  />
                </>
              ) : (
                <circle
                  cx={unit.x}
                  cy={unit.y}
                  r={radius}
                  fill={color}
                  stroke={isSelected ? "#ffffff" : color}
                  strokeWidth={isSelected ? strokeWidth * 3 : strokeWidth}
                />
              )}
            </g>
          );
        })}
      </svg>

      {selectedUnit && (
        <p className="battle-map__selection">
          <span className="chip" style={{ color: playerColor(selectedUnit.playerId) }}>
            {selectedUnit.unitName}
          </span>
          {editable && (
            <button type="button" className="btn btn--ghost battle-map__remove" onClick={removeSelected}>
              <TrashIcon size={16} />
              {t("battleMap.removeToken")}
            </button>
          )}
        </p>
      )}

      {editable && (
        <>
          <label className="field">
            <span className="field__label">{t("battleMap.snapshotName")}</span>
            <input
              type="text"
              value={snapshot.label}
              onChange={(e) => renameSnapshot(e.currentTarget.value)}
              maxLength={60}
            />
          </label>

          <div className="battle-map__actions">
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => setAdding((open) => !open)}
              disabled={snapshot.units.length >= MAX_UNIT_TOKENS}
            >
              <PlusIcon size={16} />
              {t("battleMap.addToken")}
            </button>
            {map.snapshots.length > 1 && (
              <button type="button" className="btn btn--ghost battle-map__remove" onClick={removeSnapshot}>
                <TrashIcon size={16} />
                {t("battleMap.removeSnapshot")}
              </button>
            )}
          </div>

          {adding && (
            <div className="battle-map__units">
              {players.map((player) => {
                const units = armies[player.id]?.units ?? [];
                if (units.length === 0) return null;
                return (
                  <div key={player.id}>
                    <p className="battle-map__owner" style={{ color: playerColor(player.id) }}>
                      {player.username}
                    </p>
                    <div className="chip-set">
                      {units.map((unit, index) => (
                        <button
                          key={`${unit.productId ?? unit.name}-${index}`}
                          type="button"
                          className="chip-filter"
                          onClick={() => addToken(player.id, unit)}
                        >
                          {unit.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {players.every((player) => (armies[player.id]?.units ?? []).length === 0) && (
                <p className="muted">{t("battleMap.noArmies")}</p>
              )}
            </div>
          )}

          <button
            type="button"
            className="btn btn--grad btn--block"
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? t("common.saving") : t("battleMap.save")}
          </button>
        </>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
