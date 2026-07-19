import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import * as authApi from "../api/auth";
import type { User } from "../api/types";
import { storageGet, storageRemove, storageSet } from "../storage";

const TOKEN_KEY = "auth.token";

interface AuthContextValue {
  /** null tant que la restauration de session n'est pas terminée. */
  ready: boolean;
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState(false);

  const clearSession = useCallback(() => {
    api.setToken(null);
    setHasToken(false);
    setUser(null);
    void storageRemove(TOKEN_KEY);
  }, []);

  // Restaure la session au démarrage de l'application.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await storageGet(TOKEN_KEY);
        if (token && !cancelled) {
          api.setToken(token);
          setHasToken(true);
          try {
            const me = await authApi.fetchCurrentUser();
            if (!cancelled) setUser(me);
          } catch {
            // Token invalide ou API injoignable : on reste connecté
            // localement, le handler 401 fera le ménage si besoin.
          }
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Déconnecte automatiquement si l'API répond 401.
  useEffect(() => {
    api.setUnauthorizedHandler(clearSession);
    return () => api.setUnauthorizedHandler(null);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    const token = authApi.extractToken(response);
    if (!token) {
      throw new Error(
        "Réponse de connexion inattendue : aucun token trouvé. Vérifiez le mapping avec la doc de l'API.",
      );
    }
    api.setToken(token);
    await storageSet(TOKEN_KEY, token);
    setHasToken(true);
    if (response.user) {
      setUser(response.user);
    } else {
      try {
        setUser(await authApi.fetchCurrentUser());
      } catch {
        // Le profil pourra être rechargé plus tard.
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Même si l'appel échoue (hors-ligne…), on efface la session locale.
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      ready,
      user,
      isAuthenticated: hasToken,
      login,
      logout,
    }),
    [ready, user, hasToken, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé dans un <AuthProvider>");
  }
  return context;
}
