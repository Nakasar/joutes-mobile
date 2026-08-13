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
import { cacheClear } from "../lib/response-cache";
import { revokeThisDevice } from "../lib/push-device";

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

  // Si l'API répond 401, la session a expiré : on repasse en anonyme et on
  // purge le cache de secours pour ne pas resservir hors ligne les données
  // privées d'une session périmée.
  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      setUser(null);
      void cacheClear();
    });
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
    // AVANT de fermer la session, et non après : le retrait de l'appareil est
    // une requête authentifiée. Dans l'autre ordre elle part sans cookie,
    // répond 401, et le téléphone continue de recevoir les notifications du
    // compte qu'on vient de quitter.
    await revokeThisDevice();

    try {
      await authApi.signOut();
    } catch {
      // Même si l'appel échoue (hors-ligne…), on repasse en anonyme côté app.
    }
    setUser(null);
    // Purge le cache de secours : les données privées (collection, amis,
    // groupes…) ne doivent pas rester disponibles après déconnexion.
    void cacheClear();
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
