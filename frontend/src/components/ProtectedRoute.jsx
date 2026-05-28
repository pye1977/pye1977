import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user === null) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-zinc-400 rv-mono text-xs"
        data-testid="auth-checking"
      >
        Verifying session…
      </div>
    );
  }
  if (user === false) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && roles.length && !roles.includes(user.role) && user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="role-denied">
        <div className="rv-card p-8 text-center max-w-md">
          <p className="rv-heading text-xl mb-2">Access restricted</p>
          <p className="text-sm text-zinc-400">
            This module requires a <span className="rv-bronze">{roles.join(" / ")}</span>{" "}
            role. Your account is registered as <span className="rv-bronze">{user.role}</span>.
          </p>
        </div>
      </div>
    );
  }
  return children;
}
