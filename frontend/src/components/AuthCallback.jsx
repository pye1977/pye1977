import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, extractError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const sessionId = params.get("session_id");

    if (!sessionId) {
      toast.error("Missing OAuth session id");
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", {
          session_id: sessionId,
        });
        if (data.mfa_required) {
          sessionStorage.setItem("rv_mfa_token", data.mfa_token);
          window.history.replaceState({}, "", "/login");
          navigate("/login", { state: { mfaRequired: true } });
          return;
        }
        await refresh();
        window.history.replaceState({}, "", "/dashboard");
        toast.success(`Welcome ${data.user?.name || ""}`);
        navigate("/dashboard", { replace: true });
      } catch (err) {
        toast.error(extractError(err));
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, refresh]);

  return (
    <div
      className="min-h-screen flex items-center justify-center text-zinc-500 rv-mono text-xs"
      data-testid="auth-callback"
    >
      Completing Google sign-in…
    </div>
  );
}
