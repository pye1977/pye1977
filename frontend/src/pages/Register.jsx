import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, extractError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "producer",
  });
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
      await register(form);
      toast.success("Welcome to RIVITED Solutions");
      navigate("/dashboard");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="rv-card w-full max-w-md p-8" data-testid="register-card">
        <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
          Access Request
        </p>
        <h1 className="rv-display text-3xl mt-2">Apply for the Production OS</h1>
        <p className="text-sm text-zinc-400 mt-3">
          RIVITED is gated to verified producers, investors, and distribution
          partners. Admin accounts are issued by RIVITED.
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4" data-testid="register-form">
          <div>
            <label className="text-xs text-zinc-400 rv-mono uppercase tracking-[0.12em]">
              Full Name
            </label>
            <input
              type="text"
              className="rv-input mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              data-testid="register-name-input"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 rv-mono uppercase tracking-[0.12em]">
              Email
            </label>
            <input
              type="email"
              className="rv-input mt-1"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              data-testid="register-email-input"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 rv-mono uppercase tracking-[0.12em]">
              Password
            </label>
            <input
              type="password"
              className="rv-input mt-1"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
              data-testid="register-password-input"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 rv-mono uppercase tracking-[0.12em]">
              Account Type
            </label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {["producer", "investor", "distributor"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm({ ...form, role: r })}
                  className={`rounded-lg border text-xs rv-mono uppercase tracking-[0.08em] py-2 transition ${
                    form.role === r
                      ? "border-[var(--rv-bronze)] text-[var(--rv-bronze)]"
                      : "border-white/10 text-zinc-400 hover:text-white"
                  }`}
                  data-testid={`register-role-${r}-btn`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div
              className="text-sm rv-mono text-red-400 border border-red-900/40 rounded-md p-3"
              data-testid="register-error"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rv-btn-primary w-full"
            data-testid="register-submit-btn"
          >
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="text-xs text-zinc-500 mt-6 text-center">
          Already have access?{" "}
          <a href="/login" className="rv-bronze underline-offset-4 hover:underline" data-testid="register-go-login-link">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
