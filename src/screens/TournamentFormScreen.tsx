import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { searchCards } from "../api/cards";
import { getPlayerForm, savePlayerForm } from "../api/tournaments";
import type {
  TournamentForm,
  TournamentFormAnswer,
  TournamentFormAnswerInput,
  TournamentFormCard,
  TournamentFormField,
  TournamentPlayerForm,
} from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { StatusView } from "../components/StatusView";
import { TournamentDecklistView } from "../components/TournamentDecklistView";
import { AlertTriangleIcon, LockIcon, SearchIcon } from "../components/icons";
import { useApi } from "../hooks/useApi";
import { useMyTournamentPlayer } from "../hooks/useMyTournamentPlayer";
import { currentLocale } from "../i18n";

/** Saisie en cours d'un champ, toutes formes confondues. */
interface DraftValue {
  text: string;
  number: string;
  choices: string[];
  card: TournamentFormCard | null;
  decklist: string;
}

const EMPTY_DRAFT: DraftValue = { text: "", number: "", choices: [], card: null, decklist: "" };

function buildDraft(
  form: TournamentForm,
  answers: TournamentFormAnswer[],
): Record<string, DraftValue> {
  const byField = new Map(answers.map((answer) => [answer.fieldId, answer]));
  return Object.fromEntries(
    form.fields.map((field) => {
      const answer = byField.get(field.id);
      return [
        field.id,
        {
          text: answer?.text ?? "",
          number: answer?.number !== undefined ? String(answer.number) : "",
          choices: answer?.choices ?? [],
          card: answer?.card ?? null,
          decklist: answer?.decklist?.input ?? "",
        },
      ];
    }),
  );
}

/** Ce que le serveur attend pour un champ, selon son type. */
function toAnswerInput(field: TournamentFormField, value: DraftValue): TournamentFormAnswerInput {
  switch (field.type) {
    case "number": {
      const parsed = Number(value.number);
      return {
        fieldId: field.id,
        number: value.number.trim() && Number.isFinite(parsed) ? parsed : undefined,
      };
    }
    case "single-choice":
    case "multiple-choice":
      return { fieldId: field.id, choices: value.choices };
    case "card":
      return { fieldId: field.id, card: value.card ?? undefined };
    case "decklist":
      return { fieldId: field.id, decklist: value.decklist };
    default:
      return { fieldId: field.id, text: value.text };
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Réponse enregistrée hors délai : l'arbitrage doit la voir, le joueur aussi. */
function LateBadge() {
  const { t } = useTranslation();
  return <span className="chip chip--danger">{t("tournamentForm.lateBadge")}</span>;
}

/**
 * Formulaire d'inscription d'un tournoi, côté joueur.
 *
 * Le serveur décide de tout ce qui engage : qui a le droit d'écrire (`canEdit`),
 * ce qui est obligatoire, et l'analyse d'une liste de deck. L'écran ne fait que
 * présenter la saisie et suivre ce qu'il reçoit.
 */
export function TournamentFormScreen() {
  const { t } = useTranslation();
  const { tournamentId = "" } = useParams();
  const { syncKey, detail, myPlayerId, loading, error } = useMyTournamentPlayer(tournamentId);

  const request = useApi<TournamentPlayerForm | null>(
    () => (myPlayerId ? getPlayerForm(tournamentId, myPlayerId, syncKey) : Promise.resolve(null)),
    [tournamentId, myPlayerId, syncKey],
  );

  // Copie locale : l'enregistrement renvoie l'état à jour (analyse de liste,
  // marque de retard), qui remplace le chargement initial sans le relancer.
  const [payload, setPayload] = useState<TournamentPlayerForm | null>(null);
  const [draft, setDraft] = useState<Record<string, DraftValue>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function applyPayload(data: TournamentPlayerForm) {
    setPayload(data);
    setDraft(data.form ? buildDraft(data.form, data.answers) : {});
  }

  useEffect(() => {
    if (request.data) applyPayload(request.data);
  }, [request.data]);

  const savedByField = useMemo(
    () => new Map((payload?.answers ?? []).map((answer) => [answer.fieldId, answer])),
    [payload],
  );

  function update(fieldId: string, patch: Partial<DraftValue>) {
    setSaved(false);
    setDraft((current) => ({
      ...current,
      [fieldId]: { ...(current[fieldId] ?? EMPTY_DRAFT), ...patch },
    }));
  }

  function submit() {
    const form = payload?.form;
    if (!form || !myPlayerId || saving) return;
    setSaving(true);
    setSaveError(null);
    const answers = form.fields.map((field) => toAnswerInput(field, draft[field.id] ?? EMPTY_DRAFT));
    savePlayerForm(tournamentId, myPlayerId, answers, syncKey)
      .then((data) => {
        setSaving(false);
        setSaved(true);
        applyPayload(data);
      })
      .catch((err: unknown) => {
        setSaving(false);
        setSaveError(err instanceof Error ? err.message : t("common.error"));
      });
  }

  const title = detail.data?.name ?? t("tournamentForm.title");
  const closesAt = payload?.closesAt ?? null;
  const deadlinePassed = !!closesAt && new Date(closesAt).getTime() <= Date.now();

  return (
    <div className="screen">
      <BackHeader title={title} />

      <p className="section-label">{t("tournamentForm.title")}</p>

      <StatusView
        loading={loading || request.loading}
        error={error ?? request.error}
        onRetry={request.reload}
      />

      {!loading && !request.loading && !error && !request.error && (
        <>
          {!myPlayerId ? (
            <p className="status muted">{t("tournamentForm.playerUnknown")}</p>
          ) : !payload?.form || payload.form.fields.length === 0 ? (
            <p className="status muted">{t("tournamentForm.noForm")}</p>
          ) : (
            <>
              <p className="form-intro">{t("tournamentForm.description")}</p>

              {/* Saisie close : les réponses restent consultables, c'est la
                  seule manière de vérifier ce qu'on a déclaré. */}
              {!payload.canEdit && (
                <p className="form-notice form-notice--locked">
                  <LockIcon size={16} />
                  {closesAt && deadlinePassed
                    ? t("tournamentForm.closedByDeadline", { date: formatDateTime(closesAt) })
                    : t("tournamentForm.closedByOrganizer")}
                </p>
              )}
              {payload.canEdit && payload.lateWindow && (
                <p className="form-notice form-notice--late">
                  <AlertTriangleIcon size={16} />
                  {t("tournamentForm.lateWindowNotice")}
                </p>
              )}
              {payload.canEdit && !payload.lateWindow && closesAt && (
                <p className="form-intro">
                  {t("tournamentForm.closesAtNotice", { date: formatDateTime(closesAt) })}
                </p>
              )}

              {payload.form.fields.map((field) =>
                payload.canEdit ? (
                  <FieldInput
                    key={field.id}
                    field={field}
                    value={draft[field.id] ?? EMPTY_DRAFT}
                    savedAnswer={savedByField.get(field.id)}
                    gameSlug={payload.gameSlug}
                    decklistSupported={payload.decklistSupported}
                    disabled={saving}
                    onChange={(patch) => update(field.id, patch)}
                  />
                ) : (
                  <FieldAnswer
                    key={field.id}
                    field={field}
                    answer={savedByField.get(field.id)}
                  />
                ),
              )}

              {saveError && <p className="form-error">{saveError}</p>}

              {payload.canEdit && (
                <>
                  {/* Au-dessus du bouton : la confirmation reste dans le champ
                      de vision, là où le pouce vient d'appuyer. */}
                  {saved && <p className="form-saved">{t("tournamentForm.saved")}</p>}
                  <button
                    className="btn btn--grad btn--block"
                    style={{ marginTop: 8 }}
                    onClick={submit}
                    disabled={saving}
                  >
                    {saving ? t("common.saving") : t("common.save")}
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Un champ en saisie. Le type du champ décide de la forme, pas le libellé. */
function FieldInput({
  field,
  value,
  savedAnswer,
  gameSlug,
  decklistSupported,
  disabled,
  onChange,
}: {
  field: TournamentFormField;
  value: DraftValue;
  savedAnswer?: TournamentFormAnswer;
  gameSlug: string | null;
  decklistSupported: boolean;
  disabled: boolean;
  onChange: (patch: Partial<DraftValue>) => void;
}) {
  const { t } = useTranslation();

  function toggleChoice(option: string) {
    if (field.type === "single-choice") {
      onChange({ choices: value.choices[0] === option ? [] : [option] });
      return;
    }
    onChange({
      choices: value.choices.includes(option)
        ? value.choices.filter((choice) => choice !== option)
        : [...value.choices, option],
    });
  }

  // La liste analysée reste affichée tant que la saisie n'a pas changé : le
  // joueur voit ce qui a été reconnu de ce qu'il a enregistré.
  const parsedMatchesDraft =
    savedAnswer?.decklist &&
    savedAnswer.decklist.input === value.decklist.trim() &&
    (savedAnswer.decklist.parsed || savedAnswer.decklist.parseError);

  return (
    <div className="form-field">
      <div className="form-field__head">
        <span className="form-field__label">
          {field.label}
          {field.required && <span className="form-field__required">*</span>}
        </span>
        {savedAnswer?.late && <LateBadge />}
      </div>
      {field.description && <p className="form-field__hint">{field.description}</p>}

      {field.type === "text" && (
        <input
          type="text"
          value={value.text}
          maxLength={5000}
          disabled={disabled}
          onChange={(e) => onChange({ text: e.currentTarget.value })}
        />
      )}

      {field.type === "long-text" && (
        <textarea
          value={value.text}
          maxLength={5000}
          rows={4}
          disabled={disabled}
          onChange={(e) => onChange({ text: e.currentTarget.value })}
        />
      )}

      {field.type === "number" && (
        <input
          type="number"
          inputMode="numeric"
          value={value.number}
          disabled={disabled}
          onChange={(e) => onChange({ number: e.currentTarget.value })}
        />
      )}

      {(field.type === "single-choice" || field.type === "multiple-choice") && (
        <div className="form-choices">
          {(field.options ?? []).map((option) => (
            <button
              key={option}
              type="button"
              className={`chip-filter${value.choices.includes(option) ? " chip-filter--active" : ""}`}
              aria-pressed={value.choices.includes(option)}
              disabled={disabled}
              onClick={() => toggleChoice(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {field.type === "card" && (
        <CardPicker
          gameSlug={gameSlug}
          value={value.card}
          disabled={disabled}
          onChange={(card) => onChange({ card })}
        />
      )}

      {field.type === "decklist" && (
        <>
          <textarea
            value={value.decklist}
            maxLength={20000}
            rows={8}
            disabled={disabled}
            className="decklist-input"
            placeholder={
              decklistSupported
                ? t("tournamentForm.decklistPlaceholder")
                : t("tournamentForm.decklistPlaceholderRaw")
            }
            onChange={(e) => onChange({ decklist: e.currentTarget.value })}
          />
          <p className="form-field__hint">
            {decklistSupported
              ? t("tournamentForm.decklistResolvedNotice")
              : t("tournamentForm.decklistNoParsing")}
          </p>
          {parsedMatchesDraft && savedAnswer?.decklist && (
            <div className="form-field__preview">
              <TournamentDecklistView decklist={savedAnswer.decklist} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Un champ en lecture, quand la saisie est close. */
function FieldAnswer({
  field,
  answer,
}: {
  field: TournamentFormField;
  answer?: TournamentFormAnswer;
}) {
  const { t } = useTranslation();

  return (
    <div className="form-field">
      <div className="form-field__head">
        <span className="form-field__label">{field.label}</span>
        {answer?.late && <LateBadge />}
      </div>
      {!answer ? (
        <p className={field.required ? "form-error" : "muted"}>{t("tournamentForm.noAnswer")}</p>
      ) : answer.card ? (
        <CardAnswer card={answer.card} />
      ) : answer.decklist ? (
        <TournamentDecklistView decklist={answer.decklist} />
      ) : answer.choices && answer.choices.length > 0 ? (
        <div className="form-choices">
          {answer.choices.map((choice) => (
            <span key={choice} className="chip">
              {choice}
            </span>
          ))}
        </div>
      ) : answer.number !== undefined ? (
        <p className="form-answer form-answer--mono">{answer.number}</p>
      ) : (
        <p className="form-answer">{answer.text}</p>
      )}
    </div>
  );
}

/**
 * Carte choisie : le visuel identifie plus vite que le nom. Il est décoratif
 * au sens des lecteurs d'écran (`alt=""`) — le nom est juste à côté, en texte,
 * et l'annoncer deux fois ne renseignerait personne.
 */
function CardAnswer({ card }: { card: TournamentFormCard }) {
  return (
    <div className="card-answer">
      {card.image && <CachedImage src={card.image} alt="" className="card-answer__image" />}
      <div className="card-answer__body">
        <p className="card-answer__name">{card.name}</p>
        {(card.setCode || card.collectorNumber) && (
          <p className="card-answer__meta">
            {card.setCode} {card.collectorNumber && `#${card.collectorNumber}`}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Choix d'une carte du jeu du tournoi. Le nom et le visuel sont recopiés dans
 * la réponse : elle reste lisible même si la carte quitte l'index de recherche.
 */
function CardPicker({
  gameSlug,
  value,
  disabled,
  onChange,
}: {
  gameSlug: string | null;
  value: TournamentFormCard | null;
  disabled: boolean;
  onChange: (card: TournamentFormCard | null) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TournamentFormCard[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!gameSlug || query.trim().length <= 2) {
      setResults([]);
      // Requête raccourcie pendant qu'une recherche tournait : sans cette
      // remise à zéro, « Recherche… » resterait affiché indéfiniment.
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      searchCards(gameSlug, { searchQuery: query.trim(), limit: 8 })
        .then((response) => {
          if (cancelled) return;
          setResults(
            response.cards.slice(0, 8).map((card) => ({
              cardId: card.id,
              name: card.name,
              image: card.image || undefined,
              setCode: card.setCode || undefined,
              collectorNumber: card.collectorNumber || undefined,
            })),
          );
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      // La recherche abandonnée ne clôturera pas son propre indicateur.
      setSearching(false);
    };
  }, [query, gameSlug]);

  if (!gameSlug) {
    return <p className="form-field__hint">{t("tournamentForm.cardNoGame")}</p>;
  }

  if (value) {
    return (
      <div className="card-answer card-answer--picked">
        {value.image && <CachedImage src={value.image} alt="" className="card-answer__image" />}
        <div className="card-answer__body">
          <p className="card-answer__name">{value.name}</p>
          {(value.setCode || value.collectorNumber) && (
            <p className="card-answer__meta">
              {value.setCode} {value.collectorNumber && `#${value.collectorNumber}`}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn--outline"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          {t("tournamentForm.cardChange")}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="search-field">
        <SearchIcon size={18} className="search-field__icon" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={t("tournamentForm.cardSearchPlaceholder")}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </div>
      {searching && <p className="form-field__hint">{t("tournamentForm.cardSearching")}</p>}
      {!searching && query.trim().length > 2 && results.length === 0 && (
        <p className="form-field__hint">{t("tournamentForm.cardEmpty")}</p>
      )}
      {results.map((card) => (
        <button
          key={`${card.cardId}-${card.collectorNumber ?? ""}`}
          type="button"
          className="card-result"
          disabled={disabled}
          onClick={() => {
            onChange(card);
            setQuery("");
            setResults([]);
          }}
        >
          {card.image && (
            <CachedImage src={card.image} alt="" className="card-result__image" />
          )}
          <span className="card-result__body">
            <span className="card-result__name">{card.name}</span>
            <span className="card-result__meta">
              {card.setCode} {card.collectorNumber && `#${card.collectorNumber}`}
            </span>
          </span>
        </button>
      ))}
    </>
  );
}
