import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { adminApi, SIGNED_OUT_EVENT, TOKEN_KEY } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  // A saved sign-in: check it is still an admin.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    adminApi
      .me()
      .then(setAdmin)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const out = () => setAdmin(null);
    window.addEventListener(SIGNED_OUT_EVENT, out);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, out);
  }, []);

  /** Store sign-in (email or phone + password), then only let admins in. */
  const signIn = useCallback(async (identifier, password) => {
    const res = await api.post("/auth/login", { identifier, password });
    const { token, user } = res.data.data;
    if (user.role !== "admin") {
      throw new Error("This account isn't an admin. Ask the owner to give it admin access.");
    }
    localStorage.setItem(TOKEN_KEY, token);
    setAdmin(await adminApi.me());
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAdmin(null);
  }, []);

  return <AuthContext.Provider value={{ admin, checking, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
