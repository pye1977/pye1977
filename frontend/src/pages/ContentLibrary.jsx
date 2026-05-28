import { useEffect, useMemo, useState } from "react";
import { Lock, Play, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, extractError, fmtUsdCents } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import VideoPlayerModal from "@/components/VideoPlayerModal";

function VideoCard({ ep, onUnlock, unlocking, onPlay }) {
  return (
    <div
      className="rv-card overflow-hidden flex flex-col"
      data-testid={`episode-card-${ep.id}`}
    >
      <div
        className={`aspect-[9/16] bg-gradient-to-b from-[#1a1a1d] via-[#0f0f10] to-[#0a0a0b] relative ${
          ep.unlocked ? "cursor-pointer" : ""
        }`}
        onClick={() => ep.unlocked && onPlay(ep)}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {ep.unlocked ? (
            <div
              className="w-12 h-12 rounded-full rv-bg-bronze flex items-center justify-center text-black"
              data-testid={`episode-play-${ep.id}`}
            >
              <Play size={18} />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-zinc-400">
              <Lock size={16} />
            </div>
          )}
        </div>
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="rv-chip">Ep {ep.episode_number}</span>
          <span className="text-[10px] rv-mono text-zinc-400">
            {Math.round(ep.duration_seconds)}s
          </span>
        </div>
      </div>
      <div className="p-4">
        <p className="text-[10px] rv-mono uppercase tracking-[0.15em] text-zinc-500">
          {ep.series_title}
        </p>
        <h3 className="rv-heading text-base mt-1">{ep.title}</h3>
        <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
          {ep.description}
        </p>
        <div className="flex items-center justify-between mt-4">
          <span className="rv-mono text-xs text-zinc-500">
            {ep.unlock_count} unlocks
          </span>
          {ep.unlocked ? (
            <button
              onClick={() => onPlay(ep)}
              className="rv-btn-ghost text-xs"
              data-testid={`episode-play-btn-${ep.id}`}
            >
              Play
            </button>
          ) : ep.unlock_price_usd === 0 ? (
            <button
              onClick={() => onUnlock(ep)}
              disabled={unlocking}
              className="rv-btn-ghost text-xs"
              data-testid={`episode-free-btn-${ep.id}`}
            >
              Free preview
            </button>
          ) : (
            <button
              onClick={() => onUnlock(ep)}
              disabled={unlocking}
              className="rv-btn-primary text-xs"
              data-testid={`episode-unlock-btn-${ep.id}`}
            >
              Unlock {fmtUsdCents(ep.unlock_price_usd)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContentLibrary() {
  const { user } = useAuth();
  const [episodes, setEpisodes] = useState([]);
  const [unlocking, setUnlocking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/episodes");
      setEpisodes(data);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const series = useMemo(() => {
    const m = new Map();
    for (const e of episodes) {
      if (!m.has(e.series_title)) m.set(e.series_title, []);
      m.get(e.series_title).push(e);
    }
    return Array.from(m.entries());
  }, [episodes]);

  const unlock = async (ep) => {
    if (!user || !user.id) {
      toast.error("Sign in to unlock episodes");
      return;
    }
    setUnlocking(true);
    try {
      const { data } = await api.post("/episodes/unlock", {
        episode_id: ep.id,
        origin_url: window.location.origin,
      });
      if (data.free) {
        toast.success("Preview unlocked");
        await load();
      } else if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10" data-testid="content-library">
      <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
        Vertical-first content layer
      </p>
      <h1 className="rv-display text-4xl mt-2">Content Library</h1>
      <p className="text-sm text-zinc-400 max-w-2xl mt-3">
        Per-episode micropayments settle directly into the production SPV
        waterfall — talent, investors, and producers participate in every
        unlock in real time.
      </p>

      <div className="mt-8 flex items-center gap-2 text-xs rv-mono text-zinc-500">
        <ShieldCheck size={12} className="text-[var(--rv-bronze)]" />
        Stripe-secured · Blockchain-attested · 60-90s vertical chapters
      </div>

      <div className="mt-10 space-y-12">
        {loading ? (
          <p className="text-zinc-500 rv-mono text-sm">Loading episodes…</p>
        ) : (
          series.map(([title, eps]) => (
            <div key={title} data-testid={`series-block-${title}`}>
              <h2 className="rv-heading text-2xl mb-4">{title}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {eps.map((ep) => (
                  <VideoCard
                    key={ep.id}
                    ep={ep}
                    onUnlock={unlock}
                    unlocking={unlocking}
                    onPlay={setPlaying}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {playing ? (
        <VideoPlayerModal episode={playing} onClose={() => setPlaying(null)} />
      ) : null}
    </div>
  );
}
