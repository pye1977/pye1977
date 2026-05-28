export default function StatCard({ label, value, sub, accent, testId }) {
  return (
    <div className="rv-card p-5" data-testid={testId}>
      <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 rv-mono">
        {label}
      </div>
      <div
        className={`mt-2 rv-heading text-3xl ${accent ? "rv-bronze" : "text-white"}`}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-2 text-xs text-zinc-500 rv-mono">{sub}</div>
      ) : null}
    </div>
  );
}
