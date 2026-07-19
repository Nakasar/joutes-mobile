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
import type { SessionUser } from "../api/types";

interface AuthContextValue {
  /** false tant que la vérification de session au démarrage n'est pas finie. */
  ready: boolean;
  user: SessionUser | null;
  isAuthenticated: boolean;
  /** Étape 1 de la connexion : envoi du code OTP par e-mail. */
  sendOtp: (email: string) => Promise<void>;
  /** Étape 2 : validation du code. Met à jour la session en cas de succès. */
  signInWithOtp: (email: string, otp: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Recharge la session depuis l'API. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const session = await authApi.getSession();
      setUser(session?.user ?? null);
    } catch {
      // API injoignable : on conserve l'état courant, l'app reste utilisable
      // sur les contenus publics.
    }
  }, []);

  // Restaure la session au démarrage (cookie persisté par la couche native).
  useEffect(() => {
    void refresh().finally(() => setReady(true));
  }, [refresh]);

  // Si l'API répond 401, la session a expiré : on repasse en anonyme.
  useEffect(() => {
    api.setUnauthorizedHandler(() => setUser(null));
    return () => api.setUnauthorizedHandler(null);
  }, []);

  const sendOtp = useCallback(async (email: string) => {
    await authApi.sendSignInOtp(email);
  }, []);

  const signInWithOtp = useCallback(
    async (email: string, otp: string) => {
      await authApi.signInWithOtp(email, otp);
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.signOut();
    } catch {
      // Même si l'appel échoue (hors-ligne…), on repasse en anonyme côté app.
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      isAuthenticated: user !== null,
      sendOtp,
      signInWithOtp,
      signOut,
      refresh,
    }),
    [ready, user, sendOtp, signInWithOtp, signOut, refresh],
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
