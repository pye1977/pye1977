# RIVITED Solutions — Product Requirements Document

## Original Problem Statement
> "Please build out, as carefully and detail-attentively as possible, the vertically integrated media supply chain technological innovation proposed in the attached PDF document."

The PDF describes **RIVITED Solutions** — a vertically integrated AI + Web3-driven Financial Infrastructure SaaS for the media & entertainment industry, focused on vertical micro-content. Positioned as *"the Nasdaq of digital entertainment rights, the Stripe of entertainment payments, the Bloomberg of production intelligence."*

## Architecture
- **Backend**: FastAPI + MongoDB (async via Motor)
- **Frontend**: React 19 + Tailwind + Shadcn/UI + Lucide + Sonner toasts
- **Auth**: Custom JWT (bcrypt + httpOnly cookies) with roles (producer / investor / distributor / admin)
- **AI**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via Emergent LLM Key (`emergentintegrations`)
- **Payments**: Stripe (test mode) via `emergentintegrations.payments.stripe.checkout`
- **Blockchain**: Simulated SHA-256 chain stored in `audit_events` MongoDB collection

## User Personas
| Role         | Primary jobs |
|--------------|--------------|
| Producer     | Mint SPVs, configure cap tables + waterfalls, mint rights, run AI budget forecasts & deal memos, add episodes |
| Investor     | Discover open SPVs, invest via Stripe, track portfolio + payouts |
| Distributor  | Run AI Greenlight score + Deal Memo on any SPV, browse rights |
| Admin        | Platform-wide oversight (all SPVs, vendors, audit) |
| Public       | Landing page + Content Library (micropayment unlocks) |

## Implemented (1st Finish — May 28, 2026)
### Backend modules
- `auth.py` — register/login/logout/me/refresh (JWT, bcrypt, brute-force lockout, role enforcement, admin seed)
- `routes_finance.py` — SPVs (CRUD), Cap Tables, Waterfall tiers + execute, Investments (Stripe Checkout), Payouts, payment status polling, Stripe webhook
- `routes_rights.py` — Rights ledger (chain-of-title hashing), Audit trail viewer, Vendors (AI risk scored on creation)
- `routes_content.py` — Episodes CRUD, micropayment unlocks (Stripe)
- `routes_ai.py` — AI Budget Forecast, AI Deal Memo, AI Greenlight Score, AI Rights Conflict Resolution
- `blockchain.py` — Simulated SHA-256 chained audit ledger
- `seed.py` — Idempotent demo data (3 SPVs, cap table, waterfall, 10 episodes, 4 vendors, 4 rights with chain-of-title)

### Frontend pages
- Landing (cinematic hero + modules + producer/investor splits + CTA)
- Login / Register (with one-click demo presets)
- Producer Dashboard (SPV list, AI Budget Forecast widget, treasury rails)
- Investor Dashboard (opportunities, Stripe checkout modal, portfolio + payouts)
- Distributor Dashboard (per-SPV AI Greenlight + Deal Memo)
- Admin Dashboard (system overview, all SPVs + vendors)
- SPV Detail (Cap Table + Rights Ledger + Waterfall (configure + execute) + Per-SPV Audit Trail + Toggle investment)
- Content Library (per-episode unlock with Stripe checkout)
- Supply Chain (vendor onboarding with AI risk scoring, verified partner cards)
- Audit Trail (system-wide block explorer)
- Payment Return (Stripe polling with 8 attempts)

### Design
- Dark cinematic theme (obsidian + bronze + signal-white) per `/app/design_guidelines.json`
- Manrope + JetBrains Mono typography
- Glass nav, grain hero, cinematic vignette, micro-animations on hover

## Test Credentials
See `/app/memory/test_credentials.md`. Demo: producer/investor/distributor @ rivited.io / `demo1234`. Admin: `admin@rivited.io` / `rivited2026`.

## Deferred / Backlog (P1/P2)
- P1: Real-time UI updates via websockets when waterfall executes
- P1: Cross-border payout rails detail UI (FX/tax/union breakdown)
- P1: Producer side residuals timeline & milestone triggers
- P1: Per-episode video playback for unlocked content
- P2: Network-graph visualization for supply chain (React Force Graph)
- P2: NFT-enabled ownership utilities for rights
- P2: Tokenized licensing marketplace
- P2: Multi-currency + stablecoin settlement (currently USD via Stripe test)
- P2: Investor KYC/AML onboarding workflow
- P2: Forgot password + reset flow UI

## Next Tasks
1. End-to-end test all flows via testing agent
2. Patch any blocking issues surfaced
3. Showcase to user; gather feedback for P1 priorities
