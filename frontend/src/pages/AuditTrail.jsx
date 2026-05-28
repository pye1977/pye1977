import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { toast } from "sonner";
import { api, extractError, shortHash } from "@/lib/api";

export default function AuditTrail() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ total_blocks: 0, latest_block: 0, latest_hash: "" });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [evs, st] = await Promise.all([
        api.get("/audit/events", { params: { limit: 200 } }),
        api.get("/audit/stats"),
      ]);
      setEvents(evs.data);
      setStats(st.data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10" data-testid="audit-page">
      <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
        Programmable audit layer
      </p>
      <h1 className="rv-display text-4xl mt-2">Blockchain Audit Trail</h1>
      <p className="text-sm text-zinc-400 max-w-2xl mt-3">
        Every SPV mint, cap-table change, rights event, waterfall execution,
        and investor settlement is appended as an immutable block linked by
        hash to the previous event.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mt-8" data-testid="audit-stats-row">
        <div className="rv-card p-5">
          <div className="text-[10px] rv-mono uppercase tracking-[0.15em] text-zinc-500">
            Total blocks
          </div>
          <div className="rv-display text-3xl rv-bronze mt-2">
            {stats.total_blocks}
          </div>
        </div>
        <div className="rv-card p-5">
          <div className="text-[10px] rv-mono uppercase tracking-[0.15em] text-zinc-500">
            Latest block
          </div>
          <div className="rv-display text-3xl mt-2">
            #{stats.latest_block}
          </div>
        </div>
        <div className="rv-card p-5">
          <div className="text-[10px] rv-mono uppercase tracking-[0.15em] text-zinc-500">
            Latest hash
          </div>
          <div className="rv-mono text-sm mt-3 text-zinc-300 break-all">
            {stats.latest_hash || "—"}
          </div>
        </div>
      </div>

      <div className="rv-card p-6 mt-8" data-testid="audit-table">
        <table className="rv-table">
          <thead>
            <tr>
              <th>Block</th>
              <th>Event</th>
              <th>Actor</th>
              <th>SPV</th>
              <th>Hash</th>
              <th className="text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-zinc-500">
                  Loading…
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id} data-testid={`audit-event-row-${ev.id}`}>
                  <td className="rv-bronze">#{ev.block_number}</td>
                  <td>{ev.event_type}</td>
                  <td className="text-zinc-400">{ev.actor_name || "—"}</td>
                  <td className="text-zinc-500">
                    {ev.spv_id ? shortHash(ev.spv_id) : "—"}
                  </td>
                  <td>
                    <Hash size={10} className="inline mr-1 text-zinc-500" />
                    <span className="text-zinc-300">
                      {shortHash(ev.block_hash)}
                    </span>
                  </td>
                  <td className="text-right text-zinc-500">
                    {new Date(ev.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
