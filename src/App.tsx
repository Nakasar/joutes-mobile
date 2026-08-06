import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OfflineBanner } from "./components/OfflineBanner";
import { TabBar } from "./components/TabBar";
import { CardDetailScreen } from "./screens/CardDetailScreen";
import { CollectionGameScreen } from "./screens/CollectionGameScreen";
import { CollectionScreen } from "./screens/CollectionScreen";
import { DeckCheckerScreen } from "./screens/DeckCheckerScreen";
import { EventDetailScreen } from "./screens/EventDetailScreen";
import { EventsScreen } from "./screens/EventsScreen";
import { GameCardsScreen } from "./screens/GameCardsScreen";
import { GameQuizzesScreen } from "./screens/GameQuizzesScreen";
import { GameScreen } from "./screens/GameScreen";
import { GamesScreen } from "./screens/GamesScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MySellListScreen } from "./screens/MySellListScreen";
import { NewsDetailScreen } from "./screens/NewsDetailScreen";
import { PlayGroupDetailScreen } from "./screens/PlayGroupDetailScreen";
import { PlayGroupSellListScreen } from "./screens/PlayGroupSellListScreen";
import { PlayGroupWishlistsScreen } from "./screens/PlayGroupWishlistsScreen";
import { PoliciesListScreen } from "./screens/PoliciesListScreen";
import { PolicyDetailScreen } from "./screens/PolicyDetailScreen";
import { QuizScreen } from "./screens/QuizScreen";
import { RulesScreen } from "./screens/RulesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SocialScreen } from "./screens/SocialScreen";
import { TournamentDetailScreen } from "./screens/TournamentDetailScreen";
import { TournamentFormScreen } from "./screens/TournamentFormScreen";
import { TournamentsScreen } from "./screens/TournamentsScreen";
import { TradeDetailScreen } from "./screens/TradeDetailScreen";
import { TradesScreen } from "./screens/TradesScreen";
import { UserProfileScreen } from "./screens/UserProfileScreen";
import { WishlistDetailScreen } from "./screens/WishlistDetailScreen";
import { WishlistsScreen } from "./screens/WishlistsScreen";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useOnline } from "./hooks/useOnline";
import { AuthProvider, useAuth } from "./store/auth";
import "./styles.css";

function Shell() {
  const { ready } = useAuth();
  const { t } = useTranslation();
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
                <Route path="/wishlists" element={<WishlistsScreen />} />
                <Route
                  path="/wishlists/:wishlistId"
                  element={<WishlistDetailScreen />}
                />
                <Route path="/sell-lists/mine" element={<MySellListScreen />} />
                <Route path="/trades" element={<TradesScreen />} />
                <Route path="/trades/:tradeId" element={<TradeDetailScreen />} />
                <Route path="/tournaments" element={<TournamentsScreen />} />
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
                <Route path="/users/:userTag" element={<UserProfileScreen />} />
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
