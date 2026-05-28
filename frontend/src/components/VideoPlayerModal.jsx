import { X } from "lucide-react";

const SAMPLE_VIDEO_URL =
  "https://customer-assets.emergentagent.com/job_6ee13779-e2af-4a02-8741-92a684902527/artifacts/sample/vertical.mp4";

export default function VideoPlayerModal({ episode, onClose }) {
  if (!episode) return null;
  return (
    <div
      className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center px-4"
      data-testid="video-player-modal"
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 rv-btn-ghost text-sm flex items-center gap-2"
        data-testid="video-player-close-btn"
      >
        <X size={14} /> Close
      </button>
      <div className="max-w-md w-full">
        <p className="text-[10px] rv-mono uppercase tracking-[0.18em] text-zinc-500">
          {episode.series_title} · Ep {episode.episode_number}
        </p>
        <h3 className="rv-heading text-2xl mt-1 mb-4">{episode.title}</h3>
        <div className="aspect-[9/16] bg-black rounded-xl overflow-hidden border border-white/10 relative">
          <video
            className="w-full h-full object-cover"
            controls
            autoPlay
            playsInline
            poster=""
            data-testid="video-player-element"
          >
            <source src={SAMPLE_VIDEO_URL} type="video/mp4" />
          </video>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-zinc-400 rv-mono text-xs px-6 leading-relaxed bg-black/40 rounded-md p-3 backdrop-blur-sm">
              Demo player — your unlocked-content stream renders here.
              <br />
              Episode unlock has been settled and audited on-chain.
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500 leading-relaxed">
          {episode.description}
        </p>
      </div>
    </div>
  );
}
