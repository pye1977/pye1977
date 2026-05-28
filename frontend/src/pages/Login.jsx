import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { extractError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

const DEMO = [
  { label: "Producer", email: "producer@rivited.io", password: "demo1234" },
  { label: "Investor", email: "investor@rivited.io", password: "demo1234" },
  { label: "Distributor", email: "distributor@rivited.io", password: "demo1234" },
];

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function googleOAuthRedirect() {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(
    redirectUrl
  )}`;
}

export default function Login() {
  const { user, login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // MFA challenge state
  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    if (user && user.id) navigate("/dashboard");
  }, [user, navigate]);

  // If AuthCallback redirected here with an MFA challenge after Google OAuth
  useEffect(() => {
    const stored = sessionStorage.getItem("rv_mfa_token");
    if (stored) {
      setMfaToken(stored);
      sessionStorage.removeItem("rv_mfa_token");
    }
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await login(email, password);
      if (result && result.mfa_required) {
        setMfaToken(result.mfa_token);
        toast.message("MFA required — enter the 6-digit code from your authenticator");
        return;
      }
      toast.success("Signed in");
      navigate("/dashboard");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await verifyMfa(mfaToken, mfaCode);
      toast.success("Signed in");
      navigate("/dashboard");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const applyPreset = (preset) => {
    setEmail(preset.email);
    setPassword(preset.password);
  };

  if (mfaToken) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="rv-card w-full max-w-md p-8" data-testid="login-mfa-card">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[var(--rv-bronze)]" />
            <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
              Step 2 of 2
            </p>
          </div>
          <h1 className="rv-display text-3xl mt-2">Authenticator code</h1>
          <p className="text-sm text-zinc-400 mt-3">
            Enter the 6-digit code from your authenticator app to complete sign-in.
          </p>
          <form onSubmit={submitMfa} className="mt-6 space-y-4">
            <input
              className="rv-input rv-mono tracking-[0.3em] text-center text-lg"
              maxLength={8}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              autoFocus
              data-testid="login-mfa-input"
            />
            {error ? (
              <div className="text-sm rv-mono text-red-400 border border-red-900/40 rounded-md p-3">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={submitting || mfaCode.length < 6}
              className="rv-btn-primary w-full"
              data-testid="login-mfa-submit-btn"
            >
              {submitting ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMfaToken("");
                setMfaCode("");
              }}
              className="rv-btn-ghost w-full text-sm"
              data-testid="login-mfa-back-btn"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="rv-card w-full max-w-md p-8" data-testid="login-card">
        <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
          Secure access
        </p>
        <h1 className="rv-display text-3xl mt-2">Sign in to RIVITED</h1>
        <p className="text-sm text-zinc-400 mt-3">
          The Programmable Production Finance OS for vertical media supply chains.
        </p>

        <button
          onClick={googleOAuthRedirect}
          className="rv-btn-ghost w-full mt-6 flex items-center justify-center gap-3"
          data-testid="login-google-btn"
        >
          <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#fff"
              d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.77 8.77 0 0 0 2.68-6.62Z"
            />
            <path
              fill="#d4af37"
              d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.87-3.04.87-2.34 0-4.32-1.58-5.03-3.7H.92v2.32A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#fff"
              d="M3.97 10.73a5.41 5.41 0 0 1 0-3.46V4.95H.92a9 9 0 0 0 0 8.1l3.05-2.32Z"
            />
            <path
              fill="#d4af37"
              d="M9 3.58c1.32 0 2.5.45 3.43 1.34l2.57-2.57A9 9 0 0 0 .92 4.95l3.05 2.32C4.68 5.16 6.66 3.58 9 3.58Z"
            />
          </svg>
          Continue with Google (Emergent)
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] rv-mono text-zinc-600 uppercase tracking-[0.2em]">
            or password
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
          <div>
            <label className="text-xs text-zinc-400 rv-mono uppercase tracking-[0.12em]">
              Email
            </label>
            <input
              type="email"
              className="rv-input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="login-email-input"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 rv-mono uppercase tracking-[0.12em]">
              Password
            </label>
            <input
              type="password"
              className="rv-input mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="login-password-input"
            />
          </div>

          {error ? (
            <div
              className="text-sm rv-mono text-red-400 border border-red-900/40 rounded-md p-3"
              data-testid="login-error"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rv-btn-primary w-full"
            data-testid="login-submit-btn"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-[10px] rv-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">
            Demo accounts (one-click)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="rv-btn-ghost text-xs"
                type="button"
                data-testid={`login-demo-${p.label.toLowerCase()}-btn`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-500 mt-6 text-center">
          No account?{" "}
          <a
            href="/register"
            className="rv-bronze underline-offset-4 hover:underline"
            data-testid="login-go-register-link"
          >
            Apply for access
          </a>
        </p>
      </div>
    </div>
  );
}
