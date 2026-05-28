import { useState } from "react";
import { ShieldCheck, Lock, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { api, extractError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Settings() {
  const { user, refresh } = useAuth();
  const [enrollment, setEnrollment] = useState(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);

  const startEnroll = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/mfa/enroll/start");
      setEnrollment(data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/mfa/enroll/confirm", { code: confirmCode });
      toast.success("MFA is now enabled for your account");
      setEnrollment(null);
      setConfirmCode("");
      await refresh();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  const disableMfa = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/mfa/disable", { code: disableCode });
      toast.success("MFA disabled");
      setDisableCode("");
      await refresh();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10" data-testid="settings-page">
      <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
        Security & Identity
      </p>
      <h1 className="rv-display text-4xl mt-2">Account Settings</h1>

      <div className="rv-card p-7 mt-8" data-testid="settings-identity-card">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-[var(--rv-bronze)]" />
          <h2 className="rv-heading text-lg">Identity</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <div className="text-[10px] rv-mono uppercase tracking-[0.12em] text-zinc-500">
              Email
            </div>
            <div className="rv-mono text-zinc-200">{user?.email}</div>
          </div>
          <div>
            <div className="text-[10px] rv-mono uppercase tracking-[0.12em] text-zinc-500">
              Role
            </div>
            <div className="rv-mono rv-bronze">{user?.role}</div>
          </div>
          <div>
            <div className="text-[10px] rv-mono uppercase tracking-[0.12em] text-zinc-500">
              Auth provider
            </div>
            <div className="rv-mono text-zinc-200">
              {user?.auth_provider || "password"}
            </div>
          </div>
          <div>
            <div className="text-[10px] rv-mono uppercase tracking-[0.12em] text-zinc-500">
              MFA status
            </div>
            <div
              className={
                "rv-mono " + (user?.mfa_enabled ? "rv-bronze" : "text-zinc-400")
              }
              data-testid="settings-mfa-status"
            >
              {user?.mfa_enabled ? "Enabled (TOTP)" : "Not enrolled"}
            </div>
          </div>
        </div>
      </div>

      <div className="rv-card p-7 mt-6" data-testid="settings-mfa-card">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-[var(--rv-bronze)]" />
          <h2 className="rv-heading text-lg">Multi-Factor Authentication (TOTP)</h2>
        </div>
        <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
          Pair your account with an authenticator app (Google Authenticator,
          Authy, 1Password). Once enabled, every sign-in will require a 6-digit
          code in addition to your password.
        </p>

        {user?.mfa_enabled ? (
          <form className="mt-6 space-y-3" onSubmit={disableMfa}>
            <p className="text-xs rv-mono text-zinc-500 uppercase tracking-[0.12em]">
              Disable MFA — confirm with current code
            </p>
            <input
              className="rv-input"
              placeholder="6-digit code"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              maxLength={8}
              data-testid="settings-mfa-disable-input"
            />
            <button
              className="rv-btn-ghost text-sm"
              disabled={busy || !disableCode}
              data-testid="settings-mfa-disable-btn"
            >
              Disable MFA
            </button>
          </form>
        ) : enrollment ? (
          <form className="mt-6 space-y-4" onSubmit={confirmEnroll}>
            <p className="text-sm text-zinc-300">
              Scan this QR with your authenticator app:
            </p>
            <img
              src={enrollment.qr_data_url}
              alt="MFA QR"
              className="w-44 h-44 rounded-md border border-white/10 bg-white"
              data-testid="settings-mfa-qr"
            />
            <p className="text-[11px] rv-mono text-zinc-500 break-all">
              Or paste this secret manually:{" "}
              <span className="text-zinc-200">{enrollment.secret}</span>
            </p>
            <input
              className="rv-input"
              placeholder="Enter 6-digit code to confirm"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              maxLength={8}
              data-testid="settings-mfa-confirm-input"
            />
            <div className="flex gap-2">
              <button
                className="rv-btn-primary text-sm"
                disabled={busy || !confirmCode}
                data-testid="settings-mfa-confirm-btn"
              >
                Confirm & enable
              </button>
              <button
                type="button"
                onClick={() => setEnrollment(null)}
                className="rv-btn-ghost text-sm"
                data-testid="settings-mfa-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={startEnroll}
            disabled={busy}
            className="rv-btn-primary mt-6 flex items-center gap-2"
            data-testid="settings-mfa-start-btn"
          >
            <Lock size={14} /> Enable TOTP MFA
          </button>
        )}
      </div>
    </div>
  );
}
