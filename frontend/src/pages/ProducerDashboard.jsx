import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api, extractError, fmtUsd, fmtPct } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import StatCard from "@/components/StatCard";

const TYPES = [
  { value: "vertical_drama", label: "Vertical Drama" },
  { value: "micro_content", label: "Micro-Content" },
  { value: "series", label: "Series" },
  { value: "feature", label: "Feature" },
];

const QUALITY = ["bargain", "standard", "premium", "flagship"];

function CreateSPVForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "vertical_drama",
    territory: "",
    total_budget: 500000,
    minimum_investment: 1000,
    target_irr: 30,
    genre: "",
    episode_count: 60,
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/spvs", {
        ...form,
        total_budget: Number(form.total_budget),
        minimum_investment: Number(form.minimum_investment),
        target_irr: Number(form.target_irr),
        episode_count: Number(form.episode_count),
      });
      toast.success(`SPV minted: ${data.name}`);
      setOpen(false);
      onCreated(data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rv-btn-primary flex items-center gap-2"
        data-testid="producer-new-spv-btn"
      >
        <Plus size={14} /> New Project SPV
      </button>
    );
  }

  return (
    <div className="rv-card p-6 mt-6" data-testid="producer-new-spv-form">
      <div className="flex items-center justify-between">
        <h3 className="rv-heading text-xl">Mint a Programmable SPV</h3>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-500 hover:text-white rv-mono"
          data-testid="producer-new-spv-cancel-btn"
        >
          Cancel
        </button>
      </div>
      <form className="grid md:grid-cols-2 gap-4 mt-5" onSubmit={submit}>
        <div className="md:col-span-2">
          <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
            Production name
          </label>
          <input
            className="rv-input mt-1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            data-testid="spv-name-input"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
            Description
          </label>
          <textarea
            className="rv-input mt-1"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            data-testid="spv-description-input"
          />
        </div>
        <div>
          <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
            Type
          </label>
          <select
            className="rv-input mt-1"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            data-testid="spv-type-select"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
            Genre
          </label>
          <input
            className="rv-input mt-1"
            value={form.genre}
            onChange={(e) => setForm({ ...form, genre: e.target.value })}
            required
            data-testid="spv-genre-input"
          />
        </div>
        <div>
          <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
            Primary territory
          </label>
          <input
            className="rv-input mt-1"
            value={form.territory}
            onChange={(e) => setForm({ ...form, territory: e.target.value })}
            required
            placeholder="e.g. EU + South Korea"
            data-testid="spv-territory-input"
          />
        </div>
        <div>
          <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
            Episode count
          </label>
          <input
            type="number"
            className="rv-input mt-1"
            min={1}
            value={form.episode_count}
            onChange={(e) => setForm({ ...form, episode_count: e.target.value })}
            data-testid="spv-episodes-input"
          />
        </div>
        <div>
          <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
            Total budget (USD)
          </label>
          <input
            type="number"
            className="rv-input mt-1"
            min={1}
            value={form.total_budget}
            onChange={(e) => setForm({ ...form, total_budget: e.target.value })}
            data-testid="spv-budget-input"
          />
        </div>
        <div>
          <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
            Min. investment (USD)
          </label>
          <input
            type="number"
            className="rv-input mt-1"
            min={10}
            value={form.minimum_investment}
            onChange={(e) =>
              setForm({ ...form, minimum_investment: e.target.value })
            }
            data-testid="spv-minimum-input"
          />
        </div>
        <div>
          <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
            Target IRR (%)
          </label>
          <input
            type="number"
            className="rv-input mt-1"
            min={0}
            max={200}
            value={form.target_irr}
            onChange={(e) => setForm({ ...form, target_irr: e.target.value })}
            data-testid="spv-irr-input"
          />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="rv-btn-primary"
            data-testid="spv-submit-btn"
          >
            {busy ? "Minting…" : "Mint SPV"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AIBudgetForecast() {
  const [form, setForm] = useState({
    production_type: "vertical drama",
    territory: "EU + South Korea",
    genre: "Drama / Thriller",
    episode_count: 60,
    target_quality: "premium",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const run = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const { data } = await api.post("/ai/budget-forecast", {
        ...form,
        episode_count: Number(form.episode_count),
      });
      setResult(data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rv-card p-6" data-testid="ai-budget-forecast-card">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-[var(--rv-bronze)]" />
        <h3 className="rv-heading text-lg">AI Budget Forecast</h3>
      </div>
      <p className="text-xs text-zinc-500 mt-1">
        Claude Sonnet 4.5 · Tuned for vertical media benchmarks.
      </p>
      <form className="grid grid-cols-2 gap-3 mt-5" onSubmit={run}>
        <input
          className="rv-input"
          value={form.production_type}
          onChange={(e) =>
            setForm({ ...form, production_type: e.target.value })
          }
          placeholder="Production type"
          data-testid="ai-budget-type-input"
        />
        <input
          className="rv-input"
          value={form.territory}
          onChange={(e) => setForm({ ...form, territory: e.target.value })}
          placeholder="Territory"
          data-testid="ai-budget-territory-input"
        />
        <input
          className="rv-input"
          value={form.genre}
          onChange={(e) => setForm({ ...form, genre: e.target.value })}
          placeholder="Genre"
          data-testid="ai-budget-genre-input"
        />
        <input
          className="rv-input"
          type="number"
          value={form.episode_count}
          onChange={(e) => setForm({ ...form, episode_count: e.target.value })}
          placeholder="Episodes"
          data-testid="ai-budget-episodes-input"
        />
        <select
          className="rv-input col-span-2"
          value={form.target_quality}
          onChange={(e) => setForm({ ...form, target_quality: e.target.value })}
          data-testid="ai-budget-quality-select"
        >
          {QUALITY.map((q) => (
            <option key={q} value={q}>
              Target quality — {q}
            </option>
          ))}
        </select>
        <button
          className="rv-btn-primary col-span-2"
          disabled={busy}
          data-testid="ai-budget-run-btn"
        >
          {busy ? "Forecasting…" : "Run forecast"}
        </button>
      </form>
      {result ? (
        <div className="mt-6" data-testid="ai-budget-result">
          <div className="flex items-baseline justify-between">
            <div className="text-zinc-400 text-xs rv-mono uppercase tracking-[0.12em]">
              Forecast total
            </div>
            <div className="rv-display text-2xl rv-bronze">
              {fmtUsd(result.total_usd)}
            </div>
          </div>
          <div className="mt-2 text-xs rv-mono text-zinc-500">
            Confidence: {Math.round((result.confidence || 0) * 100)}%
          </div>
          {result.narrative ? (
            <p className="text-sm text-zinc-300 mt-4 leading-relaxed">
              {result.narrative}
            </p>
          ) : null}
          {Array.isArray(result.line_items) && result.line_items.length > 0 ? (
            <table className="rv-table mt-5">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {result.line_items.slice(0, 12).map((li, i) => (
                  <tr key={i}>
                    <td>{li.category}</td>
                    <td className="text-right rv-bronze">
                      {fmtUsd(li.amount_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {Array.isArray(result.risks) && result.risks.length ? (
            <div className="mt-5">
              <p className="text-xs rv-mono text-zinc-500 uppercase tracking-[0.12em]">
                Key risks
              </p>
              <ul className="mt-2 text-sm text-zinc-300 space-y-1">
                {result.risks.map((r, i) => (
                  <li key={i}>· {r}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function ProducerDashboard() {
  const { user } = useAuth();
  const [spvs, setSpvs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/spvs", { params: { mine: true } });
      setSpvs(data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const totalBudget = spvs.reduce((acc, s) => acc + (s.total_budget || 0), 0);
    const raised = spvs.reduce((acc, s) => acc + (s.raised_amount || 0), 0);
    return { totalBudget, raised, count: spvs.length };
  }, [spvs]);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10" data-testid="producer-dashboard">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
            Producer · {user?.name}
          </p>
          <h1 className="rv-display text-4xl mt-2">Production Finance OS</h1>
        </div>
        <CreateSPVForm onCreated={() => load()} />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-8" data-testid="producer-stats-row">
        <StatCard
          label="Active SPVs"
          value={String(totals.count)}
          accent
          testId="producer-stat-spvs"
        />
        <StatCard
          label="Total Capital Stack"
          value={fmtUsd(totals.totalBudget)}
          testId="producer-stat-stack"
        />
        <StatCard
          label="Raised to date"
          value={fmtUsd(totals.raised)}
          sub={`${fmtPct(
            totals.totalBudget ? (totals.raised / totals.totalBudget) * 100 : 0
          )} of stack`}
          testId="producer-stat-raised"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-10">
        <div className="lg:col-span-2">
          <h2 className="rv-heading text-xl">Your Project SPVs</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="text-sm text-zinc-500 rv-mono">Loading…</div>
            ) : spvs.length === 0 ? (
              <div className="rv-card p-8 text-center" data-testid="producer-empty">
                <p className="rv-heading text-lg">No SPVs yet</p>
                <p className="text-sm text-zinc-500 mt-2">
                  Mint your first programmable production.
                </p>
              </div>
            ) : (
              spvs.map((s) => (
                <Link
                  key={s.id}
                  to={`/spv/${s.id}`}
                  className="rv-card p-5 flex items-center justify-between hover:border-white/30 transition"
                  data-testid={`producer-spv-row-${s.id}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="rv-heading text-lg">{s.name}</h3>
                      <span className="rv-chip">{s.type.replace("_", " ")}</span>
                      <span className="rv-chip">{s.status}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 rv-mono">
                      {s.territory} · {s.genre} ·{" "}
                      {s.episode_count ? `${s.episode_count} eps` : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="rv-bronze rv-heading text-xl">
                      {fmtUsd(s.raised_amount)}
                    </div>
                    <div className="text-xs text-zinc-500 rv-mono">
                      of {fmtUsd(s.total_budget)}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="mt-8 rv-card p-5">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-[var(--rv-bronze)]" />
              <h3 className="rv-heading text-lg">Treasury rails</h3>
            </div>
            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
              All investor capital settles via Stripe checkout into the
              production treasury. Cross-border FX, stablecoin payout rails,
              tax withholding and union obligation handling are configured per
              SPV in the detail view.
            </p>
          </div>
        </div>

        <div className="lg:col-span-1">
          <AIBudgetForecast />
        </div>
      </div>
    </div>
  );
}
