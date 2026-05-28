import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp, Wallet } from "lucide-react";
import { api, extractError, fmtUsd, fmtPct } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import StatCard from "@/components/StatCard";

function InvestModal({ spv, onClose, onSuccess }) {
  const [amount, setAmount] = useState(spv.minimum_investment);
  const [busy, setBusy] = useState(false);

  const checkout = async () => {
    if (Number(amount) < spv.minimum_investment) {
      toast.error(`Minimum is ${fmtUsd(spv.minimum_investment)}`);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/investments/checkout", {
        spv_id: spv.id,
        amount: Number(amount),
        origin_url: window.location.origin,
      });
      window.location.href = data.url;
      onSuccess?.();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      data-testid="invest-modal"
    >
      <div className="rv-elev w-full max-w-md p-7">
        <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
          Equity Investment
        </p>
        <h2 className="rv-display text-3xl mt-2">{spv.name}</h2>
        <p className="text-sm text-zinc-400 mt-3">
          {spv.description.slice(0, 220)}…
        </p>
        <div className="grid grid-cols-3 gap-3 mt-5 text-sm">
          <div>
            <div className="text-[10px] rv-mono uppercase text-zinc-500">
              Total raise
            </div>
            <div className="rv-bronze rv-heading text-base">
              {fmtUsd(spv.total_budget)}
            </div>
          </div>
          <div>
            <div className="text-[10px] rv-mono uppercase text-zinc-500">
              Minimum
            </div>
            <div className="rv-heading text-base">
              {fmtUsd(spv.minimum_investment)}
            </div>
          </div>
          <div>
            <div className="text-[10px] rv-mono uppercase text-zinc-500">
              Target IRR
            </div>
            <div className="rv-heading text-base">
              {fmtPct(spv.target_irr, 0)}
            </div>
          </div>
        </div>

        <label className="block text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500 mt-5">
          Investment amount (USD)
        </label>
        <input
          type="number"
          className="rv-input mt-1"
          min={spv.minimum_investment}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="invest-amount-input"
        />
        <p className="text-[10px] rv-mono text-zinc-500 mt-2">
          You'll be redirected to Stripe to settle the investment.
        </p>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="rv-btn-ghost"
            data-testid="invest-cancel-btn"
          >
            Cancel
          </button>
          <button
            onClick={checkout}
            disabled={busy}
            className="rv-btn-primary"
            data-testid="invest-confirm-btn"
          >
            {busy ? "Redirecting…" : "Settle via Stripe"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvestorDashboard() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [opps, mine] = await Promise.all([
        api.get("/spvs", { params: { open_for_investment: true } }),
        api.get("/investments/mine"),
      ]);
      setOpportunities(opps.data);
      setPortfolio(mine.data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const invested = portfolio
    .filter((p) => p.status === "paid")
    .reduce((acc, p) => acc + p.amount, 0);
  const payouts = portfolio.reduce(
    (acc, p) => acc + (p.payouts_received || 0),
    0
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10" data-testid="investor-dashboard">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
            Investor · {user?.name}
          </p>
          <h1 className="rv-display text-4xl mt-2">Portfolio Terminal</h1>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mt-8">
        <StatCard
          label="Active positions"
          value={String(portfolio.filter((p) => p.status === "paid").length)}
          accent
          testId="investor-stat-positions"
        />
        <StatCard
          label="Capital deployed"
          value={fmtUsd(invested)}
          testId="investor-stat-deployed"
        />
        <StatCard
          label="Payouts received"
          value={fmtUsd(payouts)}
          sub={invested ? `${fmtPct((payouts / invested) * 100, 1)} of capital` : "—"}
          testId="investor-stat-payouts"
        />
        <StatCard
          label="Open opportunities"
          value={String(opportunities.length)}
          testId="investor-stat-opportunities"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-10">
        <div className="lg:col-span-2">
          <h2 className="rv-heading text-xl">Open Investment Opportunities</h2>
          <p className="text-xs text-zinc-500 mt-1 rv-mono">
            Each SPV is a programmable financial entity with embedded rights and waterfall.
          </p>
          <div className="mt-4 space-y-3" data-testid="investor-opportunities-list">
            {loading ? (
              <div className="text-sm text-zinc-500 rv-mono">Loading…</div>
            ) : opportunities.length === 0 ? (
              <div className="rv-card p-8 text-center">
                <p className="text-sm text-zinc-500">No open opportunities right now.</p>
              </div>
            ) : (
              opportunities.map((s) => {
                const pct = s.total_budget
                  ? Math.min(100, (s.raised_amount / s.total_budget) * 100)
                  : 0;
                return (
                  <div
                    key={s.id}
                    className="rv-card p-5"
                    data-testid={`opportunity-row-${s.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="rv-heading text-lg">{s.name}</h3>
                          <span className="rv-chip">{s.type.replace("_", " ")}</span>
                          <span className="rv-chip">{s.territory}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 rv-mono">
                          {s.genre} · target IRR {fmtPct(s.target_irr, 0)} · min{" "}
                          {fmtUsd(s.minimum_investment)}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelected(s)}
                        className="rv-btn-primary text-sm"
                        data-testid={`opportunity-invest-btn-${s.id}`}
                      >
                        Invest
                      </button>
                    </div>
                    <p className="text-sm text-zinc-300 mt-3 leading-relaxed">
                      {s.description}
                    </p>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs rv-mono text-zinc-500 mb-1">
                        <span>Raised {fmtUsd(s.raised_amount)}</span>
                        <span>{fmtUsd(s.total_budget)}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rv-bg-bronze"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rv-card p-6" data-testid="investor-portfolio-card">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-[var(--rv-bronze)]" />
              <h3 className="rv-heading text-lg">Your positions</h3>
            </div>
            <div className="mt-4 space-y-3">
              {portfolio.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No positions yet. Settle an investment to populate your terminal.
                </p>
              ) : (
                portfolio.map((p) => (
                  <div
                    key={p.id}
                    className="border border-white/10 rounded-lg p-3"
                    data-testid={`portfolio-row-${p.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="rv-heading text-sm">{p.spv_name}</p>
                      <span
                        className={`rv-chip ${
                          p.status === "paid"
                            ? "text-[var(--rv-bronze)] border-[var(--rv-bronze)]/40"
                            : ""
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] rv-mono">
                      <div>
                        <div className="text-zinc-500">Capital</div>
                        <div className="text-white">{fmtUsd(p.amount)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Equity</div>
                        <div className="text-white">
                          {fmtPct(p.equity_percentage, 2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Payouts</div>
                        <div className="rv-bronze">
                          {fmtUsd(p.payouts_received || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rv-card p-6 mt-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-[var(--rv-bronze)]" />
              <h3 className="rv-heading text-lg">Diligence in seconds</h3>
            </div>
            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
              Open any SPV detail page for the full cap table, rights ledger,
              waterfall tiers, AI greenlight score, and immutable audit trail.
            </p>
          </div>
        </div>
      </div>

      {selected ? (
        <InvestModal
          spv={selected}
          onClose={() => setSelected(null)}
          onSuccess={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
