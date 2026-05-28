import { Link } from "react-router-dom";
import { ArrowUpRight, Boxes, Coins, Film, GitBranch, ScrollText, ShieldCheck, Sparkles, Workflow } from "lucide-react";

const HERO_IMG =
  "https://static.prod-images.emergentagent.com/jobs/6ee13779-e2af-4a02-8741-92a684902527/images/6ed3117b5364c13b31078b20d79ea934c55192f644d9b7be7dda827574bca446.png";

const CAMERA_IMG =
  "https://static.prod-images.emergentagent.com/jobs/6ee13779-e2af-4a02-8741-92a684902527/images/616487ed49dff8b2f51107621d6e54c07d19941b90c951c6db909160ee25bc7e.png";

const LEDGER_IMG =
  "https://static.prod-images.emergentagent.com/jobs/6ee13779-e2af-4a02-8741-92a684902527/images/4df7f807c529209750f31c5235d1493c174620fd0d24ec907b1b0a54aafa4fb0.png";

const PARTNERS = [
  "Bloomberg",
  "SAP",
  "Stripe",
  "Netflix Studio Ops",
  "Carta",
  "Fireblocks",
  "Unity",
  "ByteDance",
  "Snowflake",
  "Tencent",
];

const MODULES = [
  {
    icon: Workflow,
    title: "Programmable Production Finance OS",
    body: "Digital SPVs, automated cap tables, smart waterfall accounting, and embedded production banking — every production becomes a programmable financial entity from day one.",
  },
  {
    icon: ScrollText,
    title: "Immutable Rights Ledger",
    body: "Chain-of-title verification, programmable royalty contracts, and AI-assisted rights conflict resolution settle who owns what, where, and for how long — in seconds.",
  },
  {
    icon: Sparkles,
    title: "AI Commissioning & Greenlighting",
    body: "Score every concept with completion probability, projected revenue bands, casting recommendations, and territory prioritization — institutional intelligence before a single dollar is committed.",
  },
  {
    icon: GitBranch,
    title: "Supply-Chain Intelligence",
    body: "Map every micro-content producer, VFX house, localization studio and post-production vendor. Verified delivery history, compliance attestation, and AI risk scoring.",
  },
  {
    icon: Coins,
    title: "Cross-Border Settlement Rails",
    body: "Stablecoin-routed payouts, licensed custodians, FX conversion, tax withholding, and union obligation automation — built for global vertical media from day one.",
  },
  {
    icon: ShieldCheck,
    title: "Blockchain Audit Trail",
    body: "Every SPV mint, cap-table change, rights event, waterfall execution, and investor settlement is appended to an immutable ledger. Auditable forever.",
  },
];

const STATS = [
  { num: "60s", label: "Vertical micro-content episode" },
  { num: "8 tiers", label: "Average configured revenue waterfall" },
  { num: "$0.49", label: "Median micropayment unlock" },
  { num: "4.2x", label: "Faster cross-border settlement" },
];

export default function Landing() {
  return (
    <div data-testid="landing-page">
      {/* HERO */}
      <section className="relative overflow-hidden rv-grain rv-vignette" data-testid="landing-hero">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url(${HERO_IMG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--rv-bg)]/40 via-[var(--rv-bg)]/55 to-[var(--rv-bg)]" />

        <div className="relative max-w-[1400px] mx-auto px-6 pt-24 pb-32">
          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8">
              <span className="rv-chip" data-testid="landing-eyebrow">
                <span className="rv-dot rv-bg-bronze" />
                Programmable Production Finance OS
              </span>
              <h1 className="rv-display text-5xl sm:text-6xl lg:text-7xl mt-7" data-testid="landing-h1">
                The financial <span className="rv-bronze">infrastructure</span>
                <br /> for the global media supply chain.
              </h1>
              <p className="mt-7 max-w-2xl text-lg text-zinc-400 leading-relaxed" data-testid="landing-subhead">
                RIVITED Solutions is the AI- and Web3-driven, vertically
                integrated platform for micro-content and vertical media:
                fundraising, production finance, rights, distribution, and
                participation accounting — settled in seconds, audited forever.
              </p>

              <div className="mt-9 flex flex-wrap gap-3" data-testid="landing-cta-row">
                <Link to="/register" className="rv-btn-primary flex items-center gap-2" data-testid="landing-primary-cta">
                  Get platform access <ArrowUpRight size={16} />
                </Link>
                <Link to="/login" className="rv-btn-ghost" data-testid="landing-secondary-cta">
                  Sign in
                </Link>
              </div>

              <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-3">
                <p className="text-[11px] rv-mono uppercase tracking-[0.2em] text-zinc-500">
                  Positioned as
                </p>
                <p className="text-sm text-zinc-300">
                  The <span className="rv-bronze">Nasdaq</span> of digital
                  entertainment rights · the <span className="rv-bronze">Stripe</span>{" "}
                  of entertainment payments · the{" "}
                  <span className="rv-bronze">Bloomberg</span> of production
                  intelligence.
                </p>
              </div>
            </div>

            {/* Side card – ledger live preview */}
            <div className="lg:col-span-4 lg:pl-6">
              <div className="rv-card p-5 backdrop-blur-md bg-black/40" data-testid="landing-ledger-card">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] rv-mono uppercase tracking-[0.18em] text-zinc-500">
                    Live audit trail
                  </p>
                  <span className="rv-chip">
                    <span className="rv-dot rv-bg-bronze" /> Block #12,438
                  </span>
                </div>
                <div className="mt-5 space-y-3 rv-mono text-[12px]">
                  {[
                    ["spv_created", "Saturn Falls"],
                    ["cap_table_entry_added", "Lead Investor +18%"],
                    ["right_minted", "EU · streaming · 7y"],
                    ["waterfall_executed", "$214,800 distributed"],
                    ["episode_unlocked", "$0.49 · micropay"],
                  ].map(([type, body]) => (
                    <div key={type} className="flex items-start gap-3">
                      <span className="rv-bronze">●</span>
                      <div>
                        <div className="text-zinc-100">{type}</div>
                        <div className="text-zinc-500">{body}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 text-[10px] rv-mono text-zinc-600">
                  0xa83f…21de2 → 0x9b1c…7e0a4
                </div>
              </div>
            </div>
          </div>

          {/* Stat strip */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden" data-testid="landing-stats-row">
            {STATS.map((s) => (
              <div key={s.label} className="bg-[var(--rv-bg)] p-6">
                <div className="rv-heading text-3xl rv-bronze">{s.num}</div>
                <div className="text-xs text-zinc-500 mt-2 rv-mono uppercase tracking-[0.1em]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARTNERS marquee */}
      <section className="border-y border-white/5" data-testid="landing-partners">
        <div className="max-w-[1400px] mx-auto py-7 overflow-hidden">
          <div className="flex gap-12 whitespace-nowrap rv-marquee">
            {[...PARTNERS, ...PARTNERS].map((p, i) => (
              <span
                key={`${p}-${i}`}
                className="rv-mono text-[12px] uppercase tracking-[0.25em] text-zinc-500"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="max-w-[1400px] mx-auto px-6 py-28">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
              The fragmentation paradox
            </p>
            <h2 className="rv-display text-4xl sm:text-5xl mt-3">
              Capital is fragmented.
              <br /> Rights are opaque.
              <br /> <span className="rv-bronze">Payouts arrive late.</span>
            </h2>
          </div>
          <div className="lg:col-span-7 lg:pt-8 text-zinc-400 leading-relaxed text-lg">
            <p>
              Vertical drama studios, micro-content producers, indie financiers,
              localization vendors, and distribution partners operate inside a
              broken supply chain. Cap tables live in spreadsheets. Royalty
              statements arrive quarterly — often years late. Cross-border
              settlements bleed weeks. Chain-of-title gets disputed in court.
            </p>
            <p className="mt-5">
              RIVITED collapses this stack into a single programmable layer.
              Every production is a digital SPV with embedded rights, automated
              waterfalls, and real-time participation accounting. Every dollar
              is traceable. Every right is verifiable. Every payout is
              settled in seconds.
            </p>
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section className="border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 py-28">
          <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
            The vertical stack
          </p>
          <h2 className="rv-display text-4xl sm:text-5xl mt-3 max-w-3xl">
            A zero-to-one infrastructure for the entire production lifecycle.
          </h2>

          <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="landing-modules-grid">
            {MODULES.map((m, idx) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.title}
                  className="rv-card p-7"
                  data-testid={`landing-module-${idx}`}
                >
                  <div className="flex items-center justify-between">
                    <Icon size={22} className="text-[var(--rv-bronze)]" />
                    <span className="text-[10px] rv-mono text-zinc-600">
                      0{idx + 1}
                    </span>
                  </div>
                  <h3 className="rv-heading text-xl mt-6">{m.title}</h3>
                  <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                    {m.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SPLIT — Producer side */}
      <section className="border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 py-28 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 relative">
            <div
              className="aspect-[4/3] rounded-2xl bg-cover bg-center border border-white/10"
              style={{ backgroundImage: `url(${CAMERA_IMG})` }}
            />
            <div className="absolute -bottom-6 -right-6 rv-card p-5 w-64 backdrop-blur-md bg-black/40 hidden md:block">
              <p className="text-[10px] rv-mono uppercase tracking-[0.18em] text-zinc-500">
                Cap Table — Saturn Falls
              </p>
              <table className="rv-table mt-3">
                <tbody>
                  <tr>
                    <td>Lead Producer</td>
                    <td className="text-right rv-bronze">22.00%</td>
                  </tr>
                  <tr>
                    <td>Lead Investor</td>
                    <td className="text-right">18.00%</td>
                  </tr>
                  <tr>
                    <td>Talent</td>
                    <td className="text-right">6.00%</td>
                  </tr>
                  <tr>
                    <td>Distributor</td>
                    <td className="text-right">12.00%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="lg:col-span-6 lg:pl-10">
            <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
              For producers
            </p>
            <h2 className="rv-display text-4xl mt-3">
              Spin up a digital SPV in <span className="rv-bronze">minutes</span> — not months.
            </h2>
            <p className="mt-5 text-zinc-400 leading-relaxed text-lg">
              Define your production. Configure the waterfall. Mint your rights
              ledger. Open to verified investors. RIVITED handles cap tables,
              residuals, FX, tax withholding, and union obligations as
              programmable primitives.
            </p>
            <ul className="mt-7 space-y-3 text-sm">
              {[
                "Auto-cap-table that updates on every investment settlement",
                "AI Budget Forecasting tuned to genre, territory, episode count",
                "AI-drafted institutional Deal Memo in under 30 seconds",
                "Rights minted directly to an immutable, AI-cleared ledger",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <Film size={14} className="text-[var(--rv-bronze)] mt-1" />
                  <span className="text-zinc-300">{line}</span>
                </li>
              ))}
            </ul>
            <Link to="/register" className="rv-btn-primary inline-flex items-center gap-2 mt-9" data-testid="landing-producer-cta">
              Onboard a production <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* SPLIT — Investor side */}
      <section className="border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 py-28 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 lg:pr-10 lg:order-1 order-2">
            <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
              For investors
            </p>
            <h2 className="rv-display text-4xl mt-3">
              Direct equity into <span className="rv-bronze">vertical drama slates</span> — transparently.
            </h2>
            <p className="mt-5 text-zinc-400 leading-relaxed text-lg">
              Diligence is instant. Cap tables, rights, supply-chain partners,
              and AI greenlight scoring sit in one institutional dashboard.
              Settlement happens in seconds via stablecoin rails. Residuals
              flow automatically through the smart waterfall.
            </p>
            <ul className="mt-7 space-y-3 text-sm">
              {[
                "AI Greenlight score with completion probability",
                "Live ROI tracking across the production lifecycle",
                "Smart waterfall payouts settle to your wallet",
                "Stripe-secured equity payments with audit trail",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <Boxes size={14} className="text-[var(--rv-bronze)] mt-1" />
                  <span className="text-zinc-300">{line}</span>
                </li>
              ))}
            </ul>
            <Link to="/register" className="rv-btn-primary inline-flex items-center gap-2 mt-9" data-testid="landing-investor-cta">
              Open an investor account <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="lg:col-span-6 relative lg:order-2 order-1">
            <div
              className="aspect-[4/3] rounded-2xl bg-cover bg-center border border-white/10"
              style={{ backgroundImage: `url(${LEDGER_IMG})` }}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 py-24 text-center">
          <p className="text-xs rv-mono uppercase tracking-[0.18em] text-zinc-500">
            The future of media finance is programmable
          </p>
          <h2 className="rv-display text-4xl sm:text-5xl mt-3 max-w-3xl mx-auto">
            Bring your production. We'll handle the <span className="rv-bronze">capital stack</span>.
          </h2>
          <div className="mt-10 flex justify-center gap-3 flex-wrap" data-testid="landing-bottom-cta-row">
            <Link to="/register" className="rv-btn-primary flex items-center gap-2" data-testid="landing-bottom-cta">
              Request access <ArrowUpRight size={16} />
            </Link>
            <Link to="/library" className="rv-btn-ghost" data-testid="landing-library-cta">
              Explore the content library
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500 rv-mono">
          <div>© RIVITED Solutions · Programmable Production Finance OS</div>
          <div>v1.0 · MVP · simulated chain layer</div>
        </div>
      </footer>
    </div>
  );
}
