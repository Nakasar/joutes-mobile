import { useCallback } from "react";
import { getMyPermissions } from "../api/users";
import { useApi } from "./useApi";
import { useAuth } from "../store/auth";

/**
 * Permissions effectives du compte connecté, pour n'exposer que les actions qui
 * aboutiront plutôt que de laisser l'utilisateur découvrir le refus à
 * l'enregistrement. Un compte anonyme n'en a aucune.
 */
export function usePermissions() {
  const { isAuthenticated } = useAuth();
  const { data, loading } = useApi(
    () => (isAuthenticated ? getMyPermissions() : Promise.resolve(null)),
    [isAuthenticated],
  );

  const can = useCallback(
    (permission: string) =>
      Boolean(data && (data.isAdmin || data.permissions.includes(permission))),
    [data],
  );

  return { can, loading };
}
