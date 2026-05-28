import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Sparkles, Plus, Play, ShieldCheck, Hash, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, extractError, fmtUsd, fmtPct, shortHash } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STAKEHOLDER_TYPES = [
  "producer",
  "investor",
  "writer",
  "actor",
  "director",
  "distributor",
  "guild",
  "other",
];

const RIGHT_TYPES = [
  "distribution",
  "streaming",
  "merchandise",
  "music",
  "broadcast",
  "theatrical",
  "format",
];

function Section({ title, eyebrow, right, children, testId }) {
  return (
    <div className="rv-card p-6" data-testid={testId}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          {eyebrow ? (
            <p className="text-[10px] rv-mono uppercase tracking-[0.18em] text-zinc-500">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="rv-heading text-xl mt-1">{title}</h2>
        </div>
        {right}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function CapTablePanel({ spv, isOwner, onAudit }) {
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    stakeholder_name: "",
    stakeholder_type: "investor",
    equity_percentage: 5,
    investment_amount: 0,
    role: "",
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get(`/spvs/${spv.id}/cap-table`);
    setEntries(data);
  }, [spv.id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/spvs/${spv.id}/cap-table`, {
        ...form,
        equity_percentage: Number(form.equity_percentage),
        investment_amount: Number(form.investment_amount),
      });
      toast.success("Cap table entry added");
      setForm({
        stakeholder_name: "",
        stakeholder_type: "investor",
        equity_percentage: 5,
        investment_amount: 0,
        role: "",
      });
      setOpen(false);
      await load();
      onAudit?.();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/spvs/${spv.id}/cap-table/${id}`);
      toast.success("Entry removed");
      load();
      onAudit?.();
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  const total = entries.reduce((acc, e) => acc + e.equity_percentage, 0);

  return (
    <Section
      title="Cap Table"
      eyebrow="Automated · live"
      testId="spv-cap-table-section"
      right={
        isOwner ? (
          <button
            onClick={() => setOpen((o) => !o)}
            className="rv-btn-ghost text-xs flex items-center gap-1"
            data-testid="spv-cap-add-btn"
          >
            <Plus size={12} /> Add stakeholder
          </button>
        ) : null
      }
    >
      {open ? (
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 mb-5">
          <input
            className="rv-input col-span-2"
            placeholder="Stakeholder name"
            value={form.stakeholder_name}
            onChange={(e) =>
              setForm({ ...form, stakeholder_name: e.target.value })
            }
            required
            data-testid="cap-add-name-input"
          />
          <select
            className="rv-input"
            value={form.stakeholder_type}
            onChange={(e) =>
              setForm({ ...form, stakeholder_type: e.target.value })
            }
            data-testid="cap-add-type-select"
          >
            {STAKEHOLDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            className="rv-input"
            placeholder="Role (e.g. Director)"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            data-testid="cap-add-role-input"
          />
          <input
            type="number"
            className="rv-input"
            step="0.01"
            min="0"
            max="100"
            placeholder="Equity %"
            value={form.equity_percentage}
            onChange={(e) =>
              setForm({ ...form, equity_percentage: e.target.value })
            }
            data-testid="cap-add-equity-input"
          />
          <input
            type="number"
            className="rv-input"
            min="0"
            placeholder="Investment $"
            value={form.investment_amount}
            onChange={(e) =>
              setForm({ ...form, investment_amount: e.target.value })
            }
            data-testid="cap-add-invest-input"
          />
          <button
            className="rv-btn-primary col-span-2"
            disabled={busy}
            data-testid="cap-add-submit-btn"
          >
            {busy ? "Saving…" : "Add to cap table"}
          </button>
        </form>
      ) : null}
      <table className="rv-table">
        <thead>
          <tr>
            <th>Stakeholder</th>
            <th>Type</th>
            <th>Role</th>
            <th className="text-right">Capital</th>
            <th className="text-right">Equity</th>
            {isOwner ? <th></th> : null}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} data-testid={`cap-row-${e.id}`}>
              <td>{e.stakeholder_name}</td>
              <td className="text-zinc-400">{e.stakeholder_type}</td>
              <td className="text-zinc-500">{e.role || "—"}</td>
              <td className="text-right">{fmtUsd(e.investment_amount)}</td>
              <td className="text-right rv-bronze">
                {fmtPct(e.equity_percentage, 2)}
              </td>
              {isOwner ? (
                <td className="text-right">
                  <button
                    onClick={() => remove(e.id)}
                    className="text-zinc-500 hover:text-red-400"
                    data-testid={`cap-delete-btn-${e.id}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
          <tr>
            <td colSpan={4} className="text-right text-zinc-500">
              Total allocated
            </td>
            <td className="text-right rv-bronze">{fmtPct(total, 2)}</td>
            {isOwner ? <td></td> : null}
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

function WaterfallPanel({ spv, isOwner, onAudit }) {
  const [tiers, setTiers] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [open, setOpen] = useState(false);
  const [exec, setExec] = useState(false);
  const [tierForm, setTierForm] = useState({
    tier: 1,
    name: "",
    description: "",
    percentage: 100,
    cap_amount: "",
  });
  const [revenue, setRevenue] = useState(100000);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([
      api.get(`/spvs/${spv.id}/waterfall`),
      api.get(`/spvs/${spv.id}/payouts`),
    ]);
    setTiers(t.data);
    setPayouts(p.data);
  }, [spv.id]);

  useEffect(() => {
    load();
  }, [load]);

  const addTier = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/spvs/${spv.id}/waterfall`, {
        ...tierForm,
        tier: Number(tierForm.tier),
        percentage: Number(tierForm.percentage),
        cap_amount: tierForm.cap_amount ? Number(tierForm.cap_amount) : null,
      });
      toast.success("Waterfall tier added");
      setOpen(false);
      setTierForm({
        tier: tiers.length + 2,
        name: "",
        description: "",
        percentage: 100,
        cap_amount: "",
      });
      await load();
      onAudit?.();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  const execute = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/spvs/${spv.id}/waterfall/execute`, {
        revenue_amount: Number(revenue),
        revenue_source: "distribution",
      });
      toast.success(
        `Distributed ${fmtUsd(data.total_distributed)} across the waterfall`
      );
      setExec(false);
      await load();
      onAudit?.();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Smart Revenue Waterfall"
      eyebrow="Programmable · smart-contract simulated"
      testId="spv-waterfall-section"
      right={
        isOwner ? (
          <div className="flex gap-2">
            <button
              onClick={() => setOpen((o) => !o)}
              className="rv-btn-ghost text-xs flex items-center gap-1"
              data-testid="waterfall-add-tier-btn"
            >
              <Plus size={12} /> Tier
            </button>
            <button
              onClick={() => setExec((o) => !o)}
              className="rv-btn-primary text-xs flex items-center gap-1"
              data-testid="waterfall-execute-toggle-btn"
            >
              <Play size={12} /> Execute
            </button>
          </div>
        ) : null
      }
    >
      {open ? (
        <form onSubmit={addTier} className="grid grid-cols-2 gap-3 mb-5">
          <input
            type="number"
            min="1"
            className="rv-input"
            placeholder="Tier (1,2…)"
            value={tierForm.tier}
            onChange={(e) => setTierForm({ ...tierForm, tier: e.target.value })}
            required
            data-testid="waterfall-tier-input"
          />
          <input
            className="rv-input"
            placeholder="Tier name (e.g. Investor Recoupment)"
            value={tierForm.name}
            onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
            required
            data-testid="waterfall-name-input"
          />
          <input
            type="number"
            min="0"
            max="100"
            className="rv-input"
            placeholder="% of remaining revenue"
            value={tierForm.percentage}
            onChange={(e) =>
              setTierForm({ ...tierForm, percentage: e.target.value })
            }
            required
            data-testid="waterfall-percentage-input"
          />
          <input
            type="number"
            className="rv-input"
            placeholder="Cap $ (optional)"
            value={tierForm.cap_amount}
            onChange={(e) =>
              setTierForm({ ...tierForm, cap_amount: e.target.value })
            }
            data-testid="waterfall-cap-input"
          />
          <input
            className="rv-input col-span-2"
            placeholder="Description"
            value={tierForm.description}
            onChange={(e) =>
              setTierForm({ ...tierForm, description: e.target.value })
            }
            data-testid="waterfall-description-input"
          />
          <button
            className="rv-btn-primary col-span-2"
            disabled={busy}
            data-testid="waterfall-add-submit-btn"
          >
            {busy ? "Saving…" : "Add tier"}
          </button>
        </form>
      ) : null}
      {exec ? (
        <form
          onSubmit={execute}
          className="rv-elev p-4 mb-5 grid grid-cols-3 gap-3 items-end"
        >
          <div className="col-span-2">
            <label className="text-[10px] rv-mono uppercase text-zinc-500 tracking-[0.12em]">
              Distribution revenue (USD)
            </label>
            <input
              type="number"
              className="rv-input mt-1"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              min={1}
              required
              data-testid="waterfall-revenue-input"
            />
          </div>
          <button
            className="rv-btn-primary"
            disabled={busy}
            data-testid="waterfall-execute-submit-btn"
          >
            {busy ? "Running…" : "Execute waterfall"}
          </button>
        </form>
      ) : null}

      <table className="rv-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Tier</th>
            <th>Description</th>
            <th className="text-right">% of remaining</th>
            <th className="text-right">Paid</th>
            <th className="text-right">Cap</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t) => (
            <tr key={t.id} data-testid={`waterfall-row-${t.id}`}>
              <td className="rv-bronze">{t.tier}</td>
              <td>{t.name}</td>
              <td className="text-zinc-500">{t.description || "—"}</td>
              <td className="text-right">{fmtPct(t.percentage, 0)}</td>
              <td className="text-right rv-bronze">{fmtUsd(t.paid_amount)}</td>
              <td className="text-right">
                {t.cap_amount ? fmtUsd(t.cap_amount) : "∞"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {payouts.length ? (
        <div className="mt-6">
          <p className="text-[10px] rv-mono uppercase tracking-[0.18em] text-zinc-500">
            Last 10 payouts
          </p>
          <table className="rv-table mt-2">
            <thead>
              <tr>
                <th>Stakeholder</th>
                <th>Tier</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {payouts.slice(0, 10).map((p) => (
                <tr key={p.id} data-testid={`payout-row-${p.id}`}>
                  <td>{p.stakeholder_name}</td>
                  <td className="text-zinc-500">{p.tier_name}</td>
                  <td className="text-right rv-bronze">{fmtUsd(p.amount)}</td>
                  <td className="text-right text-zinc-500">
                    {new Date(p.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Section>
  );
}

function RightsPanel({ spv, isOwner, onAudit }) {
  const [rights, setRights] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "streaming",
    territory: "Worldwide",
    owner_name: spv.name,
    duration_years: 7,
    royalty_percentage: 20,
  });
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get(`/spvs/${spv.id}/rights`);
    setRights(data);
  }, [spv.id]);

  useEffect(() => {
    load();
  }, [load]);

  const addRight = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/spvs/${spv.id}/rights`, {
        ...form,
        duration_years: Number(form.duration_years),
        royalty_percentage: Number(form.royalty_percentage),
      });
      toast.success("Right minted to ledger");
      setOpen(false);
      await load();
      onAudit?.();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  const runAi = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/ai/rights-conflict", { spv_id: spv.id });
      setAi(data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Rights Ledger"
      eyebrow="Immutable · chain-of-title verified"
      testId="spv-rights-section"
      right={
        <div className="flex gap-2">
          <button
            onClick={runAi}
            className="rv-btn-ghost text-xs flex items-center gap-1"
            disabled={busy}
            data-testid="rights-ai-btn"
          >
            <Sparkles size={12} /> AI conflict scan
          </button>
          {isOwner ? (
            <button
              onClick={() => setOpen((o) => !o)}
              className="rv-btn-primary text-xs flex items-center gap-1"
              data-testid="rights-add-btn"
            >
              <Plus size={12} /> Mint right
            </button>
          ) : null}
        </div>
      }
    >
      {open ? (
        <form onSubmit={addRight} className="grid grid-cols-2 gap-3 mb-5">
          <select
            className="rv-input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            data-testid="rights-type-select"
          >
            {RIGHT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            className="rv-input"
            placeholder="Territory"
            value={form.territory}
            onChange={(e) => setForm({ ...form, territory: e.target.value })}
            required
            data-testid="rights-territory-input"
          />
          <input
            className="rv-input col-span-2"
            placeholder="Owner / licensee"
            value={form.owner_name}
            onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
            required
            data-testid="rights-owner-input"
          />
          <input
            type="number"
            min="1"
            className="rv-input"
            placeholder="Duration (years)"
            value={form.duration_years}
            onChange={(e) =>
              setForm({ ...form, duration_years: e.target.value })
            }
            data-testid="rights-duration-input"
          />
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            className="rv-input"
            placeholder="Royalty %"
            value={form.royalty_percentage}
            onChange={(e) =>
              setForm({ ...form, royalty_percentage: e.target.value })
            }
            data-testid="rights-royalty-input"
          />
          <button
            className="rv-btn-primary col-span-2"
            disabled={busy}
            data-testid="rights-submit-btn"
          >
            {busy ? "Minting…" : "Mint to ledger"}
          </button>
        </form>
      ) : null}

      {ai ? (
        <div className="rv-elev p-4 mb-5" data-testid="rights-ai-result">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[var(--rv-bronze)]" />
            <span className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
              Chain-of-title status:{" "}
              <span className="text-white">{ai.chain_of_title_status}</span> · clearance{" "}
              <span className="rv-bronze">{ai.clearance_score}/100</span>
            </span>
          </div>
          {ai.narrative ? (
            <p className="text-sm text-zinc-300 mt-2">{ai.narrative}</p>
          ) : null}
          {Array.isArray(ai.conflicts) && ai.conflicts.length ? (
            <ul className="mt-3 space-y-2">
              {ai.conflicts.map((c, i) => (
                <li
                  key={i}
                  className="text-xs text-zinc-300 border-l-2 border-[var(--rv-bronze)] pl-3"
                >
                  <span className="rv-mono uppercase text-[10px] tracking-[0.12em] mr-2">
                    {c.severity}
                  </span>
                  {c.summary} — <span className="text-zinc-500">{c.recommendation}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500 mt-2">No conflicts detected.</p>
          )}
        </div>
      ) : null}

      <table className="rv-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Territory</th>
            <th>Owner</th>
            <th className="text-right">Royalty</th>
            <th className="text-right">Duration</th>
            <th>Chain hash</th>
          </tr>
        </thead>
        <tbody>
          {rights.map((r) => (
            <tr key={r.id} data-testid={`right-row-${r.id}`}>
              <td className="rv-bronze">{r.type}</td>
              <td>{r.territory}</td>
              <td>{r.owner_name}</td>
              <td className="text-right">{fmtPct(r.royalty_percentage, 1)}</td>
              <td className="text-right">{r.duration_years}y</td>
              <td className="rv-mono text-[10px] text-zinc-500">
                <Hash size={10} className="inline mr-1" />
                {shortHash(r.chain_hash)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function AuditPanel({ spvId }) {
  const [events, setEvents] = useState([]);

  const load = useCallback(async () => {
    const { data } = await api.get("/audit/events", {
      params: { spv_id: spvId, limit: 30 },
    });
    setEvents(data);
  }, [spvId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Section
      title="Blockchain Audit Trail"
      eyebrow="Immutable · per-SPV"
      testId="spv-audit-section"
      right={
        <button
          onClick={load}
          className="rv-btn-ghost text-xs"
          data-testid="spv-audit-refresh-btn"
        >
          Refresh
        </button>
      }
    >
      <div className="space-y-2">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex items-start justify-between border-b border-white/5 pb-2 text-xs rv-mono"
            data-testid={`audit-row-${ev.id}`}
          >
            <div>
              <div className="text-white">
                <span className="rv-bronze">#{ev.block_number}</span> ·{" "}
                {ev.event_type}
              </div>
              <div className="text-zinc-500 text-[10px] mt-0.5">
                {shortHash(ev.block_hash)} ← {shortHash(ev.previous_hash)}
              </div>
            </div>
            <div className="text-zinc-500 text-[10px]">
              {new Date(ev.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
        {events.length === 0 ? (
          <p className="text-xs text-zinc-500">No events for this SPV yet.</p>
        ) : null}
      </div>
    </Section>
  );
}

export default function SPVDetail() {
  const { spvId } = useParams();
  const { user } = useAuth();
  const [spv, setSpv] = useState(null);
  const [auditTick, setAuditTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/spvs/${spvId}`);
        setSpv(data);
      } catch (err) {
        toast.error(extractError(err));
      }
    })();
  }, [spvId, auditTick]);

  const isOwner = useMemo(() => {
    if (!spv || !user) return false;
    return spv.producer_id === user.id || user.role === "admin";
  }, [spv, user]);

  const toggleInvestment = async () => {
    try {
      const { data } = await api.patch(`/spvs/${spvId}`, {
        open_for_investment: !spv.open_for_investment,
      });
      setSpv(data);
      toast.success(
        data.open_for_investment ? "SPV open for investment" : "SPV closed to investment"
      );
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  if (!spv) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-zinc-500 rv-mono text-xs">
        Loading SPV…
      </div>
    );
  }

  const pct = spv.total_budget
    ? Math.min(100, (spv.raised_amount / spv.total_budget) * 100)
    : 0;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10" data-testid="spv-detail-page">
      <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
        Project SPV
      </p>
      <div className="flex items-start justify-between gap-4 mt-2 flex-wrap">
        <div>
          <h1 className="rv-display text-4xl">{spv.name}</h1>
          <p className="text-sm text-zinc-400 mt-3 max-w-2xl">
            {spv.description}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="rv-chip">{spv.type.replace("_", " ")}</span>
            <span className="rv-chip">{spv.territory}</span>
            <span className="rv-chip">{spv.genre}</span>
            <span className="rv-chip">{spv.status}</span>
            {spv.episode_count ? (
              <span className="rv-chip">{spv.episode_count} eps</span>
            ) : null}
          </div>
        </div>
        {isOwner ? (
          <button
            onClick={toggleInvestment}
            className="rv-btn-ghost text-xs"
            data-testid="spv-toggle-invest-btn"
          >
            {spv.open_for_investment ? "Close investment" : "Re-open investment"}
          </button>
        ) : null}
      </div>

      <div className="grid md:grid-cols-4 gap-4 mt-8" data-testid="spv-stats-row">
        <div className="rv-card p-5">
          <div className="text-[10px] rv-mono uppercase tracking-[0.15em] text-zinc-500">
            Total budget
          </div>
          <div className="rv-display text-2xl mt-2 rv-bronze">
            {fmtUsd(spv.total_budget)}
          </div>
        </div>
        <div className="rv-card p-5">
          <div className="text-[10px] rv-mono uppercase tracking-[0.15em] text-zinc-500">
            Raised
          </div>
          <div className="rv-display text-2xl mt-2">
            {fmtUsd(spv.raised_amount)}
          </div>
          <div className="mt-3 h-1 bg-white/5 rounded-full">
            <div
              className="h-full rv-bg-bronze rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="rv-card p-5">
          <div className="text-[10px] rv-mono uppercase tracking-[0.15em] text-zinc-500">
            Min. investment
          </div>
          <div className="rv-display text-2xl mt-2">
            {fmtUsd(spv.minimum_investment)}
          </div>
        </div>
        <div className="rv-card p-5">
          <div className="text-[10px] rv-mono uppercase tracking-[0.15em] text-zinc-500">
            Target IRR
          </div>
          <div className="rv-display text-2xl mt-2 rv-bronze">
            {fmtPct(spv.target_irr, 0)}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-8">
        <CapTablePanel spv={spv} isOwner={isOwner} onAudit={() => setAuditTick((t) => t + 1)} />
        <RightsPanel spv={spv} isOwner={isOwner} onAudit={() => setAuditTick((t) => t + 1)} />
        <WaterfallPanel spv={spv} isOwner={isOwner} onAudit={() => setAuditTick((t) => t + 1)} />
        <AuditPanel spvId={spv.id} key={auditTick} />
      </div>
    </div>
  );
}
