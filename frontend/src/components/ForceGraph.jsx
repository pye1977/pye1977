import { useMemo } from "react";

/**
 * Lightweight SVG force-graph for the supply-chain partner network.
 * Nodes are positioned by role-cluster (radial layout) — no external deps.
 */
function colorForRisk(score) {
  if (score < 35) return "#34d399"; // emerald
  if (score < 60) return "#d4af37"; // bronze
  if (score < 80) return "#f59e0b"; // amber
  return "#f87171"; // red
}

export default function ForceGraph({ vendors, onPick }) {
  const positioned = useMemo(() => {
    if (!vendors || vendors.length === 0) return [];
    const roleGroups = new Map();
    for (const v of vendors) {
      if (!roleGroups.has(v.role)) roleGroups.set(v.role, []);
      roleGroups.get(v.role).push(v);
    }
    const roles = Array.from(roleGroups.keys());
    const cx = 400;
    const cy = 300;
    const outerR = 220;
    const out = [];
    roles.forEach((role, ri) => {
      const items = roleGroups.get(role);
      const angle = (ri / roles.length) * Math.PI * 2 - Math.PI / 2;
      const clusterX = cx + Math.cos(angle) * outerR * 0.7;
      const clusterY = cy + Math.sin(angle) * outerR * 0.7;
      items.forEach((v, vi) => {
        const a = (vi / Math.max(items.length, 1)) * Math.PI * 2;
        const r = 24 + Math.min(items.length, 8) * 6;
        out.push({
          ...v,
          x: clusterX + Math.cos(a) * r,
          y: clusterY + Math.sin(a) * r,
          clusterX,
          clusterY,
          role,
        });
      });
    });
    return out;
  }, [vendors]);

  const center = { x: 400, y: 300 };
  if (!positioned.length) {
    return (
      <div className="rv-card p-10 text-center text-sm text-zinc-500" data-testid="force-graph-empty">
        Onboard vendors to render the verified partner network.
      </div>
    );
  }

  return (
    <div className="rv-card p-4 overflow-hidden" data-testid="force-graph-card">
      <svg viewBox="0 0 800 600" width="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="rv-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={center.x} cy={center.y} r="180" fill="url(#rv-core)" />
        <circle cx={center.x} cy={center.y} r="22" fill="#d4af37" />
        <text
          x={center.x}
          y={center.y + 4}
          textAnchor="middle"
          fontFamily="JetBrains Mono"
          fontWeight="700"
          fontSize="11"
          fill="#0a0a0b"
        >
          RVTD
        </text>

        {/* Lines to clusters */}
        {Array.from(new Set(positioned.map((p) => p.role))).map((role) => {
          const sample = positioned.find((p) => p.role === role);
          return (
            <line
              key={role}
              x1={center.x}
              y1={center.y}
              x2={sample.clusterX}
              y2={sample.clusterY}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          );
        })}

        {/* Lines to nodes */}
        {positioned.map((p) => (
          <line
            key={`l-${p.id}`}
            x1={p.clusterX}
            y1={p.clusterY}
            x2={p.x}
            y2={p.y}
            stroke="rgba(212,175,55,0.18)"
            strokeWidth="1"
          />
        ))}

        {/* Cluster labels */}
        {Array.from(new Set(positioned.map((p) => p.role))).map((role) => {
          const sample = positioned.find((p) => p.role === role);
          return (
            <text
              key={`t-${role}`}
              x={sample.clusterX}
              y={sample.clusterY - 70}
              textAnchor="middle"
              fontFamily="JetBrains Mono"
              fontSize="9"
              fontWeight="500"
              fill="rgba(255,255,255,0.65)"
              letterSpacing="2"
            >
              {role.replace("_", " ").toUpperCase()}
            </text>
          );
        })}

        {/* Vendor nodes */}
        {positioned.map((p) => (
          <g
            key={p.id}
            onClick={() => onPick?.(p)}
            style={{ cursor: onPick ? "pointer" : "default" }}
            data-testid={`force-graph-node-${p.id}`}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={8 + Math.min(8, p.delivery_history / 4)}
              fill={colorForRisk(p.risk_score)}
              opacity={p.blockchain_attested ? 1 : 0.55}
              stroke={p.blockchain_attested ? "#fff" : "transparent"}
              strokeWidth="1.5"
            />
            <text
              x={p.x}
              y={p.y + 22}
              textAnchor="middle"
              fontFamily="Manrope"
              fontWeight="600"
              fontSize="9"
              fill="rgba(255,255,255,0.85)"
            >
              {p.name.length > 22 ? p.name.slice(0, 21) + "…" : p.name}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-[10px] rv-mono text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="rv-dot" style={{ background: "#34d399" }} /> Low risk
        </span>
        <span className="flex items-center gap-1">
          <span className="rv-dot rv-bg-bronze" /> Moderate
        </span>
        <span className="flex items-center gap-1">
          <span className="rv-dot" style={{ background: "#f59e0b" }} /> Elevated
        </span>
        <span className="flex items-center gap-1">
          <span className="rv-dot" style={{ background: "#f87171" }} /> High
        </span>
        <span className="ml-auto">Node size = delivery history · ring = blockchain-attested</span>
      </div>
    </div>
  );
}
