"""Routes: AI features (budget forecast, deal memo, greenlight, rights conflict)."""
from fastapi import APIRouter, Depends, HTTPException

from ai_service import (
    forecast_budget,
    generate_deal_memo,
    resolve_rights_conflict,
    score_greenlight,
)
from auth import get_current_user
from blockchain import append_event
from database import get_db
from models import (
    BudgetForecastRequest,
    DealMemoRequest,
    GreenlightRequest,
    RightsConflictRequest,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/budget-forecast")
async def ai_budget_forecast(
    payload: BudgetForecastRequest, user=Depends(get_current_user)
):
    result = await forecast_budget(
        payload.production_type,
        payload.territory,
        payload.genre,
        payload.episode_count,
        payload.target_quality,
        payload.notes,
    )
    await append_event(
        "ai_budget_forecast",
        {
            "user_id": user["id"],
            "production_type": payload.production_type,
            "territory": payload.territory,
            "estimated_total_usd": result.get("total_usd"),
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
    )
    return result


@router.post("/deal-memo")
async def ai_deal_memo(payload: DealMemoRequest, user=Depends(get_current_user)):
    db = get_db()
    spv = await db.spvs.find_one({"id": payload.spv_id}, {"_id": 0})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    memo = await generate_deal_memo(spv)
    await append_event(
        "ai_deal_memo_generated",
        {"spv_id": spv["id"], "spv_name": spv["name"]},
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv["id"],
    )
    return memo


@router.post("/greenlight")
async def ai_greenlight(
    payload: GreenlightRequest, user=Depends(get_current_user)
):
    db = get_db()
    spv = await db.spvs.find_one({"id": payload.spv_id}, {"_id": 0})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    # Build market signal
    investment_count = await db.investments.count_documents(
        {"spv_id": spv["id"], "status": "paid"}
    )
    rights_count = await db.rights.count_documents({"spv_id": spv["id"]})
    episodes_count = await db.episodes.count_documents({"spv_id": spv["id"]})
    market_signal = {
        "investor_count_so_far": investment_count,
        "rights_registered": rights_count,
        "episodes_planned_or_live": episodes_count,
        "raise_progress_pct": round(
            (spv.get("raised_amount", 0) / spv["total_budget"]) * 100, 2
        )
        if spv.get("total_budget")
        else 0,
    }
    result = await score_greenlight(spv, market_signal)
    await append_event(
        "ai_greenlight_scored",
        {
            "spv_id": spv["id"],
            "score": result.get("score"),
            "verdict": result.get("verdict"),
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv["id"],
    )
    return result


@router.post("/rights-conflict")
async def ai_rights_conflict(
    payload: RightsConflictRequest, user=Depends(get_current_user)
):
    db = get_db()
    spv = await db.spvs.find_one({"id": payload.spv_id}, {"_id": 0})
    if not spv:
        raise HTTPException(status_code=404, detail="SPV not found")
    rights = [doc async for doc in db.rights.find({"spv_id": spv["id"]}, {"_id": 0})]
    result = await resolve_rights_conflict(spv, rights)
    await append_event(
        "ai_rights_conflict_check",
        {
            "spv_id": spv["id"],
            "clearance_score": result.get("clearance_score"),
            "conflicts_found": len(result.get("conflicts", [])),
        },
        actor_user_id=user["id"],
        actor_name=user["name"],
        spv_id=spv["id"],
    )
    return result
