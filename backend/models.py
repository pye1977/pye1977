"""Pydantic models for RIVITED Solutions."""
from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
import uuid


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Auth ----------
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: str
    role: str  # producer | investor | distributor | admin
    created_at: datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    role: str = Field(pattern="^(producer|investor|distributor)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ---------- SPV ----------
class SPVCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    description: str = Field(min_length=2, max_length=2000)
    type: str = Field(pattern="^(vertical_drama|micro_content|feature|series)$")
    territory: str
    total_budget: float = Field(gt=0)
    minimum_investment: float = Field(ge=10)
    target_irr: float = Field(ge=0, le=200)
    genre: str
    episode_count: Optional[int] = None


class SPV(BaseModel):
    id: str = Field(default_factory=_uuid)
    name: str
    description: str
    type: str
    producer_id: str
    producer_name: str
    territory: str
    total_budget: float
    raised_amount: float = 0.0
    minimum_investment: float
    target_irr: float
    status: str = "fundraising"
    open_for_investment: bool = True
    poster_url: str = ""
    genre: str = ""
    episode_count: Optional[int] = None
    created_at: datetime = Field(default_factory=_now)


# ---------- Cap Table ----------
class CapTableEntryCreate(BaseModel):
    stakeholder_name: str
    stakeholder_type: str = Field(
        pattern="^(producer|investor|writer|actor|director|distributor|guild|other)$"
    )
    equity_percentage: float = Field(ge=0, le=100)
    investment_amount: float = Field(ge=0)
    role: str = ""


class CapTableEntry(BaseModel):
    id: str = Field(default_factory=_uuid)
    spv_id: str
    stakeholder_name: str
    stakeholder_type: str
    user_id: Optional[str] = None
    equity_percentage: float
    investment_amount: float
    role: str
    created_at: datetime = Field(default_factory=_now)


# ---------- Waterfall ----------
class WaterfallTierCreate(BaseModel):
    tier: int
    name: str
    description: str = ""
    percentage: float = Field(ge=0, le=100)
    cap_amount: Optional[float] = None


class WaterfallTier(BaseModel):
    id: str = Field(default_factory=_uuid)
    spv_id: str
    tier: int
    name: str
    description: str
    percentage: float
    cap_amount: Optional[float] = None
    paid_amount: float = 0.0
    created_at: datetime = Field(default_factory=_now)


class WaterfallExecuteRequest(BaseModel):
    revenue_amount: float = Field(gt=0)
    revenue_source: str = "distribution"


# ---------- Rights ----------
class RightCreate(BaseModel):
    type: str = Field(
        pattern="^(distribution|streaming|merchandise|music|broadcast|theatrical|format)$"
    )
    territory: str
    owner_name: str
    duration_years: int = Field(ge=1, le=99)
    royalty_percentage: float = Field(ge=0, le=100)


class Right(BaseModel):
    id: str = Field(default_factory=_uuid)
    spv_id: str
    type: str
    territory: str
    owner_name: str
    owner_user_id: Optional[str] = None
    duration_years: int
    royalty_percentage: float
    status: str = "active"
    chain_hash: str = ""
    parent_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)


# ---------- Investments ----------
class InvestmentCreate(BaseModel):
    spv_id: str
    amount: float = Field(gt=0)
    origin_url: str


class Investment(BaseModel):
    id: str = Field(default_factory=_uuid)
    spv_id: str
    spv_name: str
    investor_user_id: str
    investor_email: str
    amount: float
    currency: str = "usd"
    status: str = "pending"
    stripe_session_id: str
    equity_percentage: float = 0.0
    created_at: datetime = Field(default_factory=_now)


# ---------- Content / Episodes ----------
class EpisodeCreate(BaseModel):
    spv_id: str
    series_title: str
    episode_number: int = Field(ge=1)
    title: str
    duration_seconds: int = Field(ge=10)
    unlock_price_usd: float = Field(ge=0)
    thumbnail_url: str = ""
    description: str = ""


class Episode(BaseModel):
    id: str = Field(default_factory=_uuid)
    spv_id: str
    series_title: str
    episode_number: int
    title: str
    duration_seconds: int
    unlock_price_usd: float
    thumbnail_url: str
    description: str
    unlock_count: int = 0
    created_at: datetime = Field(default_factory=_now)


class EpisodeUnlockCreate(BaseModel):
    episode_id: str
    origin_url: str


class EpisodeUnlock(BaseModel):
    id: str = Field(default_factory=_uuid)
    episode_id: str
    spv_id: str
    user_id: str
    amount: float
    stripe_session_id: str
    status: str = "pending"
    created_at: datetime = Field(default_factory=_now)


# ---------- Vendors / Supply Chain ----------
class VendorCreate(BaseModel):
    name: str
    role: str = Field(
        pattern="^(vfx|post_production|localization|production_company|talent_agency|equipment|sound|music)$"
    )
    territory: str
    delivery_history: int = Field(ge=0)
    blockchain_attested: bool = False
    description: str = ""


class Vendor(BaseModel):
    id: str = Field(default_factory=_uuid)
    name: str
    role: str
    territory: str
    delivery_history: int
    verified: bool = False
    compliance_score: float = 0.0
    risk_score: float = 50.0
    risk_label: str = "moderate"
    risk_factors: list[str] = []
    blockchain_attested: bool = False
    description: str = ""
    created_at: datetime = Field(default_factory=_now)


# ---------- Audit ----------
class AuditEvent(BaseModel):
    id: str = Field(default_factory=_uuid)
    event_type: str
    actor_user_id: Optional[str] = None
    actor_name: str = ""
    spv_id: Optional[str] = None
    block_number: int
    block_hash: str
    previous_hash: str
    payload: dict[str, Any]
    timestamp: datetime = Field(default_factory=_now)


# ---------- Payments ----------
class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=_uuid)
    session_id: str
    amount: float
    currency: str
    status: str
    payment_status: str
    user_id: Optional[str] = None
    purpose: str  # spv_investment | episode_unlock
    metadata: dict[str, Any] = {}
    created_at: datetime = Field(default_factory=_now)


# ---------- AI Inputs ----------
class BudgetForecastRequest(BaseModel):
    production_type: str
    territory: str
    genre: str
    episode_count: int = Field(ge=1, le=200)
    target_quality: str = "premium"  # bargain | standard | premium | flagship
    notes: str = ""


class DealMemoRequest(BaseModel):
    spv_id: str


class GreenlightRequest(BaseModel):
    spv_id: str


class RightsConflictRequest(BaseModel):
    spv_id: str


class VendorRiskRequest(BaseModel):
    vendor_id: str
