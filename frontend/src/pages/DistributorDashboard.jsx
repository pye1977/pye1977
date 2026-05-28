import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, extractError, fmtUsd, fmtPct } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function GreenlightCard({ spv }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/ai/greenlight", { spv_id: spv.id });
      setResult(data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  const memo = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/ai/deal-memo", { spv_id: spv.id });
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(
          `<title>Deal Memo — ${spv.name}</title>` +
            `<pre style="background:#0a0a0b;color:#fff;padding:32px;font-family:Manrope,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${(
              data.memo || ""
            )
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")}</pre>`
        );
      }
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rv-card p-5" data-testid={`distributor-spv-card-${spv.id}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="rv-heading text-lg">{spv.name}</h3>
          <p className="text-[11px] rv-mono text-zinc-500 mt-1 uppercase tracking-[0.12em]">
            {spv.type.replace("_", " ")} · {spv.territory} · {spv.genre}
          </p>
        </div>
        <Link
          to={`/spv/${spv.id}`}
          className="rv-btn-ghost text-xs"
          data-testid={`distributor-open-spv-${spv.id}`}
        >
          Open
        </Link>
      </div>
      <p className="text-sm text-zinc-300 mt-3 leading-relaxed">
        {spv.description}
      </p>

      <div className="grid grid-cols-3 gap-2 mt-4 text-[11px] rv-mono">
        <div>
          <div className="text-zinc-500">Budget</div>
          <div className="text-white">{fmtUsd(spv.total_budget)}</div>
        </div>
        <div>
          <div className="text-zinc-500">Episodes</div>
          <div className="text-white">{spv.episode_count || "—"}</div>
        </div>
        <div>
          <div className="text-zinc-500">Target IRR</div>
          <div className="rv-bronze">{fmtPct(spv.target_irr, 0)}</div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={run}
          disabled={busy}
          className="rv-btn-primary text-sm flex items-center gap-2"
          data-testid={`distributor-greenlight-btn-${spv.id}`}
        >
          <Sparkles size={14} /> AI Greenlight
        </button>
        <button
          onClick={memo}
          disabled={busy}
          className="rv-btn-ghost text-sm"
          data-testid={`distributor-memo-btn-${spv.id}`}
        >
          Deal Memo
        </button>
      </div>

      {result ? (
        <div className="mt-5 border-t border-white/10 pt-4" data-testid={`greenlight-result-${spv.id}`}>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] rv-mono text-zinc-500 uppercase tracking-[0.12em]">
              Greenlight score
            </span>
            <span className="rv-display text-3xl rv-bronze">
              {result.score}
              <span className="text-sm text-zinc-500 ml-1">/100</span>
            </span>
          </div>
          <div className="text-xs rv-mono text-zinc-500 mt-1">
            verdict · <span className="text-white">{result.verdict}</span> · completion{" "}
            {Math.round((result.completion_probability || 0) * 100)}%
          </div>
          {result.rationale ? (
            <p className="text-sm text-zinc-300 mt-3 leading-relaxed">
              {result.rationale}
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] rv-mono">
            <div>
              <div className="text-zinc-500">Rev low</div>
              <div>{fmtUsd(result.projected_revenue_low_usd)}</div>
            </div>
            <div>
              <div className="text-zinc-500">Rev mid</div>
              <div className="rv-bronze">
                {fmtUsd(result.projected_revenue_mid_usd)}
              </div>
            </div>
            <div>
              <div className="text-zinc-500">Rev high</div>
              <div>{fmtUsd(result.projected_revenue_high_usd)}</div>
            </div>
          </div>
          {Array.isArray(result.key_drivers) && result.key_drivers.length ? (
            <div className="mt-3">
              <div className="text-[10px] rv-mono text-zinc-500 uppercase tracking-[0.12em]">
                Key drivers
              </div>
              <ul className="mt-1 text-xs text-zinc-300 space-y-1">
                {result.key_drivers.slice(0, 4).map((d, i) => (
                  <li key={i}>· {d}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function DistributorDashboard() {
  const { user } = useAuth();
  const [spvs, setSpvs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/spvs");
        setSpvs(data);
      } catch (err) {
        toast.error(extractError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10" data-testid="distributor-dashboard">
      <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
        Distribution · {user?.name}
      </p>
      <h1 className="rv-display text-4xl mt-2">Acquisition Terminal</h1>
      <p className="text-sm text-zinc-400 mt-3 max-w-2xl">
        Every production carries a verifiable cap table, rights ledger, and
        AI-scored greenlight probability. Run diligence in seconds and lock
        deal terms with blockchain-secured audit trails.
      </p>

      <div className="grid lg:grid-cols-2 gap-5 mt-10">
        {loading ? (
          <div className="text-sm text-zinc-500 rv-mono">Loading slate…</div>
        ) : (
          spvs.map((s) => <GreenlightCard key={s.id} spv={s} />)
        )}
      </div>
    </div>
  );
}
