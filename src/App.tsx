import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { TabBar } from "./components/TabBar";
import { CollectionScreen } from "./screens/CollectionScreen";
import { EventsScreen } from "./screens/EventsScreen";
import { GamesScreen } from "./screens/GamesScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { AuthProvider, useAuth } from "./store/auth";
import "./styles.css";

function Shell() {
  const { ready } = useAuth();

  if (!ready) {
    return (
      <div className="screen screen--centered">
        <p className="muted">Chargement…</p>
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
          <div className="app-shell">
            <main className="app-shell__content">
              <Routes>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/games" element={<GamesScreen />} />
                <Route path="/events" element={<EventsScreen />} />
                <Route path="/collection" element={<CollectionScreen />} />
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
