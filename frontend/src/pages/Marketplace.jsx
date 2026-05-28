import { useEffect, useMemo, useState } from "react";
import { Coins, ListPlus, X } from "lucide-react";
import { toast } from "sonner";
import { api, extractError, fmtPct, fmtUsd } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function ListingModal({ entry, onClose, onCreated }) {
  const [form, setForm] = useState({
    equity_to_sell_pct: Math.min(entry.equity_percentage, 5),
    asking_price_usd: Math.max(
      entry.investment_amount * 1.15,
      entry.equity_percentage * 1000
    ),
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/marketplace/listings", {
        cap_table_entry_id: entry.id,
        equity_to_sell_pct: Number(form.equity_to_sell_pct),
        asking_price_usd: Number(form.asking_price_usd),
        notes: form.notes,
      });
      toast.success("Listing posted to secondary marketplace");
      onCreated();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      data-testid="listing-modal"
    >
      <div className="rv-elev w-full max-w-md p-7 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500"
          data-testid="listing-modal-close-btn"
        >
          <X size={16} />
        </button>
        <p className="text-[10px] rv-mono uppercase tracking-[0.18em] text-zinc-500">
          Secondary listing
        </p>
        <h3 className="rv-display text-2xl mt-2">{entry.spv_name}</h3>
        <p className="text-xs text-zinc-500 mt-1 rv-mono">
          Your current stake: {fmtPct(entry.equity_percentage, 2)} · capital{" "}
          {fmtUsd(entry.investment_amount)}
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
              Equity to sell (%)
            </label>
            <input
              type="number"
              min={0.01}
              max={entry.equity_percentage}
              step={0.01}
              className="rv-input mt-1"
              value={form.equity_to_sell_pct}
              onChange={(e) =>
                setForm({ ...form, equity_to_sell_pct: e.target.value })
              }
              data-testid="listing-equity-input"
            />
          </div>
          <div>
            <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
              Asking price (USD)
            </label>
            <input
              type="number"
              min={1}
              className="rv-input mt-1"
              value={form.asking_price_usd}
              onChange={(e) =>
                setForm({ ...form, asking_price_usd: e.target.value })
              }
              data-testid="listing-price-input"
            />
          </div>
          <div>
            <label className="text-xs rv-mono uppercase tracking-[0.12em] text-zinc-500">
              Notes
            </label>
            <textarea
              rows={2}
              className="rv-input mt-1"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional context for buyers"
              data-testid="listing-notes-input"
            />
          </div>
          <button
            className="rv-btn-primary w-full"
            disabled={busy}
            data-testid="listing-submit-btn"
          >
            {busy ? "Listing…" : "Publish listing"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [myEntries, setMyEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickedEntry, setPickedEntry] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: l } = await api.get("/marketplace/listings");
      setListings(l);
      if (user?.role === "investor") {
        // Fetch my cap-table entries across all SPVs (only for investors)
        const { data: spvs } = await api.get("/spvs");
        const entries = [];
        for (const s of spvs) {
          const { data: ct } = await api.get(`/spvs/${s.id}/cap-table`);
          for (const e of ct) {
            if (e.user_id === user.id) {
              entries.push({ ...e, spv_name: s.name });
            }
          }
        }
        setMyEntries(entries);
      }
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const buy = async (listing) => {
    if (user?.role !== "investor") {
      toast.error("Investor account required to buy listings");
      return;
    }
    try {
      const { data } = await api.post("/marketplace/buy", {
        listing_id: listing.id,
        origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  const cancel = async (listing) => {
    try {
      await api.delete(`/marketplace/listings/${listing.id}`);
      toast.success("Listing canceled");
      load();
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  const visibleEntries = useMemo(
    () => myEntries.filter((e) => e.equity_percentage > 0.0001),
    [myEntries]
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10" data-testid="marketplace-page">
      <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
        Secondary marketplace
      </p>
      <h1 className="rv-display text-4xl mt-2">Equity Trading Floor</h1>
      <p className="text-sm text-zinc-400 mt-3 max-w-2xl">
        Investors can list a portion of their SPV equity to other verified
        investors. Settlement runs through Stripe; cap-table ownership transfers
        atomically when payment clears, and an immutable audit event is minted.
      </p>

      <div className="grid lg:grid-cols-3 gap-6 mt-10">
        <div className="lg:col-span-2">
          <h2 className="rv-heading text-xl mb-4">Open listings</h2>
          <div className="space-y-3" data-testid="marketplace-listings">
            {loading ? (
              <div className="rv-mono text-sm text-zinc-500">Loading…</div>
            ) : listings.length === 0 ? (
              <div className="rv-card p-8 text-center text-sm text-zinc-500">
                No active listings. Be the first to list your stake.
              </div>
            ) : (
              listings.map((l) => (
                <div
                  key={l.id}
                  className="rv-card p-5"
                  data-testid={`listing-row-${l.id}`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h3 className="rv-heading text-lg">{l.spv_name}</h3>
                      <p className="text-[11px] rv-mono text-zinc-500 mt-1 uppercase tracking-[0.12em]">
                        Seller · {l.seller_email}
                      </p>
                      {l.notes ? (
                        <p className="text-sm text-zinc-300 mt-3">{l.notes}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <div className="rv-display text-2xl rv-bronze">
                        {fmtUsd(l.asking_price_usd)}
                      </div>
                      <div className="text-[11px] rv-mono text-zinc-500">
                        for {fmtPct(l.equity_to_sell_pct, 2)} equity
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {l.seller_user_id === user?.id ? (
                      <button
                        onClick={() => cancel(l)}
                        className="rv-btn-ghost text-xs"
                        data-testid={`listing-cancel-btn-${l.id}`}
                      >
                        Cancel listing
                      </button>
                    ) : (
                      <button
                        onClick={() => buy(l)}
                        className="rv-btn-primary text-xs"
                        data-testid={`listing-buy-btn-${l.id}`}
                      >
                        Buy via Stripe
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rv-card p-6" data-testid="marketplace-my-positions">
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-[var(--rv-bronze)]" />
              <h3 className="rv-heading text-lg">List your stake</h3>
            </div>
            {user?.role !== "investor" ? (
              <p className="text-sm text-zinc-400 mt-3">
                Listing is only available to investor accounts. Switch to an
                investor login to list a position.
              </p>
            ) : visibleEntries.length === 0 ? (
              <p className="text-sm text-zinc-400 mt-3">
                You don't hold any tradable equity yet. Settle an SPV investment
                first.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleEntries.map((e) => (
                  <div
                    key={e.id}
                    className="border border-white/10 rounded-lg p-3"
                  >
                    <p className="rv-heading text-sm">{e.spv_name}</p>
                    <p className="text-[11px] rv-mono text-zinc-500 mt-1">
                      {fmtPct(e.equity_percentage, 2)} · {fmtUsd(e.investment_amount)}
                    </p>
                    <button
                      className="rv-btn-ghost text-xs mt-3 flex items-center gap-1"
                      onClick={() => setPickedEntry(e)}
                      data-testid={`marketplace-list-stake-btn-${e.id}`}
                    >
                      <ListPlus size={12} /> List for sale
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {pickedEntry ? (
        <ListingModal
          entry={pickedEntry}
          onClose={() => setPickedEntry(null)}
          onCreated={() => {
            setPickedEntry(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}
