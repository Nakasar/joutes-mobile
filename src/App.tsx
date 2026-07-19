import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { TabBar } from "./components/TabBar";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { AuthProvider, useAuth } from "./store/auth";
import "./styles.css";

function Shell() {
  const { ready, isAuthenticated } = useAuth();

  if (!ready) {
    return (
      <div className="screen screen--centered">
        <p className="muted">Chargement…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="*" element={<LoginScreen />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <main className="app-shell__content">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
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
