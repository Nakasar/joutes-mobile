import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OfflineBanner } from "./components/OfflineBanner";
import { TabBar } from "./components/TabBar";
import { CardDetailScreen } from "./screens/CardDetailScreen";
import { CollectionGameScreen } from "./screens/CollectionGameScreen";
import { CollectionScreen } from "./screens/CollectionScreen";
import { DeckCheckerScreen } from "./screens/DeckCheckerScreen";
import { DeckDetailScreen } from "./screens/DeckDetailScreen";
import { DeckEditScreen } from "./screens/DeckEditScreen";
import { DeckLibraryScreen } from "./screens/DeckLibraryScreen";
import { DecksScreen } from "./screens/DecksScreen";
import { EventDetailScreen } from "./screens/EventDetailScreen";
import { EventsScreen } from "./screens/EventsScreen";
import { GameCardsScreen } from "./screens/GameCardsScreen";
import { GameProductsScreen } from "./screens/GameProductsScreen";
import { GameQuizzesScreen } from "./screens/GameQuizzesScreen";
import { GameMatchDetailScreen } from "./screens/GameMatchDetailScreen";
import { GameScreen } from "./screens/GameScreen";
import { GamesScreen } from "./screens/GamesScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MySellListScreen } from "./screens/MySellListScreen";
import { NewsDetailScreen } from "./screens/NewsDetailScreen";
import { PlayGroupDetailScreen } from "./screens/PlayGroupDetailScreen";
import { PlayGroupSellListScreen } from "./screens/PlayGroupSellListScreen";
import { PlayGroupWishlistsScreen } from "./screens/PlayGroupWishlistsScreen";
import { PlayersScreen } from "./screens/PlayersScreen";
import { PlayScreen } from "./screens/PlayScreen";
import { PoliciesListScreen } from "./screens/PoliciesListScreen";
import { PolicyDetailScreen } from "./screens/PolicyDetailScreen";
import { QuizScreen } from "./screens/QuizScreen";
import { RulesScreen } from "./screens/RulesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SocialScreen } from "./screens/SocialScreen";
import { TournamentDetailScreen } from "./screens/TournamentDetailScreen";
import { TournamentFormScreen } from "./screens/TournamentFormScreen";
import { TradeDetailScreen } from "./screens/TradeDetailScreen";
import { TradesScreen } from "./screens/TradesScreen";
import { UserContentScreen } from "./screens/UserContentScreen";
import { UserProfileScreen } from "./screens/UserProfileScreen";
import { WishlistDetailScreen } from "./screens/WishlistDetailScreen";
import { WishlistsScreen } from "./screens/WishlistsScreen";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useOnline } from "./hooks/useOnline";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { usePushRegistration } from "./hooks/usePushRegistration";
import { AuthProvider, useAuth } from "./store/auth";
import "./styles.css";

function Shell() {
  const { ready } = useAuth();
  const { t } = useTranslation();
  // Enregistre l'appareil une fois la session établie, et fait suivre le
  // toucher d'une notification jusqu'à l'écran concerné.
  usePushRegistration();
  const online = useOnline();
  const { degraded } = useNetworkStatus();
  // Hors connexion au sens de l'app : appareil déconnecté, ou réseau si lent
  // qu'on a préféré servir le contenu local plutôt que de le faire attendre.
  const offline = !online || degraded;

  if (!ready) {
    return (
      <div className="screen screen--centered">
        <p className="muted">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Écran de connexion plein écran, sans barre d'onglets. */}
      <Route path="/login" element={<LoginScreen />} />
      <Route
        path="*"
        element={
          <div className={`app-shell${offline ? " app-shell--banner" : ""}`}>
            {offline && (
              <OfflineBanner reason={online ? "unreachable" : "disconnected"} />
            )}
            <main className="app-shell__content">
              <Routes>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/news/:newsId" element={<NewsDetailScreen />} />
                <Route path="/games" element={<GamesScreen />} />
                <Route path="/games/:gameSlug" element={<GameScreen />} />
                <Route
                  path="/games/:gameSlug/cards"
                  element={<GameCardsScreen />}
                />
                <Route
                  path="/games/:gameSlug/cards/:cardId"
                  element={<CardDetailScreen />}
                />
                <Route
                  path="/games/:gameSlug/rules"
                  element={<RulesScreen />}
                />
                <Route
                  path="/games/:gameSlug/deck-checker"
                  element={<DeckCheckerScreen />}
                />
                <Route
                  path="/games/:gameSlug/policies"
                  element={<PoliciesListScreen />}
                />
                <Route
                  path="/games/:gameSlug/policies/:policyId"
                  element={<PolicyDetailScreen />}
                />
                <Route
                  path="/games/:gameSlug/products"
                  element={<GameProductsScreen />}
                />
                <Route
                  path="/games/:gameSlug/quizzes"
                  element={<GameQuizzesScreen />}
                />
                <Route
                  path="/games/:gameSlug/quizzes/:quizId"
                  element={<QuizScreen />}
                />
                <Route path="/events" element={<EventsScreen />} />
                <Route path="/events/:eventId" element={<EventDetailScreen />} />
                <Route path="/collection" element={<CollectionScreen />} />
                <Route
                  path="/collection/:gameSlug"
                  element={<CollectionGameScreen />}
                />
                {/* Même écran que `/games/:gameSlug/products` : le catalogue
                    d'un jeu de figurines *est* sa collection, annotée de ce
                    qu'on possède. Les deux chemins existent parce que les deux
                    lectures existent — explorer un jeu, ou suivre sa gamme. */}
                <Route
                  path="/collection/:gameSlug/products"
                  element={<GameProductsScreen />}
                />
                {/* La librairie se lit sans compte ; « mes decks » pose sa
                    propre porte de connexion. L'ordre compte : `/decks/library`
                    doit précéder `/decks/:deckId`, sinon « library » serait lu
                    comme un identifiant de deck. */}
                <Route path="/decks" element={<DecksScreen />} />
                <Route path="/decks/library" element={<DeckLibraryScreen />} />
                <Route path="/decks/:deckId" element={<DeckDetailScreen />} />
                <Route path="/decks/:deckId/edit" element={<DeckEditScreen />} />
                <Route path="/wishlists" element={<WishlistsScreen />} />
                <Route
                  path="/wishlists/:wishlistId"
                  element={<WishlistDetailScreen />}
                />
                <Route path="/sell-lists/mine" element={<MySellListScreen />} />
                <Route path="/trades" element={<TradesScreen />} />
                <Route path="/trades/:tradeId" element={<TradeDetailScreen />} />
                <Route path="/play" element={<PlayScreen />} />
                <Route
                  path="/game-matches/:matchId"
                  element={<GameMatchDetailScreen />}
                />
                {/* L'onglet s'appelait « Tournois » et vivait à cette adresse :
                    les liens déjà posés ailleurs dans l'app y mènent encore. */}
                <Route path="/tournaments" element={<Navigate to="/play" replace />} />
                <Route
                  path="/tournaments/:tournamentId"
                  element={<TournamentDetailScreen />}
                />
                <Route
                  path="/tournaments/:tournamentId/form"
                  element={<TournamentFormScreen />}
                />
                <Route path="/social" element={<SocialScreen />} />
                <Route
                  path="/social/groups/:groupId"
                  element={<PlayGroupDetailScreen />}
                />
                <Route
                  path="/social/groups/:groupId/collection/:gameSlug"
                  element={<CollectionGameScreen />}
                />
                <Route
                  path="/social/groups/:groupId/wishlists"
                  element={<PlayGroupWishlistsScreen />}
                />
                <Route
                  path="/social/groups/:groupId/sell-list"
                  element={<PlayGroupSellListScreen />}
                />
                <Route path="/players" element={<PlayersScreen />} />
                <Route path="/users/:userTag" element={<UserProfileScreen />} />
                <Route
                  path="/users/:userTag/contents/:contentId"
                  element={<UserContentScreen />}
                />
                <Route path="/notifications" element={<NotificationsScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <TabBar />
          </div>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
