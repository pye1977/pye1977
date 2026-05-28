import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

const MAX_POLLS = 8;
const POLL_INTERVAL_MS = 2000;

export default function PaymentReturn() {
  const search = useLocation().search;
  const navigate = useNavigate();
  const sessionId = new URLSearchParams(search).get("session_id");
  const [state, setState] = useState({ status: "checking", message: "Verifying transaction…" });
  const polls = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setState({ status: "error", message: "No session id supplied." });
      return;
    }
    let cancelled = false;
    const poll = async () => {
      polls.current += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (cancelled) return;
        if (data.payment_status === "paid") {
          const purpose = data.purpose;
          setState({
            status: "success",
            message:
              purpose === "spv_investment"
                ? "Investment settled. Equity allocated and cap table updated."
                : "Episode unlocked. Enjoy the chapter.",
            purpose,
          });
          return;
        }
        if (data.status === "expired" || data.payment_status === "canceled") {
          setState({ status: "error", message: "Session expired or canceled." });
          return;
        }
        if (polls.current < MAX_POLLS) {
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setState({
            status: "pending",
            message:
              "Settlement is still pending. You can safely close this page; the audit trail will reflect it shortly.",
          });
        }
      } catch (_err) {
        if (cancelled) return;
        setState({ status: "error", message: "Could not check status." });
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4" data-testid="payment-return-page">
      <div className="rv-card max-w-md w-full p-8 text-center">
        <p className="text-[10px] rv-mono uppercase tracking-[0.18em] text-zinc-500">
          Payment processing
        </p>
        <div
          className={`rv-display text-3xl mt-2 ${
            state.status === "success"
              ? "rv-bronze"
              : state.status === "error"
                ? "text-red-400"
                : ""
          }`}
          data-testid="payment-status-headline"
        >
          {state.status === "checking" && "Verifying…"}
          {state.status === "success" && "Settled"}
          {state.status === "pending" && "Pending"}
          {state.status === "error" && "Issue"}
        </div>
        <p className="text-sm text-zinc-400 mt-4">{state.message}</p>
        <div className="mt-7 flex gap-3 justify-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="rv-btn-primary text-sm"
            data-testid="payment-back-dashboard-btn"
          >
            Back to dashboard
          </button>
          <button
            onClick={() => navigate("/library")}
            className="rv-btn-ghost text-sm"
            data-testid="payment-back-library-btn"
          >
            Content library
          </button>
        </div>
      </div>
    </div>
  );
}
