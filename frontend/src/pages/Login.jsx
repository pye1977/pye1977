import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { extractError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const DEMO = [
  { label: "Producer", email: "producer@rivited.io", password: "demo1234" },
  { label: "Investor", email: "investor@rivited.io", password: "demo1234" },
  { label: "Distributor", email: "distributor@rivited.io", password: "demo1234" },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && user.id) navigate("/dashboard");
  }, [user, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(email, password);
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

        <form onSubmit={onSubmit} className="mt-7 space-y-4" data-testid="login-form">
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
          <a href="/register" className="rv-bronze underline-offset-4 hover:underline" data-testid="login-go-register-link">
            Apply for access
          </a>
        </p>
      </div>
    </div>
  );
}
