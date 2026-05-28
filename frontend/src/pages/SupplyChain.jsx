import { useEffect, useState } from "react";
import { Plus, ShieldCheck, AlertTriangle, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { api, extractError, fmtPct } from "@/lib/api";

const ROLES = [
  "vfx",
  "post_production",
  "localization",
  "production_company",
  "talent_agency",
  "equipment",
  "sound",
  "music",
];

function riskAccent(label) {
  if (label === "low") return "text-emerald-300";
  if (label === "moderate") return "text-zinc-200";
  if (label === "elevated") return "rv-bronze";
  return "text-red-400";
}

export default function SupplyChain() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    role: "vfx",
    territory: "",
    delivery_history: 0,
    blockchain_attested: false,
    description: "",
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/vendors");
      setVendors(data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/vendors", {
        ...form,
        delivery_history: Number(form.delivery_history),
      });
      toast.success("Vendor onboarded · risk scored");
      setForm({
        name: "",
        role: "vfx",
        territory: "",
        delivery_history: 0,
        blockchain_attested: false,
        description: "",
      });
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10" data-testid="supply-chain-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
            Supply-chain intelligence
          </p>
          <h1 className="rv-display text-4xl mt-2">Verified Partner Network</h1>
          <p className="text-sm text-zinc-400 max-w-2xl mt-3">
            Every vendor onboarded to RIVITED is scored by Claude Sonnet 4.5
            for delivery history, compliance posture, and territorial risk.
            Blockchain-attested partners surface to the top of every search.
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rv-btn-primary flex items-center gap-2"
          data-testid="supply-add-toggle-btn"
        >
          <Plus size={14} /> Onboard vendor
        </button>
      </div>

      {open ? (
        <form
          onSubmit={submit}
          className="rv-card p-6 mt-6 grid md:grid-cols-2 gap-3"
          data-testid="supply-add-form"
        >
          <input
            className="rv-input"
            placeholder="Vendor name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            data-testid="supply-name-input"
          />
          <select
            className="rv-input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            data-testid="supply-role-select"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
          <input
            className="rv-input"
            placeholder="Primary territory"
            value={form.territory}
            onChange={(e) => setForm({ ...form, territory: e.target.value })}
            required
            data-testid="supply-territory-input"
          />
          <input
            type="number"
            min={0}
            className="rv-input"
            placeholder="Delivery history (# of projects)"
            value={form.delivery_history}
            onChange={(e) =>
              setForm({ ...form, delivery_history: e.target.value })
            }
            data-testid="supply-deliveries-input"
          />
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={form.blockchain_attested}
              onChange={(e) =>
                setForm({ ...form, blockchain_attested: e.target.checked })
              }
              data-testid="supply-attest-checkbox"
            />
            Blockchain-attested deliveries
          </label>
          <textarea
            rows={2}
            className="rv-input md:col-span-2"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            data-testid="supply-description-input"
          />
          <button
            className="rv-btn-primary md:col-span-2"
            disabled={busy}
            data-testid="supply-submit-btn"
          >
            {busy ? "Scoring vendor…" : "Submit + AI risk score"}
          </button>
        </form>
      ) : null}

      <div className="mt-10 grid lg:grid-cols-2 gap-4">
        {loading ? (
          <p className="text-zinc-500 rv-mono text-sm">Loading network…</p>
        ) : (
          vendors.map((v) => (
            <div key={v.id} className="rv-card p-5" data-testid={`vendor-card-${v.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="rv-heading text-lg">{v.name}</h3>
                    {v.verified ? (
                      <BadgeCheck size={14} className="text-[var(--rv-bronze)]" />
                    ) : null}
                  </div>
                  <p className="text-[10px] rv-mono text-zinc-500 mt-1 uppercase tracking-[0.12em]">
                    {v.role.replace("_", " ")} · {v.territory} ·{" "}
                    {v.delivery_history} deliveries
                  </p>
                </div>
                <div className="text-right">
                  <div className={`rv-display text-2xl ${riskAccent(v.risk_label)}`}>
                    {Math.round(v.risk_score)}
                  </div>
                  <div className="text-[10px] rv-mono uppercase tracking-[0.12em] text-zinc-500">
                    risk · {v.risk_label}
                  </div>
                </div>
              </div>
              <p className="text-sm text-zinc-400 mt-3">{v.description}</p>

              <div className="grid grid-cols-3 gap-2 mt-4 text-[11px] rv-mono">
                <div>
                  <div className="text-zinc-500">Compliance</div>
                  <div className="rv-bronze">
                    {fmtPct(v.compliance_score, 0)}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Attested</div>
                  <div className="flex items-center gap-1">
                    {v.blockchain_attested ? (
                      <>
                        <ShieldCheck
                          size={11}
                          className="text-[var(--rv-bronze)]"
                        />
                        Yes
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={11} className="text-zinc-500" />
                        No
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Verified</div>
                  <div>{v.verified ? "Yes" : "Pending"}</div>
                </div>
              </div>

              {Array.isArray(v.risk_factors) && v.risk_factors.length ? (
                <div className="mt-3 border-t border-white/5 pt-3">
                  <p className="text-[10px] rv-mono uppercase tracking-[0.12em] text-zinc-500">
                    Risk factors
                  </p>
                  <ul className="mt-1 text-xs text-zinc-300 space-y-1">
                    {v.risk_factors.slice(0, 4).map((f, i) => (
                      <li key={i}>· {f}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
