import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  type AuthTokens,
  type AuthUser,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  refreshToken as apiRefreshToken,
  signup as apiSignup,
  type LoginPayload,
  type SignupPayload,
} from "../lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  initializing: boolean;
  signup: (payload: SignupPayload) => ReturnType<typeof apiSignup>;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const ACCESS_TOKEN_KEY = "lp_auth_access_token";
const REFRESH_TOKEN_KEY = "lp_auth_refresh_token";
const USER_KEY = "lp_auth_user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function safelyReadStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const persistSession = useCallback((nextUser: AuthUser, tokens: AuthTokens) => {
    setUser(nextUser);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);

    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));

    setInitializing(false);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);

    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setInitializing(false);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!refreshToken) {
      throw new ApiError("No refresh token available", 401);
    }

    const refreshed = await apiRefreshToken(refreshToken);
    persistSession(refreshed.user, refreshed.tokens);
  }, [refreshToken, persistSession]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const result = await apiLogin(payload);
      persistSession(result.user, result.tokens);
    },
    [persistSession],
  );

  const signup = useCallback((payload: SignupPayload) => apiSignup(payload), []);

  const logout = useCallback(async () => {
    if (refreshToken) {
      try {
        await apiLogout(refreshToken);
      } catch {
        // The server may already consider token invalid/revoked.
      }
    }

    clearSession();
  }, [clearSession, refreshToken]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession(): Promise<void> {
      const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      const storedUser = safelyReadStoredUser();

      if (!storedAccessToken || !storedRefreshToken) {
        if (isMounted) {
          clearSession();
        }
        return;
      }

      if (isMounted) {
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        setUser(storedUser);
      }

      try {
        const me = await getMe(storedAccessToken);
        if (!isMounted) return;

        setUser(me.user);
        localStorage.setItem(USER_KEY, JSON.stringify(me.user));
        setInitializing(false);
      } catch (error) {
        if (!isMounted) return;

        if (error instanceof ApiError && error.status === 401) {
          try {
            const refreshed = await apiRefreshToken(storedRefreshToken);
            persistSession(refreshed.user, refreshed.tokens);
            return;
          } catch {
            clearSession();
            return;
          }
        }

        clearSession();
      }
    }

    void hydrateSession();

    return () => {
      isMounted = false;
    };
  }, [clearSession, persistSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken,
      initializing,
      signup,
      login,
      logout,
      refreshSession,
    }),
    [user, accessToken, refreshToken, initializing, signup, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
