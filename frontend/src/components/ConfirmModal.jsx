import { AlertTriangle } from "lucide-react";

/**
 * Reusable confirmation modal for high-stakes Human-in-the-Loop actions.
 *
 * Used for:
 *  - Cap-table entry deletion (POST /api/spvs/{id}/cap-table/{id})
 *  - Waterfall execution (POST /api/spvs/{id}/waterfall/execute)
 */
export default function ConfirmModal({
  open,
  title,
  description,
  warning,
  meta = [],
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
  testId = "confirm-modal",
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center px-4"
      data-testid={testId}
    >
      <div className="rv-elev w-full max-w-md p-7" role="dialog">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              destructive ? "bg-red-900/40 text-red-300" : "rv-bg-bronze text-black"
            }`}
          >
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] rv-mono uppercase tracking-[0.18em] text-zinc-500">
              Human-in-the-loop
            </p>
            <h3 className="rv-heading text-xl mt-1">{title}</h3>
          </div>
        </div>
        {description ? (
          <p className="text-sm text-zinc-300 mt-4 leading-relaxed">{description}</p>
        ) : null}
        {warning ? (
          <p
            className="text-xs rv-mono text-amber-200 mt-4 border border-amber-900/40 bg-amber-950/30 rounded-md p-3"
            data-testid={`${testId}-warning`}
          >
            {warning}
          </p>
        ) : null}
        {meta.length ? (
          <div className="mt-4 border border-white/10 rounded-md divide-y divide-white/5">
            {meta.map((m) => (
              <div
                key={m.label}
                className="flex items-center justify-between px-3 py-2 text-xs rv-mono"
              >
                <span className="text-zinc-500 uppercase tracking-[0.12em]">
                  {m.label}
                </span>
                <span className="text-white">{m.value}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rv-btn-ghost text-sm"
            disabled={busy}
            data-testid={`${testId}-cancel-btn`}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`text-sm rounded-full px-5 py-2.5 font-semibold transition ${
              destructive
                ? "bg-red-700 text-white hover:bg-red-600"
                : "rv-btn-primary"
            }`}
            data-testid={`${testId}-confirm-btn`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
