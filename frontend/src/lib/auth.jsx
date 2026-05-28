import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = checking, false = unauth, object = user
  const [user, setUser] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch (_err) {
      setUser(false);
      return null;
    }
  }, []);

  useEffect(() => {
    // If we're in the OAuth callback hash, let AuthCallback exchange the session
    if (window.location.hash?.includes("session_id=")) {
      setUser(null);
      return;
    }
    refresh();
  }, [refresh]);

  /**
   * Returns the resolved user OR an object with `mfa_required: true, mfa_token`
   * for the caller to drive the second-factor UI.
   */
  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.mfa_required) return data;
    setUser(data.user);
    return data.user;
  };

  const verifyMfa = async (mfa_token, code) => {
    const { data } = await api.post("/auth/mfa/verify", { mfa_token, code });
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (_e) {
      /* swallow */
    }
    setUser(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, login, verifyMfa, register, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
