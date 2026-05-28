"""Secondary equity marketplace — investors can list & buy SPV equity positions."""
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from emergentintegrations.payments.stripe.checkout import (
    CheckoutSessionRequest,
    StripeCheckout,
)
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth import get_current_user, require_role
from blockchain import append_event
from database import get_db
from security import sanitize_text

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])


class ListingCreate(BaseModel):
    cap_table_entry_id: str
    asking_price_usd: float = Field(gt=0)
    equity_to_sell_pct: float = Field(gt=0, le=100)
    notes: str = ""


class BuyRequest(BaseModel):
    listing_id: str
    origin_url: str


def _stripe(host_url: str) -> StripeCheckout:
    return StripeCheckout(
        api_key=os.environ["STRIPE_API_KEY"],
        webhook_url=f"{host_url}/api/webhook/stripe",
    )


@router.post("/listings")
async def create_listing(
    payload: ListingCreate, user=Depends(require_role("investor"))
):
    db = get_db()
    entry = await db.cap_table.find_one({"id": payload.cap_table_entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Cap-table entry not found")
    if entry.get("user_id") != user["id"]:
        raise HTTPException(
            status_code=403,
            detail="You can only list equity you own on the cap table",
        )
    if entry["equity_percentage"] < payload.equity_to_sell_pct:
        raise HTTPException(
            status_code=400,
            detail="Listed equity exceeds your current stake",
        )
    spv = await db.spvs.find_one({"id": entry["spv_id"]})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")

    listing = {
        "id": str(uuid.uuid4()),
        "cap_table_entry_id": entry["id"],
        "spv_id": entry["spv_id"],
        "spv_name": spv["name"],
        "seller_user_id": user["id"],
        "seller_email": user["email"],
        "equity_to_sell_pct": payload.equity_to_sell_pct,
        "asking_price_usd": payload.asking_price_usd,
        "notes": sanitize_text(payload.notes, max_len=400),
        "status": "open",  # open | sold | canceled
        "buyer_user_id": None,
        "stripe_session_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.marketplace_listings.insert_one(dict(listing))
    await append_event(
        "marketplace_listing_created",
        {
            "listing_id": listing["id"],
            "spv_id": listing["spv_id"],
            "equity_pct": listing["equity_to_sell_pct"],
            "asking_usd": listing["asking_price_usd"],
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=listing["spv_id"],
    )
    listing.pop("_id", None)
    return listing


@router.get("/listings")
async def list_listings(
    status: str | None = "open",
    spv_id: str | None = None,
    user=Depends(get_current_user),
):
    db = get_db()
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    if spv_id:
        query["spv_id"] = spv_id
    cursor = db.marketplace_listings.find(query, {"_id": 0}).sort("created_at", -1)
    return [doc async for doc in cursor]


@router.delete("/listings/{listing_id}")
async def cancel_listing(listing_id: str, user=Depends(get_current_user)):
    db = get_db()
    listing = await db.marketplace_listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing["seller_user_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the seller can cancel")
    if listing["status"] != "open":
        raise HTTPException(
            status_code=400, detail="Only open listings can be canceled"
        )
    await db.marketplace_listings.update_one(
        {"id": listing_id}, {"$set": {"status": "canceled"}}
    )
    await append_event(
        "marketplace_listing_canceled",
        {"listing_id": listing_id},
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=listing.get("spv_id"),
    )
    return {"ok": True}


@router.post("/buy")
async def buy_listing(
    payload: BuyRequest,
    http_request: Request,
    user=Depends(require_role("investor")),
):
    db = get_db()
    listing = await db.marketplace_listings.find_one({"id": payload.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing["status"] != "open":
        raise HTTPException(status_code=400, detail="Listing is no longer open")
    if listing["seller_user_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot buy your own listing")

    origin = payload.origin_url.rstrip("/")
    host_url = str(http_request.base_url).rstrip("/")
    stripe = _stripe(host_url)
    metadata = {
        "purpose": "marketplace_buy",
        "listing_id": listing["id"],
        "spv_id": listing["spv_id"],
        "buyer_user_id": user["id"],
        "seller_user_id": listing["seller_user_id"],
        "equity_pct": str(listing["equity_to_sell_pct"]),
    }
    req = CheckoutSessionRequest(
        amount=float(listing["asking_price_usd"]),
        currency="usd",
        success_url=f"{origin}/payment/return?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/marketplace",
        metadata=metadata,
    )
    session = await stripe.create_checkout_session(req)
    await db.marketplace_listings.update_one(
        {"id": listing["id"]},
        {
            "$set": {
                "stripe_session_id": session.session_id,
                "buyer_user_id": user["id"],
                "status": "pending",
            }
        },
    )
    await db.payment_transactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "amount": float(listing["asking_price_usd"]),
            "currency": "usd",
            "status": "open",
            "payment_status": "initiated",
            "user_id": user["id"],
            "purpose": "marketplace_buy",
            "metadata": metadata,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"url": session.url, "session_id": session.session_id}


async def finalize_marketplace_buy(db, session_id: str, metadata: dict[str, Any]) -> None:
    listing = await db.marketplace_listings.find_one(
        {"stripe_session_id": session_id}
    )
    if not listing or listing["status"] == "sold":
        return
    seller_entry = await db.cap_table.find_one(
        {"id": listing["cap_table_entry_id"]}
    )
    if not seller_entry:
        return
    pct = float(listing["equity_to_sell_pct"])
    buyer_id = listing["buyer_user_id"]
    buyer = await db.users.find_one(
        {"_id": __import__("bson").ObjectId(buyer_id)}
    )
    new_seller_pct = max(0.0, seller_entry["equity_percentage"] - pct)
    # If seller's stake remains > 0, just reduce it; else delete.
    if new_seller_pct > 0.0001:
        await db.cap_table.update_one(
            {"id": seller_entry["id"]},
            {"$set": {"equity_percentage": round(new_seller_pct, 4)}},
        )
    else:
        await db.cap_table.delete_one({"id": seller_entry["id"]})
    # Insert buyer cap-table entry
    new_entry = {
        "id": str(uuid.uuid4()),
        "spv_id": listing["spv_id"],
        "stakeholder_name": (buyer or {}).get("email") or "Buyer",
        "stakeholder_type": "investor",
        "user_id": buyer_id,
        "equity_percentage": pct,
        "investment_amount": float(listing["asking_price_usd"]),
        "role": "Secondary-market investor",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cap_table.insert_one(dict(new_entry))
    await db.marketplace_listings.update_one(
        {"id": listing["id"]}, {"$set": {"status": "sold"}}
    )
    await append_event(
        "marketplace_trade_settled",
        {
            "listing_id": listing["id"],
            "spv_id": listing["spv_id"],
            "buyer_user_id": buyer_id,
            "seller_user_id": listing["seller_user_id"],
            "equity_pct": pct,
            "price_usd": listing["asking_price_usd"],
        },
        actor_user_id=buyer_id,
        spv_id=listing["spv_id"],
    )
