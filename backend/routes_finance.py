"""Routes: SPVs, Cap Tables, Waterfalls, Investments (Stripe), Payouts."""
import os
from datetime import datetime, timezone
from typing import Any

from emergentintegrations.payments.stripe.checkout import (
    CheckoutSessionRequest,
    StripeCheckout,
)
from fastapi import APIRouter, Depends, HTTPException, Request

from auth import get_current_user, require_role
from blockchain import append_event
from database import get_db
from models import (
    CapTableEntry,
    CapTableEntryCreate,
    Investment,
    InvestmentCreate,
    SPV,
    SPVCreate,
    WaterfallExecuteRequest,
    WaterfallTier,
    WaterfallTierCreate,
)
from security import (
    issue_confirmation_token,
    sanitize_text,
    verify_confirmation_token,
)

router = APIRouter(prefix="/api", tags=["finance"])


def _strip_mongo(doc: dict[str, Any]) -> dict[str, Any]:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


# ---------------- SPVs ----------------
@router.post("/spvs", response_model=SPV)
async def create_spv(
    payload: SPVCreate, user=Depends(require_role("producer"))
):
    db = get_db()
    spv = SPV(
        name=payload.name,
        description=sanitize_text(payload.description, max_len=2000),
        type=payload.type,
        producer_id=user["id"],
        producer_name=user["name"],
        territory=sanitize_text(payload.territory, max_len=120),
        total_budget=payload.total_budget,
        minimum_investment=payload.minimum_investment,
        target_irr=payload.target_irr,
        genre=sanitize_text(payload.genre, max_len=80),
        episode_count=payload.episode_count,
    )
    doc = spv.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.spvs.insert_one(doc)
    await append_event(
        "spv_created",
        {"spv_id": spv.id, "name": spv.name, "budget": spv.total_budget},
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv.id,
    )
    # Seed producer's own cap table entry (10% producer's equity by default; user can edit)
    producer_entry = CapTableEntry(
        spv_id=spv.id,
        stakeholder_name=user["name"],
        stakeholder_type="producer",
        user_id=user["id"],
        equity_percentage=10.0,
        investment_amount=0.0,
        role="Lead Producer",
    )
    entry_doc = producer_entry.model_dump()
    entry_doc["created_at"] = entry_doc["created_at"].isoformat()
    await db.cap_table.insert_one(entry_doc)
    return spv


@router.get("/spvs")
async def list_spvs(
    status: str | None = None,
    open_for_investment: bool | None = None,
    mine: bool = False,
    user=Depends(get_current_user),
):
    db = get_db()
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    if open_for_investment is not None:
        query["open_for_investment"] = open_for_investment
    if mine:
        query["producer_id"] = user["id"]
    cursor = db.spvs.find(query, {"_id": 0}).sort("created_at", -1)
    return [doc async for doc in cursor]


@router.get("/spvs/{spv_id}")
async def get_spv(spv_id: str, user=Depends(get_current_user)):
    db = get_db()
    spv = await db.spvs.find_one({"id": spv_id}, {"_id": 0})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    return spv


@router.patch("/spvs/{spv_id}")
async def update_spv(
    spv_id: str,
    payload: dict[str, Any],
    user=Depends(get_current_user),
):
    db = get_db()
    spv = await db.spvs.find_one({"id": spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    if spv["producer_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not the SPV producer")
    allowed = {
        "status",
        "open_for_investment",
        "description",
        "poster_url",
        "target_irr",
        "minimum_investment",
        "name",
        "genre",
    }
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No allowed fields to update")
    await db.spvs.update_one({"id": spv_id}, {"$set": update})
    await append_event(
        "spv_updated",
        {"spv_id": spv_id, "changes": update},
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv_id,
    )
    return await db.spvs.find_one({"id": spv_id}, {"_id": 0})


# ---------------- Cap Table ----------------
@router.post("/spvs/{spv_id}/cap-table", response_model=CapTableEntry)
async def add_cap_table_entry(
    spv_id: str,
    payload: CapTableEntryCreate,
    user=Depends(get_current_user),
):
    db = get_db()
    spv = await db.spvs.find_one({"id": spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    if spv["producer_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only producer can edit cap table")
    entry = CapTableEntry(spv_id=spv_id, **payload.model_dump())
    doc = entry.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.cap_table.insert_one(doc)
    await append_event(
        "cap_table_entry_added",
        {
            "spv_id": spv_id,
            "stakeholder": entry.stakeholder_name,
            "equity_pct": entry.equity_percentage,
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv_id,
    )
    return entry


@router.get("/spvs/{spv_id}/cap-table")
async def list_cap_table(spv_id: str, user=Depends(get_current_user)):
    db = get_db()
    cursor = db.cap_table.find({"spv_id": spv_id}, {"_id": 0}).sort(
        "equity_percentage", -1
    )
    return [doc async for doc in cursor]


@router.delete("/spvs/{spv_id}/cap-table/{entry_id}")
async def delete_cap_table_entry(
    spv_id: str,
    entry_id: str,
    confirmation_token: str | None = None,
    user=Depends(get_current_user),
):
    db = get_db()
    spv = await db.spvs.find_one({"id": spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    if spv["producer_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only producer can edit cap table")
    entry = await db.cap_table.find_one({"id": entry_id, "spv_id": spv_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # Human-in-the-loop: 2-step delete. First call returns a confirmation token
    # describing the impact; client re-submits with the token to actually delete.
    if not confirmation_token:
        return issue_confirmation_token(
            user_id=user["id"],
            action="cap_table.delete",
            resource_id=entry_id,
            extra={
                "spv_name": spv["name"],
                "stakeholder_name": entry["stakeholder_name"],
                "equity_percentage": entry["equity_percentage"],
                "investment_amount": entry.get("investment_amount", 0.0),
                "warning": (
                    f"This will permanently remove {entry['stakeholder_name']} "
                    f"({entry['equity_percentage']}% equity) from the cap table. "
                    "All future waterfall payouts will skip this stakeholder."
                ),
            },
        )
    try:
        verify_confirmation_token(
            confirmation_token, user["id"], "cap_table.delete", entry_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await db.cap_table.delete_one({"id": entry_id, "spv_id": spv_id})
    await append_event(
        "cap_table_entry_removed",
        {"spv_id": spv_id, "entry_id": entry_id},
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv_id,
    )
    return {"ok": True}


# ---------------- Waterfall ----------------
@router.post("/spvs/{spv_id}/waterfall", response_model=WaterfallTier)
async def add_waterfall_tier(
    spv_id: str,
    payload: WaterfallTierCreate,
    user=Depends(get_current_user),
):
    db = get_db()
    spv = await db.spvs.find_one({"id": spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    if spv["producer_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only producer can edit waterfall")
    tier = WaterfallTier(spv_id=spv_id, **payload.model_dump())
    doc = tier.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.waterfall_tiers.insert_one(doc)
    await append_event(
        "waterfall_tier_added",
        {"spv_id": spv_id, "tier": tier.tier, "name": tier.name},
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv_id,
    )
    return tier


@router.get("/spvs/{spv_id}/waterfall")
async def list_waterfall(spv_id: str, user=Depends(get_current_user)):
    db = get_db()
    cursor = db.waterfall_tiers.find({"spv_id": spv_id}, {"_id": 0}).sort("tier", 1)
    return [doc async for doc in cursor]


@router.post("/spvs/{spv_id}/waterfall/execute")
async def execute_waterfall(
    spv_id: str,
    payload: WaterfallExecuteRequest,
    user=Depends(get_current_user),
):
    """Simulate executing the revenue waterfall: distribute revenue across tiers."""
    db = get_db()
    spv = await db.spvs.find_one({"id": spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    if spv["producer_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only producer can run waterfall")

    tiers = [
        doc
        async for doc in db.waterfall_tiers.find({"spv_id": spv_id}).sort("tier", 1)
    ]
    cap_entries = [
        doc async for doc in db.cap_table.find({"spv_id": spv_id})
    ]
    if not tiers:
        raise HTTPException(
            status_code=400, detail="No waterfall tiers configured for this SPV"
        )

    remaining = payload.revenue_amount
    distributions: list[dict[str, Any]] = []

    for tier in tiers:
        if remaining <= 0:
            break
        tier_portion = remaining * (tier["percentage"] / 100.0)
        if tier.get("cap_amount") is not None:
            cap_left = max(0.0, tier["cap_amount"] - tier.get("paid_amount", 0.0))
            tier_portion = min(tier_portion, cap_left)
        if tier_portion <= 0:
            continue
        remaining -= tier_portion
        await db.waterfall_tiers.update_one(
            {"id": tier["id"]}, {"$inc": {"paid_amount": tier_portion}}
        )
        # Allocate this tier's portion across cap-table stakeholders by equity %
        total_pct = sum(e["equity_percentage"] for e in cap_entries) or 100.0
        for entry in cap_entries:
            share = tier_portion * (entry["equity_percentage"] / total_pct)
            payout_doc = {
                "id": str(__import__("uuid").uuid4()),
                "spv_id": spv_id,
                "stakeholder_name": entry["stakeholder_name"],
                "stakeholder_id": entry["id"],
                "tier_id": tier["id"],
                "tier_name": tier["name"],
                "amount": round(share, 2),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            await db.waterfall_payouts.insert_one(dict(payout_doc))
            payout_doc.pop("_id", None)
            distributions.append(payout_doc)

    await append_event(
        "waterfall_executed",
        {
            "spv_id": spv_id,
            "revenue_amount": payload.revenue_amount,
            "revenue_source": payload.revenue_source,
            "distributions_count": len(distributions),
            "undistributed_remainder": round(remaining, 2),
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv_id,
    )
    return {
        "distributions": distributions,
        "undistributed_remainder": round(remaining, 2),
        "total_distributed": round(payload.revenue_amount - remaining, 2),
    }


@router.get("/spvs/{spv_id}/payouts")
async def list_payouts(spv_id: str, user=Depends(get_current_user)):
    db = get_db()
    cursor = db.waterfall_payouts.find({"spv_id": spv_id}, {"_id": 0}).sort(
        "timestamp", -1
    )
    return [doc async for doc in cursor]


# ---------------- Investments / Stripe ----------------
def _stripe(host_url: str) -> StripeCheckout:
    return StripeCheckout(
        api_key=os.environ["STRIPE_API_KEY"],
        webhook_url=f"{host_url}/api/webhook/stripe",
    )


@router.post("/investments/checkout")
async def create_investment_checkout(
    payload: InvestmentCreate,
    http_request: Request,
    user=Depends(require_role("investor")),
):
    db = get_db()
    spv = await db.spvs.find_one({"id": payload.spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    if not spv.get("open_for_investment", False):
        raise HTTPException(status_code=400, detail="SPV not open for investment")
    if payload.amount < spv["minimum_investment"]:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum investment is ${spv['minimum_investment']:.2f}",
        )

    origin = payload.origin_url.rstrip("/")
    host_url = str(http_request.base_url).rstrip("/")
    stripe = _stripe(host_url)
    metadata = {
        "purpose": "spv_investment",
        "spv_id": spv["id"],
        "spv_name": spv["name"],
        "user_id": user["id"],
        "user_email": user["email"],
        "amount": str(payload.amount),
    }
    req = CheckoutSessionRequest(
        amount=float(payload.amount),
        currency="usd",
        success_url=f"{origin}/payment/return?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/investor",
        metadata=metadata,
    )
    session = await stripe.create_checkout_session(req)
    # Track investment + payment transaction
    investment = Investment(
        spv_id=spv["id"],
        spv_name=spv["name"],
        investor_user_id=user["id"],
        investor_email=user["email"],
        amount=float(payload.amount),
        currency="usd",
        status="pending",
        stripe_session_id=session.session_id,
    )
    inv_doc = investment.model_dump()
    inv_doc["created_at"] = inv_doc["created_at"].isoformat()
    await db.investments.insert_one(inv_doc)
    txn_doc = {
        "id": str(__import__("uuid").uuid4()),
        "session_id": session.session_id,
        "amount": float(payload.amount),
        "currency": "usd",
        "status": "open",
        "payment_status": "initiated",
        "user_id": user["id"],
        "purpose": "spv_investment",
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(dict(txn_doc))
    return {"url": session.url, "session_id": session.session_id}


@router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, http_request: Request):
    db = get_db()
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Avoid double-finalization
    if txn["payment_status"] in {"paid", "expired", "canceled"}:
        return txn

    host_url = str(http_request.base_url).rstrip("/")
    stripe = _stripe(host_url)
    status_resp = await stripe.get_checkout_status(session_id)
    update = {
        "status": status_resp.status,
        "payment_status": status_resp.payment_status,
    }
    await db.payment_transactions.update_one(
        {"session_id": session_id}, {"$set": update}
    )
    txn.update(update)

    if status_resp.payment_status == "paid" and txn["purpose"] == "spv_investment":
        await _finalize_investment(db, session_id, txn["metadata"])
    elif status_resp.payment_status == "paid" and txn["purpose"] == "episode_unlock":
        await _finalize_episode_unlock(db, session_id, txn["metadata"])
    elif status_resp.payment_status == "paid" and txn["purpose"] == "marketplace_buy":
        from routes_marketplace import finalize_marketplace_buy

        await finalize_marketplace_buy(db, session_id, txn["metadata"])
    return txn


async def _finalize_investment(db, session_id: str, metadata: dict[str, Any]):
    inv = await db.investments.find_one({"stripe_session_id": session_id})
    if not inv or inv["status"] == "paid":
        return
    spv = await db.spvs.find_one({"id": inv["spv_id"]})
    if not spv:
        return
    new_raised = spv.get("raised_amount", 0.0) + inv["amount"]
    equity_pct = (
        (inv["amount"] / spv["total_budget"]) * 100.0
        if spv.get("total_budget")
        else 0.0
    )
    await db.investments.update_one(
        {"stripe_session_id": session_id},
        {"$set": {"status": "paid", "equity_percentage": round(equity_pct, 4)}},
    )
    await db.spvs.update_one(
        {"id": inv["spv_id"]},
        {"$set": {"raised_amount": round(new_raised, 2)}},
    )
    # Add cap-table entry for investor
    entry_doc = {
        "id": str(__import__("uuid").uuid4()),
        "spv_id": inv["spv_id"],
        "stakeholder_name": inv["investor_email"],
        "stakeholder_type": "investor",
        "user_id": inv["investor_user_id"],
        "equity_percentage": round(equity_pct, 4),
        "investment_amount": inv["amount"],
        "role": "Equity Investor",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cap_table.insert_one(dict(entry_doc))
    await append_event(
        "investment_settled",
        {
            "spv_id": inv["spv_id"],
            "investor_email": inv["investor_email"],
            "amount": inv["amount"],
            "equity_pct": round(equity_pct, 4),
        },
        actor_user_id=inv["investor_user_id"],
        actor_name=inv["investor_email"],
        spv_id=inv["spv_id"],
    )


async def _finalize_episode_unlock(db, session_id: str, metadata: dict[str, Any]):
    unlock = await db.episode_unlocks.find_one({"stripe_session_id": session_id})
    if not unlock or unlock["status"] == "paid":
        return
    await db.episode_unlocks.update_one(
        {"stripe_session_id": session_id},
        {"$set": {"status": "paid"}},
    )
    await db.episodes.update_one(
        {"id": unlock["episode_id"]}, {"$inc": {"unlock_count": 1}}
    )
    await append_event(
        "episode_unlocked",
        {
            "episode_id": unlock["episode_id"],
            "spv_id": unlock.get("spv_id"),
            "user_id": unlock["user_id"],
            "amount": unlock["amount"],
        },
        actor_user_id=unlock["user_id"],
        spv_id=unlock.get("spv_id"),
    )


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    db = get_db()
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url).rstrip("/")
    stripe = _stripe(host_url)
    try:
        webhook = await stripe.handle_webhook(body, sig)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid webhook: {exc}")
    if not webhook or not webhook.session_id:
        return {"ok": True}
    txn = await db.payment_transactions.find_one({"session_id": webhook.session_id})
    if txn:
        await db.payment_transactions.update_one(
            {"session_id": webhook.session_id},
            {"$set": {"payment_status": webhook.payment_status}},
        )
        if webhook.payment_status == "paid":
            if txn["purpose"] == "spv_investment":
                await _finalize_investment(db, webhook.session_id, txn["metadata"])
            elif txn["purpose"] == "episode_unlock":
                await _finalize_episode_unlock(db, webhook.session_id, txn["metadata"])
            elif txn["purpose"] == "marketplace_buy":
                from routes_marketplace import finalize_marketplace_buy

                await finalize_marketplace_buy(db, webhook.session_id, txn["metadata"])
    return {"ok": True}


@router.get("/investments/mine")
async def my_investments(user=Depends(require_role("investor"))):
    db = get_db()
    cursor = db.investments.find(
        {"investor_user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1)
    investments = [doc async for doc in cursor]
    # Aggregate payouts for these SPVs
    spv_ids = list({i["spv_id"] for i in investments})
    payouts_by_spv: dict[str, float] = {}
    if spv_ids:
        cursor = db.waterfall_payouts.find(
            {"spv_id": {"$in": spv_ids}, "stakeholder_name": user["email"]},
            {"_id": 0},
        )
        async for p in cursor:
            payouts_by_spv[p["spv_id"]] = (
                payouts_by_spv.get(p["spv_id"], 0.0) + p["amount"]
            )
    for inv in investments:
        inv["payouts_received"] = round(payouts_by_spv.get(inv["spv_id"], 0.0), 2)
    return investments
