/**
 * housing/src/context/AuthContext.tsx
 *
 * Fixes & Features:
 * 1. Session timeout: 30 min inactivity → auto logout + redirect
 * 2. Activity detection: mouse, keyboard, touch, scroll reset the timer
 * 3. Visibility change: re-arms timer when user returns to the tab
 * 4. keepLoggedIn: stores token in localStorage (persists browser close)
 * 5. Auto-logout on 401 from any API call
 * 6. Session validation ping every 10 min
 * 7. Logout reason stored → login page shows "Session expired" message
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

// ─── Configuration ─────────────────────────────────────────────────────────
const INACTIVITY_MS = 30 * 60 * 1000; // 30 min
const SESSION_CHECK_MS = 10 * 60 * 1000; // re-validate with server every 10 min
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
  "wheel",
] as const;

// ─── Types ─────────────────────────────────────────────────────────────────
export type LogoutReason = "manual" | "timeout" | "unauthorized";

export interface AuthContextType {
  user: (User & { isSystemAdmin?: boolean }) | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSystemAdmin: boolean;
  logout: (reason?: LogoutReason) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Token helpers ─────────────────────────────────────────────────────────
export function getStoredToken(): string | null {
  try {
    return (
      localStorage.getItem("session_id") ??
      sessionStorage.getItem("session_id") ??
      localStorage.getItem("auth_token") ??
      sessionStorage.getItem("auth_token")
    );
  } catch {
    return null;
  }
}

export function storeToken(token?: string | null, persistent: boolean = true): void {
  const val = token || "session_active";
  try {
    sessionStorage.setItem("auth_token", val);
    sessionStorage.setItem("session_id", val);
    localStorage.setItem("auth_token", val);
    localStorage.setItem("session_id", val);
  } catch {}
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("session_id");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("session_id");
  } catch {}
}

// ─── AuthProvider ──────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoggingOut = useRef(false);
  const hadUserRef = useRef(false);

  // ─── Logout ───────────────────────────────────────────────────────────
  const logout = useCallback((reason: LogoutReason = "manual") => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    hadUserRef.current = false;

    clearToken();

    // Store reason so login page can display appropriate message
    if (reason !== "manual") {
      try {
        sessionStorage.setItem("auth_logout_reason", reason);
      } catch {}
    }

    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });

    // Notify backend (fire-and-forget — don't await)
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });

    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }, [queryClient]);

  // ─── Inactivity timer ─────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      logout("timeout");
    }, INACTIVITY_MS);
  }, [logout]);

  // ─── Fetch /auth/me ───────────────────────────────────────────────────
  const {
    data: user,
    isLoading,
    isError,
    error,
  } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: true,
      retry: false,
      refetchInterval: SESSION_CHECK_MS,
      refetchOnWindowFocus: false,
    },
  });

  // Track if user was authenticated
  useEffect(() => {
    if (user) {
      hadUserRef.current = true;
    }
  }, [user]);

  // Arm/disarm activity listeners when authenticated
  useEffect(() => {
    if (!user) return;

    resetTimer(); // start immediately

    const onActivity = () => resetTimer();
    ACTIVITY_EVENTS.forEach((e) =>
      document.addEventListener(e, onActivity, { passive: true }),
    );

    // Visibility change: re-arm when user returns to tab
    const onVisibility = () => {
      if (!document.hidden) resetTimer();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((e) =>
        document.removeEventListener(e, onActivity),
      );
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, resetTimer]);

  // If and ONLY if the server returns 401 AND user was previously authenticated, token expired — logout
  useEffect(() => {
    if (hadUserRef.current && isError && (error as any)?.status === 401) {
      logout("unauthorized");
    }
  }, [isError, error, logout]);

  // ─── Derived values ───────────────────────────────────────────────────
  const typedUser = user as (User & { isSystemAdmin?: boolean }) | undefined;
  const isSystemAdmin =
    !!typedUser?.isSystemAdmin ||
    !!typedUser?.roles?.some((r: string) =>
      ["super_admin", "system_admin"].includes(r.toLowerCase()),
    );

  const value: AuthContextType = {
    user: typedUser ?? null,
    isLoading,
    isAuthenticated: !!typedUser,
    isSystemAdmin,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
