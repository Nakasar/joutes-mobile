import { Navigate, useParams, useSearchParams } from "react-router-dom";

import { isPlayGame } from "../../api/play";
import { riftboundLimited } from "../../engine/limited-riftbound";
import { swuLimited } from "../../engine/swu/limited-profile";
import { LimitedGame } from "./LimitedGame";
import { LimitedRoom } from "./LimitedOnline";
import { LimitedSetup } from "./LimitedSetup";
import { riftboundLimitedKit } from "./riftbound-kit";
import { swuLimitedKit } from "./swu-kit";

const NOWHERE = "/play?section=table";

/** Les réglages d'un scellé ou d'un draft : `/play/:gameSlug/limited/new?kind=sealed|draft`. */
export function LimitedSetupScreen() {
  const { gameSlug } = useParams();
  const [params] = useSearchParams();
  if (!isPlayGame(gameSlug)) return <Navigate to={NOWHERE} replace />;
  const kind = params.get("kind") === "draft" ? "draft" : "sealed";
  return <LimitedSetup key={`${gameSlug}:${kind}`} profile={gameSlug === "swu" ? swuLimited : riftboundLimited} game={gameSlug} kind={kind} />;
}

/** Le scellé ou le draft contre des IA gardé sur l'appareil : `/play/:gameSlug/limited`. */
export function LimitedGameScreen() {
  const { gameSlug } = useParams();
  if (!isPlayGame(gameSlug)) return <Navigate to={NOWHERE} replace />;
  return gameSlug === "swu" ? <LimitedGame kit={swuLimitedKit} /> : <LimitedGame kit={riftboundLimitedKit} />;
}

/** Un scellé ou un draft en ligne : `/play/:gameSlug/limited/events/:eventId`. */
export function LimitedRoomScreen() {
  const { gameSlug, eventId = "" } = useParams();
  if (!isPlayGame(gameSlug)) return <Navigate to={NOWHERE} replace />;
  const id = eventId.toLowerCase();
  return gameSlug === "swu" ? (
    <LimitedRoom key={`swu:${id}`} kit={swuLimitedKit} game="swu" id={id} />
  ) : (
    <LimitedRoom key={`riftbound:${id}`} kit={riftboundLimitedKit} game="riftbound" id={id} />
  );
}
