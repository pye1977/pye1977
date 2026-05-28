import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LogOut, Settings as SettingsIcon, User } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="rv-nav sticky top-0 z-50" data-testid="navbar">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
          <div className="w-7 h-7 rounded-md flex items-center justify-center rv-bg-bronze">
            <span className="rv-mono text-[10px] text-black font-bold">RV</span>
          </div>
          <span className="rv-heading text-lg tracking-tight">
            RIVITED <span className="rv-bronze">Solutions</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
          <Link to="/library" className="hover:text-white transition" data-testid="nav-library">
            Library
          </Link>
          {user && user.id ? (
            <>
              <Link to="/dashboard" className="hover:text-white transition" data-testid="nav-dashboard">
                Dashboard
              </Link>
              <Link to="/marketplace" className="hover:text-white transition" data-testid="nav-marketplace">
                Marketplace
              </Link>
              <Link to="/audit" className="hover:text-white transition" data-testid="nav-audit">
                Audit
              </Link>
              <Link to="/supply-chain" className="hover:text-white transition" data-testid="nav-supply-chain">
                Supply Chain
              </Link>
            </>
          ) : null}
        </nav>

        <div className="flex items-center gap-3">
          {user && user.id ? (
            <>
              <div className="hidden sm:flex items-center gap-2 text-sm text-zinc-300">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-6 h-6 rounded-full border border-white/10"
                    data-testid="navbar-user-avatar"
                  />
                ) : (
                  <User size={14} className="text-zinc-500" />
                )}
                <span data-testid="navbar-user-email">{user.email}</span>
                <span className="rv-chip">{user.role}</span>
                {user.mfa_enabled ? (
                  <span className="rv-chip" data-testid="navbar-mfa-badge">
                    <span className="rv-dot rv-bg-bronze" /> MFA
                  </span>
                ) : null}
              </div>
              <Link
                to="/settings"
                className="rv-btn-ghost text-sm flex items-center gap-2"
                data-testid="navbar-settings-btn"
              >
                <SettingsIcon size={14} />
              </Link>
              <button
                onClick={handleLogout}
                className="rv-btn-ghost text-sm flex items-center gap-2"
                data-testid="navbar-logout-btn"
              >
                <LogOut size={14} /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rv-btn-ghost text-sm" data-testid="navbar-login-btn">
                Sign in
              </Link>
              <Link to="/register" className="rv-btn-primary text-sm" data-testid="navbar-register-btn">
                Get access
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
