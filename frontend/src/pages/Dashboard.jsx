import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !user.id) return;
    if (user.role === "producer") navigate("/producer");
    else if (user.role === "investor") navigate("/investor");
    else if (user.role === "distributor") navigate("/distributor");
    else if (user.role === "admin") navigate("/admin");
  }, [user, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-zinc-500 rv-mono text-xs" data-testid="dashboard-router">
      Routing to your dashboard…
    </div>
  );
}
