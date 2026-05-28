"""Routes: Rights ledger, Audit trail viewer, Supply chain / vendors."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ai_service import score_vendor_risk
from auth import get_current_user
from blockchain import append_event
from database import get_db
from models import Right, RightCreate, Vendor, VendorCreate

router = APIRouter(prefix="/api", tags=["rights"])


# ---------------- Rights ----------------
@router.post("/spvs/{spv_id}/rights", response_model=Right)
async def add_right(
    spv_id: str, payload: RightCreate, user=Depends(get_current_user)
):
    db = get_db()
    spv = await db.spvs.find_one({"id": spv_id})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    if spv["producer_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only producer can mint rights")

    # Compute chain-of-title: link to the last right for this SPV
    last = await db.rights.find_one({"spv_id": spv_id}, sort=[("created_at", -1)])
    parent_hash = last["chain_hash"] if last else None
    right = Right(spv_id=spv_id, parent_hash=parent_hash, **payload.model_dump())
    # Append-to-blockchain (and reuse its hash)
    block = await append_event(
        "right_minted",
        {
            "spv_id": spv_id,
            "type": right.type,
            "territory": right.territory,
            "owner_name": right.owner_name,
            "royalty_pct": right.royalty_percentage,
            "duration_years": right.duration_years,
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv_id,
    )
    right.chain_hash = block["block_hash"]
    doc = right.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.rights.insert_one(doc)
    return right


@router.get("/spvs/{spv_id}/rights")
async def list_rights(spv_id: str, user=Depends(get_current_user)):
    db = get_db()
    cursor = db.rights.find({"spv_id": spv_id}, {"_id": 0}).sort("created_at", 1)
    return [doc async for doc in cursor]


@router.patch("/rights/{right_id}")
async def update_right_status(
    right_id: str, payload: dict[str, Any], user=Depends(get_current_user)
):
    db = get_db()
    right = await db.rights.find_one({"id": right_id})
    if not right:
        raise HTTPException(status_code=404, detail="Right not found")
    spv = await db.spvs.find_one({"id": right["spv_id"]})
    if not spv or (
        spv["producer_id"] != user["id"] and user["role"] != "admin"
    ):
        raise HTTPException(status_code=403, detail="Only producer can update rights")
    allowed = {"status"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No allowed fields")
    await db.rights.update_one({"id": right_id}, {"$set": update})
    await append_event(
        "right_updated",
        {"right_id": right_id, "changes": update, "spv_id": right["spv_id"]},
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=right["spv_id"],
    )
    return await db.rights.find_one({"id": right_id}, {"_id": 0})


# ---------------- Audit Trail ----------------
@router.get("/audit/events")
async def list_audit_events(
    spv_id: str | None = None,
    limit: int = 100,
    user=Depends(get_current_user),
):
    db = get_db()
    query: dict[str, Any] = {}
    if spv_id:
        query["spv_id"] = spv_id
    cursor = db.audit_events.find(query, {"_id": 0}).sort("block_number", -1).limit(
        limit
    )
    return [doc async for doc in cursor]


@router.get("/audit/stats")
async def audit_stats(user=Depends(get_current_user)):
    db = get_db()
    total = await db.audit_events.count_documents({})
    last = await db.audit_events.find_one(sort=[("block_number", -1)])
    return {
        "total_blocks": total,
        "latest_block": last.get("block_number") if last else 0,
        "latest_hash": last.get("block_hash") if last else "",
    }


# ---------------- Vendors / Supply Chain ----------------
@router.post("/vendors", response_model=Vendor)
async def create_vendor(payload: VendorCreate, user=Depends(get_current_user)):
    db = get_db()
    vendor = Vendor(**payload.model_dump())
    # Run AI risk scoring
    try:
        risk = await score_vendor_risk(vendor.model_dump())
        vendor.risk_score = float(risk.get("risk_score", vendor.risk_score))
        vendor.risk_label = risk.get("risk_label", vendor.risk_label)
        vendor.compliance_score = float(
            risk.get("compliance_score", vendor.compliance_score)
        )
        vendor.verified = bool(risk.get("verified", vendor.verified))
        vendor.risk_factors = risk.get("risk_factors", [])[:8]
    except Exception:
        # Fallback heuristic if AI not reachable
        delivery = vendor.delivery_history
        vendor.risk_score = max(10.0, 80.0 - delivery * 4.5)
        vendor.compliance_score = min(95.0, 60.0 + delivery * 3)
        vendor.verified = delivery >= 5
        vendor.risk_label = "low" if vendor.risk_score < 35 else (
            "moderate" if vendor.risk_score < 60 else "elevated"
        )
    doc = vendor.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.vendors.insert_one(doc)
    await append_event(
        "vendor_registered",
        {
            "vendor_id": vendor.id,
            "name": vendor.name,
            "role": vendor.role,
            "risk_score": vendor.risk_score,
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
    )
    return vendor


@router.get("/vendors")
async def list_vendors(
    role: str | None = None, user=Depends(get_current_user)
):
    db = get_db()
    query: dict[str, Any] = {}
    if role:
        query["role"] = role
    cursor = db.vendors.find(query, {"_id": 0}).sort("delivery_history", -1)
    return [doc async for doc in cursor]


@router.get("/vendors/{vendor_id}")
async def get_vendor(vendor_id: str, user=Depends(get_current_user)):
    db = get_db()
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor
