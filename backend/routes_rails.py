"""Cross-border payout rails — FX, tax withholding, union obligations per SPV."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, require_role
from blockchain import append_event
from database import get_db


router = APIRouter(prefix="/api", tags=["rails"])


class PayoutRailsConfig(BaseModel):
    base_currency: str = Field(default="USD", pattern="^[A-Z]{3}$")
    fx_target_currency: str = Field(default="USD", pattern="^[A-Z]{3}$")
    fx_rate: float = Field(gt=0, default=1.0)
    tax_withholding_pct: float = Field(ge=0, le=60, default=0.0)
    union_obligation_pct: float = Field(ge=0, le=40, default=0.0)
    settlement_partner: str = Field(default="Stripe Treasury", max_length=120)
    stablecoin_rail_enabled: bool = False


@router.get("/spvs/{spv_id}/rails")
async def get_rails(spv_id: str, user=Depends(get_current_user)):
    db = get_db()
    spv = await db.spvs.find_one({"id": spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    rails = await db.payout_rails.find_one({"spv_id": spv_id}, {"_id": 0})
    if not rails:
        rails = {
            "spv_id": spv_id,
            "base_currency": "USD",
            "fx_target_currency": "USD",
            "fx_rate": 1.0,
            "tax_withholding_pct": 0.0,
            "union_obligation_pct": 0.0,
            "settlement_partner": "Stripe Treasury",
            "stablecoin_rail_enabled": False,
        }
    return rails


@router.put("/spvs/{spv_id}/rails")
async def set_rails(
    spv_id: str,
    payload: PayoutRailsConfig,
    user=Depends(require_role("producer")),
):
    db = get_db()
    spv = await db.spvs.find_one({"id": spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    if spv["producer_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(
            status_code=403, detail="Only the producer can configure rails"
        )
    doc = payload.model_dump()
    doc["spv_id"] = spv_id
    await db.payout_rails.update_one(
        {"spv_id": spv_id}, {"$set": doc}, upsert=True
    )
    await append_event(
        "payout_rails_configured",
        {
            "spv_id": spv_id,
            "base": payload.base_currency,
            "target": payload.fx_target_currency,
            "fx_rate": payload.fx_rate,
            "tax_pct": payload.tax_withholding_pct,
            "union_pct": payload.union_obligation_pct,
            "settlement_partner": payload.settlement_partner,
            "stablecoin": payload.stablecoin_rail_enabled,
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv_id,
    )
    return doc


@router.post("/spvs/{spv_id}/rails/simulate")
async def simulate_settlement(
    spv_id: str,
    amount_usd: float,
    user=Depends(get_current_user),
):
    """Apply the configured rails to a hypothetical gross payout — returns the breakdown."""
    if amount_usd <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    db = get_db()
    spv = await db.spvs.find_one({"id": spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    rails = await db.payout_rails.find_one({"spv_id": spv_id}, {"_id": 0}) or {}
    fx_rate = float(rails.get("fx_rate", 1.0))
    target = rails.get("fx_target_currency", "USD")
    tax_pct = float(rails.get("tax_withholding_pct", 0.0))
    union_pct = float(rails.get("union_obligation_pct", 0.0))

    fx_converted = amount_usd * fx_rate
    tax_withheld = fx_converted * (tax_pct / 100.0)
    union_due = fx_converted * (union_pct / 100.0)
    net = fx_converted - tax_withheld - union_due
    return {
        "gross_usd": amount_usd,
        "fx_target_currency": target,
        "fx_rate": fx_rate,
        "gross_in_target": round(fx_converted, 2),
        "tax_withheld": round(tax_withheld, 2),
        "union_due": round(union_due, 2),
        "net_payable": round(net, 2),
        "settlement_partner": rails.get("settlement_partner", "Stripe Treasury"),
        "stablecoin_rail_enabled": bool(rails.get("stablecoin_rail_enabled", False)),
    }
