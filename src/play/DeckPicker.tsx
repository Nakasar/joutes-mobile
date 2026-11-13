import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { BotDeckChoice, LobbyDeck } from "../api/play";
import { DOMAIN_HEX } from "../engine/told-text";
import { CheckIcon, ChevronDownIcon, ShuffleIcon } from "./icons";
import { usePlayT } from "./t";
import { Sheet } from "./ui";

export function choiceKey(choice: BotDeckChoice | null): string {
  if (!choice) return "";
  if (choice.kind === "random") return "random";
  return choice.kind === "deck" ? `deck:${choice.deckId}` : `auto:${choice.legend}`;
}

/** Les refus d'un deck que l'app sait dire dans sa langue ; les autres sont des phrases du moteur. */
const KNOWN_PROBLEMS = new Set(["noLegend", "noChampion", "unknownCard", "noLeader", "noBase"]);

export function deckProblemText(t: (key: string) => string, problem: string): string {
  return KNOWN_PROBLEMS.has(problem) ? t(`deck.problem.${problem}`) : problem;
}

/** Un message d'erreur suivi des refus du deck, s'il y en a. */
export function withDeckProblems(t: (key: string) => string, message: string, details: string[] | undefined): string {
  return details?.length ? `${message} ${details.map((detail) => deckProblemText(t, detail)).join(" ")}` : message;
}

type PickerDeck = LobbyDeck<unknown>;
type PickerCards = Record<string, { name: string; image?: string; domains?: string[] } | undefined>;

type Option = {
  key: string;
  choice: BotDeckChoice;
  name: string;
  hint: string;
  legend: string | null;
  domains: string[];
  refused?: string;
  favorites?: number;
  haystack: string;
  deck?: PickerDeck;
};

type DeckPickerProps<D extends PickerDeck> = {
  /** Le titre de la feuille (« Deck de Kevin »). */
  title: string;
  decks: D[];
  legends: string[];
  cards: PickerCards;
  value: BotDeckChoice | null;
  onChange: (choice: BotDeckChoice, deck?: D) => void;
  /** La recherche dans les decks publics de Joutes, pendant la frappe. */
  search?: (query: string) => Promise<D[]>;
  /** Les textes qui nomment la légende autrement (le leader de SWU). */
  texts?: { auto?: string; randomHint?: string; search?: string };
  colors?: Record<string, string>;
  /** Propose « Au hasard » (pour une IA). */
  allowRandom?: boolean;
  /** `hero` : une grande carte avec l'illustration de la légende (le lancement d'une partie). */
  variant?: "row" | "hero";
  /** Au-dessus du nom, en variante `hero` (« Toi », « IA »). */
  label?: string;
  tone?: "me" | "ai";
};

const SEARCH_DELAY_MS = 300;

/**
 * Le choix d'un deck pour un siège, comme sur le site
 * (`components/play/DeckPicker.tsx`), dans une feuille qui monte du bas : mes
 * decks, ceux de mes groupes, ceux de la méta, les publics (cherchés pendant la
 * frappe) et les decks automatiques. Un deck refusé par le moteur reste
 * visible, grisé, avec sa raison.
 */
export function DeckPicker<D extends PickerDeck>({
  title,
  decks,
  legends,
  cards,
  value,
  onChange,
  search,
  texts = {},
  colors = DOMAIN_HEX,
  allowRandom = false,
  variant = "row",
  label,
  tone = "me",
}: DeckPickerProps<D>) {
  const t = usePlayT("Play");
  const { t: tr } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; decks: D[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [remembered, setRemembered] = useState<Option | null>(null);

  const trimmed = query.trim();
  const remote = Boolean(search) && trimmed.length >= 2;

  useEffect(() => {
    if (!remote || !open || !search) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void search(trimmed).then((result) => {
        if (cancelled) return;
        setSearching(false);
        setFound({ query: trimmed, decks: result });
      });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [remote, open, trimmed, search]);

  const fromDeck = (deck: D): Option => {
    const legendName = deck.legendName ?? (deck.legend ? cards[deck.legend]?.name : undefined);
    const details =
      deck.source === "mine"
        ? [legendName]
        : deck.source === "shared"
          ? [deck.author, deck.groups?.join(", ")]
          : deck.source === "meta"
            ? [
                deck.author,
                deck.tournament && !deck.name.includes(deck.tournament.split(" · ").pop() ?? "") ? deck.tournament : undefined,
                deck.completed?.length ? t("deck.completed") : undefined,
              ]
            : [deck.author, legendName];
    return {
      key: `deck:${deck.id}`,
      choice: { kind: "deck", deckId: deck.id },
      name: deck.name,
      hint: details.filter(Boolean).join(" · "),
      legend: deck.legend,
      domains: (deck.domains ?? []).map((domain) => domain.toLowerCase()),
      refused: deck.list ? undefined : deckProblemText(t, deck.problems[0] ?? "noLegend"),
      favorites: deck.favorites,
      deck,
      haystack: [deck.name, deck.legendName, legendName, deck.author, deck.tournament, ...(deck.groups ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  };

  const autoOptions = useMemo<Option[]>(
    () =>
      legends.map((code) => {
        const name = cards[code]?.name ?? code;
        return {
          key: `auto:${code}`,
          choice: { kind: "auto", legend: code },
          name,
          hint: t("deck.autoHint"),
          legend: code,
          domains: cards[code]?.domains ?? [],
          haystack: `${name} ${code}`.toLowerCase(),
        };
      }),
    [legends, cards, t],
  );

  const known = decks.map(fromDeck);
  const randomOption: Option = {
    key: "random",
    choice: { kind: "random" },
    name: t("deck.random"),
    hint: texts.randomHint ?? t("deck.randomHint"),
    legend: null,
    domains: [],
    haystack: t("deck.random").toLowerCase(),
  };

  const needle = trimmed.toLowerCase();
  const matches = (option: Option) => !needle || option.haystack.includes(needle);
  const fromPage = (source: PickerDeck["source"]) => known.filter((_, index) => decks[index].source === source);
  const foundDecks =
    remote && found?.query === trimmed ? found.decks.filter((deck) => !known.some((other) => other.key === `deck:${deck.id}`)) : [];
  const foundOptions = foundDecks.map(fromDeck);
  const foundFrom = (source: PickerDeck["source"]) => foundOptions.filter((_, index) => foundDecks[index].source === source);

  const groups: { key: string; title: string; note?: string; options: Option[] }[] = [
    { key: "random", title: t("deck.randomGroup"), options: allowRandom ? [randomOption].filter(matches) : [] },
    { key: "mine", title: t("deck.mine"), options: fromPage("mine").filter(matches) },
    { key: "shared", title: t("deck.shared"), options: fromPage("shared").filter(matches) },
    {
      key: "meta",
      title: t("deck.meta"),
      note: search ? (remote ? t("deck.publicSearched") : t("deck.metaHint")) : undefined,
      options: [...fromPage("meta").filter(matches), ...foundFrom("meta")],
    },
    {
      key: "public",
      title: t("deck.public"),
      note: search ? (remote ? t("deck.publicSearched") : t("deck.publicHint")) : undefined,
      options: [...fromPage("public").filter(matches), ...foundFrom("public")],
    },
    { key: "auto", title: texts.auto ?? t("deck.auto"), options: autoOptions.filter(matches) },
  ].filter((group) => group.options.length > 0);

  const all = [...(allowRandom ? [randomOption] : []), ...known, ...foundOptions, ...autoOptions];
  const selectedKey = choiceKey(value);
  const selected = all.find((option) => option.key === selectedKey) ?? (remembered?.key === selectedKey ? remembered : null);
  const count = groups.reduce((sum, group) => sum + group.options.length, 0);

  const pick = (option: Option) => {
    if (option.refused) return;
    setRemembered(option);
    onChange(option.choice, option.deck as D | undefined);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      {variant === "hero" ? (
        <button type="button" className={`play-pick play-pick--${tone}`} aria-label={title} onClick={() => setOpen(true)}>
          <span aria-hidden className={`play-pick__art${selected?.key === "random" ? " play-option__thumb--random" : ""}`}>
            {selected?.legend && cards[selected.legend]?.image ? (
              <img src={cards[selected.legend]!.image} alt="" loading="lazy" />
            ) : (
              <ShuffleIcon size={18} />
            )}
          </span>
          <span className="play-pick__body">
            {label && <span className="play-pick__label">{label}</span>}
            <span className="play-pick__name">{selected?.name ?? t("deck.placeholder")}</span>
            {selected && <span className="play-pick__sub">{selected.hint}</span>}
            {selected && selected.domains.length > 0 && (
              <span className="play-option__domains" aria-hidden>
                {selected.domains.slice(0, 3).map((domain) => (
                  <span key={domain} className="pt-dot" style={{ background: colors[domain] ?? "#64748b" }} />
                ))}
              </span>
            )}
          </span>
          <span className="play-pick__change">{tr("playHub.lobby.change")}</span>
        </button>
      ) : (
        <button type="button" className="play-seat__deck" aria-label={title} onClick={() => setOpen(true)}>
          {selected ? <OptionBody option={selected} cards={cards} colors={colors} /> : <span className="muted">{t("deck.placeholder")}</span>}
          <ChevronDownIcon size={16} />
        </button>
      )}
      {open && (
        <Sheet title={title} onClose={() => setOpen(false)} theme="app" className="play-picker">
          <div className="search-field play-picker__search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={texts.search ?? t("deck.search")}
            />
            <span className="muted play-picker__count">{searching && remote ? "…" : t("deck.count", { count })}</span>
          </div>
          <div className="play-deck-list">
            {count === 0 && <p className="muted">{searching ? t("deck.searching") : t("deck.none")}</p>}
            {groups.map((group) => (
              <section key={group.key}>
                <p className="play-deck-group">
                  {group.title}
                  {group.note && <span className="play-deck-group__note"> · {group.note}</span>}
                </p>
                <div className="play-deck-list">
                  {group.options.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`play-deck${option.key === selectedKey ? " play-deck--active" : ""}`}
                      disabled={Boolean(option.refused)}
                      onClick={() => pick(option)}
                    >
                      <OptionBody option={option} cards={cards} colors={colors} />
                      {option.key === selectedKey && <CheckIcon size={16} />}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

function OptionBody({ option, cards, colors }: { option: Option; cards: PickerCards; colors: Record<string, string> }) {
  const image = option.legend ? cards[option.legend]?.image : undefined;
  return (
    <span className="play-option">
      <span aria-hidden className={`play-option__thumb${option.key === "random" ? " play-option__thumb--random" : ""}`}>
        {image ? <img src={image} alt="" loading="lazy" /> : option.key === "random" ? <ShuffleIcon size={14} /> : null}
      </span>
      <span className="play-deck__body">
        <span className="play-deck__name">{option.name}</span>
        <span className={option.refused ? "play-problem" : "play-deck__sub"}>{option.refused ?? option.hint}</span>
      </span>
      {option.favorites ? <span className="play-deck__sub">★ {option.favorites}</span> : null}
      {option.domains.length > 0 && (
        <span className="play-option__domains" aria-hidden>
          {option.domains.slice(0, 3).map((domain) => (
            <span key={domain} className="pt-dot" style={{ background: colors[domain] ?? "#64748b" }} />
          ))}
        </span>
      )}
    </span>
  );
}
