"""Demo data seeding for RIVITED Solutions.

Idempotent: only seeds if database is empty of demo content.
Creates: producer, investor, distributor; sample SPVs with cap tables, waterfalls,
rights, episodes, and vendors.
"""
import logging
import uuid
from datetime import datetime, timezone

from auth import hash_password
from blockchain import append_event
from database import get_db

log = logging.getLogger(__name__)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def seed_demo_data() -> None:
    db = get_db()
    if await db.spvs.count_documents({}) > 0:
        return

    now = datetime.now(timezone.utc)

    # ----- Demo users -----
    demo_users = [
        {
            "email": "producer@rivited.io",
            "name": "Maya Okafor",
            "role": "producer",
            "password_hash": hash_password("demo1234"),
            "created_at": now,
        },
        {
            "email": "investor@rivited.io",
            "name": "Devon Kapoor",
            "role": "investor",
            "password_hash": hash_password("demo1234"),
            "created_at": now,
        },
        {
            "email": "distributor@rivited.io",
            "name": "Ines Salinas",
            "role": "distributor",
            "password_hash": hash_password("demo1234"),
            "created_at": now,
        },
    ]
    inserted_ids: dict[str, str] = {}
    for u in demo_users:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            inserted_ids[u["role"]] = str(existing["_id"])
        else:
            res = await db.users.insert_one(u)
            inserted_ids[u["role"]] = str(res.inserted_id)
    producer_id = inserted_ids["producer"]

    # ----- Demo SPVs -----
    spvs = [
        {
            "id": str(uuid.uuid4()),
            "name": "Saturn Falls",
            "description": (
                "A 60-episode vertical drama series about a fugitive ex-detective rebuilding "
                "her life in a coastal Galician fishing town. EU-Asia co-production."
            ),
            "type": "vertical_drama",
            "producer_id": producer_id,
            "producer_name": "Maya Okafor",
            "territory": "EU + South Korea + LATAM",
            "total_budget": 1_800_000.0,
            "raised_amount": 620_000.0,
            "minimum_investment": 5_000.0,
            "target_irr": 38.0,
            "status": "fundraising",
            "open_for_investment": True,
            "poster_url": "",
            "genre": "Drama / Thriller",
            "episode_count": 60,
            "created_at": _iso(now),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Neon Mahal",
            "description": (
                "Mumbai-set micro-content slate: 90 episodes of vertical-first romance set "
                "inside a decaying Art Deco hotel. AI-optimized for hook-retention curves."
            ),
            "type": "micro_content",
            "producer_id": producer_id,
            "producer_name": "Maya Okafor",
            "territory": "India + GCC + UK",
            "total_budget": 850_000.0,
            "raised_amount": 240_000.0,
            "minimum_investment": 1_000.0,
            "target_irr": 52.0,
            "status": "fundraising",
            "open_for_investment": True,
            "poster_url": "",
            "genre": "Romance / Period",
            "episode_count": 90,
            "created_at": _iso(now),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Black Lacquer",
            "description": (
                "Tokyo-Lagos thriller series — 40 episodes, vertical-format, blockchain-attested "
                "co-production with embedded rights ledger and chain-of-title verification."
            ),
            "type": "series",
            "producer_id": producer_id,
            "producer_name": "Maya Okafor",
            "territory": "Japan + Nigeria + USA",
            "total_budget": 2_400_000.0,
            "raised_amount": 1_980_000.0,
            "minimum_investment": 10_000.0,
            "target_irr": 31.0,
            "status": "in_production",
            "open_for_investment": True,
            "poster_url": "",
            "genre": "Thriller / Crime",
            "episode_count": 40,
            "created_at": _iso(now),
        },
    ]
    await db.spvs.insert_many([dict(s) for s in spvs])

    # ----- Cap table seed (Saturn Falls) -----
    sf = spvs[0]
    cap_entries = [
        {
            "id": str(uuid.uuid4()),
            "spv_id": sf["id"],
            "stakeholder_name": "Maya Okafor",
            "stakeholder_type": "producer",
            "user_id": producer_id,
            "equity_percentage": 22.0,
            "investment_amount": 0.0,
            "role": "Lead Producer / Showrunner",
            "created_at": _iso(now),
        },
        {
            "id": str(uuid.uuid4()),
            "spv_id": sf["id"],
            "stakeholder_name": "Devon Kapoor",
            "stakeholder_type": "investor",
            "user_id": inserted_ids["investor"],
            "equity_percentage": 18.0,
            "investment_amount": 320_000.0,
            "role": "Lead Equity Investor",
            "created_at": _iso(now),
        },
        {
            "id": str(uuid.uuid4()),
            "spv_id": sf["id"],
            "stakeholder_name": "Helia Park",
            "stakeholder_type": "actor",
            "user_id": None,
            "equity_percentage": 6.0,
            "investment_amount": 0.0,
            "role": "Lead Talent — Backend Participation",
            "created_at": _iso(now),
        },
        {
            "id": str(uuid.uuid4()),
            "spv_id": sf["id"],
            "stakeholder_name": "Casa Atlántico Studios",
            "stakeholder_type": "distributor",
            "user_id": None,
            "equity_percentage": 12.0,
            "investment_amount": 0.0,
            "role": "Iberian Distribution Partner",
            "created_at": _iso(now),
        },
    ]
    await db.cap_table.insert_many([dict(c) for c in cap_entries])

    # ----- Waterfall seed (Saturn Falls) -----
    tiers = [
        {
            "id": str(uuid.uuid4()),
            "spv_id": sf["id"],
            "tier": 1,
            "name": "Senior Debt Repayment",
            "description": "Recoupment of senior debt facility from co-financiers.",
            "percentage": 100.0,
            "cap_amount": 200_000.0,
            "paid_amount": 0.0,
            "created_at": _iso(now),
        },
        {
            "id": str(uuid.uuid4()),
            "spv_id": sf["id"],
            "tier": 2,
            "name": "Investor Recoupment",
            "description": "1.2x return of investor capital before profit sharing.",
            "percentage": 80.0,
            "cap_amount": 740_000.0,
            "paid_amount": 0.0,
            "created_at": _iso(now),
        },
        {
            "id": str(uuid.uuid4()),
            "spv_id": sf["id"],
            "tier": 3,
            "name": "Producer / Talent Backend",
            "description": "Profit participation across producer, talent, writers, distributor.",
            "percentage": 100.0,
            "cap_amount": None,
            "paid_amount": 0.0,
            "created_at": _iso(now),
        },
    ]
    await db.waterfall_tiers.insert_many([dict(t) for t in tiers])

    # ----- Rights seed (Saturn Falls) -----
    parent_hash = None
    for r in [
        {
            "type": "streaming",
            "territory": "EU",
            "owner_name": "Saturn Falls SPV",
            "duration_years": 7,
            "royalty_percentage": 30.0,
        },
        {
            "type": "broadcast",
            "territory": "South Korea",
            "owner_name": "JTBC Studios",
            "duration_years": 5,
            "royalty_percentage": 12.0,
        },
        {
            "type": "distribution",
            "territory": "LATAM",
            "owner_name": "Casa Atlántico Studios",
            "duration_years": 6,
            "royalty_percentage": 18.0,
        },
        {
            "type": "merchandise",
            "territory": "Worldwide",
            "owner_name": "Saturn Falls SPV",
            "duration_years": 10,
            "royalty_percentage": 8.0,
        },
    ]:
        event = await append_event(
            "right_minted",
            {
                "spv_id": sf["id"],
                "type": r["type"],
                "territory": r["territory"],
                "owner_name": r["owner_name"],
                "royalty_pct": r["royalty_percentage"],
                "duration_years": r["duration_years"],
            },
            actor_user_id=producer_id,
            actor_name="Maya Okafor",
            spv_id=sf["id"],
        )
        doc = {
            "id": str(uuid.uuid4()),
            "spv_id": sf["id"],
            "type": r["type"],
            "territory": r["territory"],
            "owner_name": r["owner_name"],
            "owner_user_id": None,
            "duration_years": r["duration_years"],
            "royalty_percentage": r["royalty_percentage"],
            "status": "active",
            "chain_hash": event["block_hash"],
            "parent_hash": parent_hash,
            "created_at": _iso(now),
        }
        await db.rights.insert_one(doc)
        parent_hash = event["block_hash"]

    # ----- Episodes seed (Saturn Falls) -----
    episodes = []
    for i in range(1, 7):
        episodes.append(
            {
                "id": str(uuid.uuid4()),
                "spv_id": sf["id"],
                "series_title": "Saturn Falls",
                "episode_number": i,
                "title": f"Chapter {i}",
                "duration_seconds": 90,
                "unlock_price_usd": 0.99 if i > 1 else 0.0,
                "thumbnail_url": "",
                "description": "A 90-second vertical chapter from Saturn Falls.",
                "unlock_count": 0,
                "created_at": _iso(now),
            }
        )
    nm = spvs[1]
    for i in range(1, 5):
        episodes.append(
            {
                "id": str(uuid.uuid4()),
                "spv_id": nm["id"],
                "series_title": "Neon Mahal",
                "episode_number": i,
                "title": f"Episode {i}",
                "duration_seconds": 85,
                "unlock_price_usd": 0.99 if i > 1 else 0.0,
                "thumbnail_url": "",
                "description": "A vertical-format romance chapter.",
                "unlock_count": 0,
                "created_at": _iso(now),
            }
        )
    await db.episodes.insert_many(episodes)

    # ----- Vendors seed -----
    vendors = [
        {
            "id": str(uuid.uuid4()),
            "name": "Atlas VFX Cooperative",
            "role": "vfx",
            "territory": "Lisbon",
            "delivery_history": 18,
            "verified": True,
            "compliance_score": 92.0,
            "risk_score": 18.0,
            "risk_label": "low",
            "risk_factors": [],
            "blockchain_attested": True,
            "description": "Senior VFX house with 18 vertical drama deliveries.",
            "created_at": _iso(now),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Hangul Post Tokyo",
            "role": "post_production",
            "territory": "Tokyo",
            "delivery_history": 11,
            "verified": True,
            "compliance_score": 88.0,
            "risk_score": 26.0,
            "risk_label": "low",
            "risk_factors": [],
            "blockchain_attested": True,
            "description": "Trilingual post-production for KR/JP/EN deliverables.",
            "created_at": _iso(now),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Mar de Plata Localization",
            "role": "localization",
            "territory": "Buenos Aires",
            "delivery_history": 6,
            "verified": False,
            "compliance_score": 71.0,
            "risk_score": 52.0,
            "risk_label": "moderate",
            "risk_factors": ["Limited audit history", "No blockchain attestation"],
            "blockchain_attested": False,
            "description": "LATAM dub & subtitling. Boutique studio.",
            "created_at": _iso(now),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Studio Kasai (newcomer)",
            "role": "production_company",
            "territory": "Lagos",
            "delivery_history": 2,
            "verified": False,
            "compliance_score": 58.0,
            "risk_score": 68.0,
            "risk_label": "elevated",
            "risk_factors": ["Short track record", "Compliance docs incomplete"],
            "blockchain_attested": False,
            "description": "Emerging Lagos-based production company.",
            "created_at": _iso(now),
        },
    ]
    await db.vendors.insert_many(vendors)
    log.info("Seeded RIVITED demo data: %d SPVs, %d episodes", len(spvs), len(episodes))
