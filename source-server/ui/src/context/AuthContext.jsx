import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/authApi.js";

const AUTH_STORAGE_KEY = "private-stream-auth";
const AuthContext = createContext(null);

function readStoredAuth() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() => readStoredAuth());
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    if (!authState?.accessToken) {
      setIsBootstrapping(false);
      return;
    }

    let isMounted = true;
    authApi
      .getMe(authState.accessToken)
      .then((result) => {
        if (!isMounted) {
          return;
        }

        const nextState = {
          accessToken: authState.accessToken,
          user: result.user
        };
        setAuthState(nextState);
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextState));
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setAuthState(null);
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      })
      .finally(() => {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authState?.accessToken]);

  const value = useMemo(
    () => ({
      accessToken: authState?.accessToken ?? null,
      user: authState?.user ?? null,
      isAuthenticated: Boolean(authState?.accessToken && authState?.user),
      isBootstrapping,
      async login(credentials) {
        const result = await authApi.login(credentials);
        const nextState = {
          accessToken: result.accessToken,
          user: result.user
        };
        setAuthState(nextState);
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextState));
        return result;
      },
      logout() {
        setAuthState(null);
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }),
    [authState, isBootstrapping]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
