"""Routes: Content Library and Episode Micropayment Unlocks (Stripe)."""
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
    Episode,
    EpisodeCreate,
    EpisodeUnlock,
    EpisodeUnlockCreate,
)

router = APIRouter(prefix="/api", tags=["content"])


def _stripe(host_url: str) -> StripeCheckout:
    return StripeCheckout(
        api_key=os.environ["STRIPE_API_KEY"],
        webhook_url=f"{host_url}/api/webhook/stripe",
    )


@router.post("/episodes", response_model=Episode)
async def create_episode(payload: EpisodeCreate, user=Depends(require_role("producer"))):
    db = get_db()
    spv = await db.spvs.find_one({"id": payload.spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    if spv["producer_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the SPV producer can add episodes")
    episode = Episode(**payload.model_dump())
    doc = episode.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.episodes.insert_one(doc)
    await append_event(
        "episode_added",
        {
            "episode_id": episode.id,
            "spv_id": episode.spv_id,
            "series_title": episode.series_title,
            "episode_number": episode.episode_number,
            "price_usd": episode.unlock_price_usd,
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=episode.spv_id,
    )
    return episode


@router.get("/episodes")
async def list_episodes(
    spv_id: str | None = None, user=Depends(get_current_user)
):
    db = get_db()
    query: dict[str, Any] = {}
    if spv_id:
        query["spv_id"] = spv_id
    cursor = db.episodes.find(query, {"_id": 0}).sort(
        [("series_title", 1), ("episode_number", 1)]
    )
    episodes = [doc async for doc in cursor]
    # Mark unlocked episodes for this user
    unlocked = {
        u["episode_id"]
        async for u in db.episode_unlocks.find(
            {"user_id": user["id"], "status": "paid"}, {"episode_id": 1}
        )
    }
    for ep in episodes:
        ep["unlocked"] = ep["id"] in unlocked
    return episodes


@router.get("/episodes/{episode_id}")
async def get_episode(episode_id: str, user=Depends(get_current_user)):
    db = get_db()
    ep = await db.episodes.find_one({"id": episode_id}, {"_id": 0})
    if not ep:
        raise HTTPException(status_code=404, detail="Episode not found")
    unlock = await db.episode_unlocks.find_one(
        {"episode_id": episode_id, "user_id": user["id"], "status": "paid"}
    )
    ep["unlocked"] = bool(unlock) or ep.get("unlock_price_usd", 0) == 0
    return ep


@router.post("/episodes/unlock")
async def unlock_episode(
    payload: EpisodeUnlockCreate,
    http_request: Request,
    user=Depends(get_current_user),
):
    db = get_db()
    ep = await db.episodes.find_one({"id": payload.episode_id})
    if not ep:
        raise HTTPException(status_code=404, detail="Episode not found")
    # If free, just record an unlock
    if ep.get("unlock_price_usd", 0) <= 0:
        existing = await db.episode_unlocks.find_one(
            {"episode_id": ep["id"], "user_id": user["id"]}
        )
        if not existing:
            unlock = EpisodeUnlock(
                episode_id=ep["id"],
                spv_id=ep["spv_id"],
                user_id=user["id"],
                amount=0.0,
                stripe_session_id=f"free-{ep['id']}-{user['id']}",
                status="paid",
            )
            doc = unlock.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.episode_unlocks.insert_one(doc)
            await db.episodes.update_one(
                {"id": ep["id"]}, {"$inc": {"unlock_count": 1}}
            )
        return {"free": True, "url": None}

    if 0 < ep.get("unlock_price_usd", 0) < 0.5:
        raise HTTPException(
            status_code=400,
            detail="Minimum unlock price is $0.50 (Stripe constraint)",
        )

    origin = payload.origin_url.rstrip("/")
    host_url = str(http_request.base_url).rstrip("/")
    stripe = _stripe(host_url)
    metadata = {
        "purpose": "episode_unlock",
        "episode_id": ep["id"],
        "spv_id": ep["spv_id"],
        "user_id": user["id"],
    }
    req = CheckoutSessionRequest(
        amount=float(ep["unlock_price_usd"]),
        currency="usd",
        success_url=f"{origin}/payment/return?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/library",
        metadata=metadata,
    )
    session = await stripe.create_checkout_session(req)
    unlock = EpisodeUnlock(
        episode_id=ep["id"],
        spv_id=ep["spv_id"],
        user_id=user["id"],
        amount=float(ep["unlock_price_usd"]),
        stripe_session_id=session.session_id,
        status="pending",
    )
    doc = unlock.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.episode_unlocks.insert_one(doc)
    await db.payment_transactions.insert_one(
        {
            "id": str(__import__("uuid").uuid4()),
            "session_id": session.session_id,
            "amount": float(ep["unlock_price_usd"]),
            "currency": "usd",
            "status": "open",
            "payment_status": "initiated",
            "user_id": user["id"],
            "purpose": "episode_unlock",
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"free": False, "url": session.url, "session_id": session.session_id}
