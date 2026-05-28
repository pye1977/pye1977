"""Residuals timeline — milestones on an SPV that trigger waterfall payouts when met."""
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user, require_role
from blockchain import append_event
from database import get_db


router = APIRouter(prefix="/api", tags=["milestones"])


class MilestoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(max_length=600, default="")
    target_date: str  # ISO yyyy-mm-dd
    revenue_threshold_usd: float = Field(ge=0, default=0.0)
    trigger_payout_usd: float = Field(ge=0, default=0.0)


@router.post("/spvs/{spv_id}/milestones")
async def create_milestone(
    spv_id: str,
    payload: MilestoneCreate,
    user=Depends(require_role("producer")),
):
    db = get_db()
    spv = await db.spvs.find_one({"id": spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    if spv["producer_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only producer can set milestones")
    milestone = {
        "id": str(uuid.uuid4()),
        "spv_id": spv_id,
        "name": payload.name.strip(),
        "description": payload.description.strip(),
        "target_date": payload.target_date,
        "revenue_threshold_usd": float(payload.revenue_threshold_usd),
        "trigger_payout_usd": float(payload.trigger_payout_usd),
        "status": "pending",  # pending | triggered | passed
        "triggered_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.milestones.insert_one(dict(milestone))
    await append_event(
        "milestone_created",
        {
            "spv_id": spv_id,
            "milestone_id": milestone["id"],
            "name": milestone["name"],
            "target_date": milestone["target_date"],
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv_id,
    )
    return milestone


@router.get("/spvs/{spv_id}/milestones")
async def list_milestones(spv_id: str, user=Depends(get_current_user)):
    db = get_db()
    cursor = db.milestones.find({"spv_id": spv_id}, {"_id": 0}).sort(
        "target_date", 1
    )
    return [doc async for doc in cursor]


@router.post("/milestones/{milestone_id}/mark-reached")
async def mark_reached(
    milestone_id: str, user=Depends(require_role("producer"))
):
    db = get_db()
    milestone = await db.milestones.find_one({"id": milestone_id})
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    spv = await db.spvs.find_one({"id": milestone["spv_id"]})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    if spv["producer_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only producer can trigger")
    if milestone["status"] != "pending":
        raise HTTPException(status_code=400, detail="Milestone is not pending")
    await db.milestones.update_one(
        {"id": milestone_id},
        {
            "$set": {
                "status": "triggered",
                "triggered_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    await append_event(
        "milestone_triggered",
        {
            "milestone_id": milestone_id,
            "spv_id": milestone["spv_id"],
            "trigger_payout_usd": milestone["trigger_payout_usd"],
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=milestone["spv_id"],
    )
    return await db.milestones.find_one({"id": milestone_id}, {"_id": 0})
