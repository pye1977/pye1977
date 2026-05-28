import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, extractError, fmtUsd } from "@/lib/api";
import StatCard from "@/components/StatCard";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [spvs, vendors, audit] = await Promise.all([
          api.get("/spvs"),
          api.get("/vendors"),
          api.get("/audit/stats"),
        ]);
        setStats({
          spvs: spvs.data,
          vendors: vendors.data,
          audit: audit.data,
        });
      } catch (err) {
        toast.error(extractError(err));
      }
    })();
  }, []);

  if (!stats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-zinc-500 rv-mono text-xs">
        Loading admin terminal…
      </div>
    );
  }

  const totalBudget = stats.spvs.reduce(
    (acc, s) => acc + (s.total_budget || 0),
    0
  );
  const totalRaised = stats.spvs.reduce(
    (acc, s) => acc + (s.raised_amount || 0),
    0
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10" data-testid="admin-dashboard">
      <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
        Platform · Admin Terminal
      </p>
      <h1 className="rv-display text-4xl mt-2">System Overview</h1>

      <div className="grid md:grid-cols-4 gap-4 mt-8">
        <StatCard
          label="Active SPVs"
          value={String(stats.spvs.length)}
          accent
          testId="admin-stat-spvs"
        />
        <StatCard
          label="Total capital stack"
          value={fmtUsd(totalBudget)}
          testId="admin-stat-stack"
        />
        <StatCard
          label="Total raised"
          value={fmtUsd(totalRaised)}
          testId="admin-stat-raised"
        />
        <StatCard
          label="Audit blocks"
          value={String(stats.audit.total_blocks)}
          testId="admin-stat-blocks"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-10">
        <div className="rv-card p-6" data-testid="admin-spvs-card">
          <h2 className="rv-heading text-xl">All Project SPVs</h2>
          <table className="rv-table mt-4">
            <thead>
              <tr>
                <th>Name</th>
                <th>Producer</th>
                <th>Status</th>
                <th className="text-right">Budget</th>
                <th className="text-right">Raised</th>
              </tr>
            </thead>
            <tbody>
              {stats.spvs.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="text-zinc-400">{s.producer_name}</td>
                  <td>{s.status}</td>
                  <td className="text-right">{fmtUsd(s.total_budget)}</td>
                  <td className="text-right rv-bronze">
                    {fmtUsd(s.raised_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rv-card p-6" data-testid="admin-vendors-card">
          <h2 className="rv-heading text-xl">Vendor Network</h2>
          <table className="rv-table mt-4">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Role</th>
                <th className="text-right">Risk</th>
                <th className="text-right">Deliveries</th>
              </tr>
            </thead>
            <tbody>
              {stats.vendors.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td className="text-zinc-400">{v.role.replace("_", " ")}</td>
                  <td className="text-right rv-bronze">
                    {Math.round(v.risk_score)}
                  </td>
                  <td className="text-right">{v.delivery_history}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
