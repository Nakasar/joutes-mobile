import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  applyTokenSuggestion,
  currentWord,
  parseSearchSyntax,
  removeSearchWord,
  suggestTokens,
  type SearchField,
  type SuggestionHint,
} from "../lib/search-syntax";
import { CrossIcon, SearchIcon } from "./icons";

/**
 * Barre de recherche de cartes avec la syntaxe du site : `domain:fury`,
 * `energy<=3`, `set:OGN`… Les suggestions complètent le mot en cours, les
 * filtres compris s'affichent en pastilles qu'un toucher retire, et les tokens
 * mal formés sont signalés. Sans vocabulaire (pas encore chargé, hors ligne),
 * elle reste une simple recherche par nom.
 */
export function CardSearchBar({
  value,
  onChange,
  fields,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  fields: SearchField[];
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);

  const parsed = parseSearchSyntax(value, fields);
  const suggestions = focused ? suggestTokens(value, fields) : [];
  // Le mot en cours de frappe est forcément incomplet : le signaler comme
  // invalide reviendrait à relever une faute à chaque lettre.
  const typing = currentWord(value);
  const rejected = parsed.rejected.filter((token) => token.raw !== typing);

  const hintLabel = (hint: SuggestionHint) =>
    t(`cardSearch.hints.${hint.kind}`, { field: hint.field, value: hint.value });

  return (
    <div className="card-search">
      <div className="search-field">
        <SearchIcon size={18} className="search-field__icon" />
        <input
          type="search"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder ?? t("cardSearch.placeholder")}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
        />
      </div>

      {suggestions.length > 0 && (
        <div className="card-search__suggestions" role="listbox">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.token}
              type="button"
              role="option"
              aria-selected={false}
              className="card-search__suggestion"
              // Avant la perte de focus, sinon la liste se referme sous le doigt.
              onPointerDown={(e) => {
                e.preventDefault();
                onChange(applyTokenSuggestion(value, suggestion.token));
              }}
            >
              <span className="card-search__token">{suggestion.token}</span>
              <span className="card-search__hint">{hintLabel(suggestion.hint)}</span>
            </button>
          ))}
        </div>
      )}

      {parsed.tokens.length > 0 && (
        <div className="chip-set card-search__chips">
          {parsed.tokens.map((token, index) => (
            <button
              key={`${index}-${token.raw}`}
              type="button"
              className="chip card-search__chip"
              onClick={() => onChange(removeSearchWord(value, token.raw))}
              aria-label={t("cardSearch.removeFilter", { filter: token.label })}
            >
              {token.label}
              <CrossIcon size={12} />
            </button>
          ))}
        </div>
      )}

      {rejected.length > 0 && (
        <ul className="card-search__rejected">
          {rejected.map((token, index) => (
            <li key={`${index}-${token.raw}`}>
              {t(`cardSearch.rejected.${token.reason}`, { token: token.raw, field: token.field })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
