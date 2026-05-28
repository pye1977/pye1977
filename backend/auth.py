"""JWT-based authentication + TOTP MFA + Emergent Google OAuth for RIVITED Solutions."""
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import httpx
import jwt
from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field

from database import get_db
from models import LoginRequest, RegisterRequest
from totp import enroll_payload, generate_secret, verify_code

JWT_ALGORITHM = "HS256"
ACCESS_MIN = 60 * 12  # 12 hours
REFRESH_DAYS = 7
MFA_CHALLENGE_MIN = 5
MAX_FAILED = 5
LOCK_MIN = 15

EMERGENT_OAUTH_SESSION_DATA_URL = (
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
)


def _jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


# -------------------- Password helpers --------------------
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# -------------------- Token helpers --------------------
def _create_access(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MIN),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def _create_refresh(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_DAYS),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def _create_mfa_challenge(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "mfa_challenge",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=MFA_CHALLENGE_MIN),
        "nonce": secrets.token_urlsafe(12),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def _set_cookies(response: Response, access: str, refresh: str) -> None:
    common = {"httponly": True, "secure": True, "samesite": "none", "path": "/"}
    response.set_cookie("access_token", access, max_age=ACCESS_MIN * 60, **common)
    response.set_cookie(
        "refresh_token", refresh, max_age=REFRESH_DAYS * 86400, **common
    )


def _serialize_user(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name", ""),
        "role": doc.get("role", "investor"),
        "auth_provider": doc.get("auth_provider", "password"),
        "mfa_enabled": bool(doc.get("mfa_enabled", False)),
        "picture": doc.get("picture", ""),
        "created_at": doc.get("created_at"),
    }


# -------------------- Current-user dependency --------------------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        user = await get_db().users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid user identifier")
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return _serialize_user(user)


def require_role(*roles: str):
    async def dep(user=Depends(get_current_user)) -> dict:
        if user["role"] not in roles and user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Insufficient role")
        return user

    return dep


# -------------------- Router --------------------
router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
async def register(payload: RegisterRequest, response: Response):
    db = get_db()
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "name": payload.name.strip(),
        "role": payload.role,
        "password_hash": hash_password(payload.password),
        "auth_provider": "password",
        "mfa_enabled": False,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    user = _serialize_user(doc)
    access = _create_access(user["id"], user["email"], user["role"])
    refresh = _create_refresh(user["id"])
    _set_cookies(response, access, refresh)
    return {"user": user, "access_token": access}


@router.post("/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    db = get_db()
    email = payload.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= MAX_FAILED:
        last = attempt.get("last_attempt")
        if last and isinstance(last, datetime):
            if datetime.now(timezone.utc) - last < timedelta(minutes=LOCK_MIN):
                raise HTTPException(
                    status_code=429,
                    detail="Too many failed attempts. Try again in a few minutes.",
                )

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash")):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {
                "$inc": {"count": 1},
                "$set": {"last_attempt": datetime.now(timezone.utc)},
            },
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": identifier})

    # If MFA enabled, return an MFA challenge instead of a session.
    if user.get("mfa_enabled"):
        mfa_token = _create_mfa_challenge(str(user["_id"]))
        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "expires_in_seconds": MFA_CHALLENGE_MIN * 60,
        }

    serialized = _serialize_user(user)
    access = _create_access(serialized["id"], serialized["email"], serialized["role"])
    refresh = _create_refresh(serialized["id"])
    _set_cookies(response, access, refresh)
    return {"user": serialized, "access_token": access}


# -------------------- MFA --------------------
class MFAVerifyRequest(BaseModel):
    mfa_token: str
    code: str


@router.post("/mfa/verify")
async def mfa_verify(payload: MFAVerifyRequest, response: Response):
    try:
        decoded = jwt.decode(
            payload.mfa_token, _jwt_secret(), algorithms=[JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="MFA challenge expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid MFA challenge")
    if decoded.get("type") != "mfa_challenge":
        raise HTTPException(status_code=401, detail="Invalid MFA token type")
    user = await get_db().users.find_one({"_id": ObjectId(decoded["sub"])})
    if not user or not user.get("mfa_enabled"):
        raise HTTPException(status_code=401, detail="MFA not enrolled")
    if not verify_code(user.get("mfa_secret", ""), payload.code):
        raise HTTPException(status_code=401, detail="Invalid TOTP code")
    serialized = _serialize_user(user)
    access = _create_access(serialized["id"], serialized["email"], serialized["role"])
    refresh = _create_refresh(serialized["id"])
    _set_cookies(response, access, refresh)
    return {"user": serialized}


@router.post("/mfa/enroll/start")
async def mfa_enroll_start(user=Depends(get_current_user)):
    db = get_db()
    db_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    secret = generate_secret()
    await db.users.update_one(
        {"_id": db_user["_id"]},
        {"$set": {"mfa_secret_pending": secret, "mfa_enabled": False}},
    )
    qr, uri = enroll_payload(secret, db_user["email"])
    return {"qr_data_url": qr, "provisioning_uri": uri, "secret": secret}


class MFAConfirmRequest(BaseModel):
    code: str = Field(min_length=6, max_length=10)


@router.post("/mfa/enroll/confirm")
async def mfa_enroll_confirm(
    payload: MFAConfirmRequest, user=Depends(get_current_user)
):
    db = get_db()
    db_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    secret = db_user.get("mfa_secret_pending")
    if not secret:
        raise HTTPException(
            status_code=400, detail="Start MFA enrollment first"
        )
    if not verify_code(secret, payload.code):
        raise HTTPException(status_code=401, detail="Invalid TOTP code")
    await db.users.update_one(
        {"_id": db_user["_id"]},
        {
            "$set": {"mfa_secret": secret, "mfa_enabled": True},
            "$unset": {"mfa_secret_pending": ""},
        },
    )
    return {"ok": True, "mfa_enabled": True}


@router.post("/mfa/disable")
async def mfa_disable(
    payload: MFAConfirmRequest, user=Depends(get_current_user)
):
    db = get_db()
    db_user = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not db_user or not db_user.get("mfa_enabled"):
        return {"ok": True, "mfa_enabled": False}
    if not verify_code(db_user.get("mfa_secret", ""), payload.code):
        raise HTTPException(status_code=401, detail="Invalid TOTP code")
    await db.users.update_one(
        {"_id": db_user["_id"]},
        {
            "$set": {"mfa_enabled": False},
            "$unset": {"mfa_secret": "", "mfa_secret_pending": ""},
        },
    )
    return {"ok": True, "mfa_enabled": False}


# -------------------- Logout / Me / Refresh --------------------
@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return user


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await get_db().users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    serialized = _serialize_user(user)
    access = _create_access(serialized["id"], serialized["email"], serialized["role"])
    new_refresh = _create_refresh(serialized["id"])
    _set_cookies(response, access, new_refresh)
    return {"user": serialized}


# -------------------- Emergent Google OAuth --------------------
class GoogleSessionRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=512)


@router.post("/google/session")
async def google_session(payload: GoogleSessionRequest, response: Response):
    """Exchange Emergent OAuth session_id for an authenticated app session.

    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            r = await client.get(
                EMERGENT_OAUTH_SESSION_DATA_URL,
                headers={"X-Session-ID": payload.session_id},
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502, detail=f"Could not reach Emergent Auth: {exc}"
            )
    if r.status_code != 200:
        raise HTTPException(
            status_code=401, detail="Invalid Emergent session_id"
        )
    data = r.json() or {}
    email = (data.get("email") or "").lower().strip()
    name = (data.get("name") or "").strip() or email.split("@")[0]
    picture = data.get("picture") or ""
    if not email:
        raise HTTPException(status_code=400, detail="Email missing from Google profile")

    db = get_db()
    db_user = await db.users.find_one({"email": email})
    if not db_user:
        ins = await db.users.insert_one(
            {
                "email": email,
                "name": name,
                "role": "investor",  # default role; admin can upgrade
                "auth_provider": "google",
                "picture": picture,
                "mfa_enabled": False,
                "created_at": datetime.now(timezone.utc),
            }
        )
        db_user = await db.users.find_one({"_id": ins.inserted_id})
    else:
        # Refresh picture/name on each login
        await db.users.update_one(
            {"_id": db_user["_id"]},
            {"$set": {"picture": picture, "name": name or db_user.get("name", "")}},
        )
        db_user["picture"] = picture
        if name:
            db_user["name"] = name

    if db_user.get("mfa_enabled"):
        mfa_token = _create_mfa_challenge(str(db_user["_id"]))
        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "expires_in_seconds": MFA_CHALLENGE_MIN * 60,
        }

    serialized = _serialize_user(db_user)
    access = _create_access(serialized["id"], serialized["email"], serialized["role"])
    refresh = _create_refresh(serialized["id"])
    _set_cookies(response, access, refresh)
    return {"user": serialized}


# -------------------- Admin --------------------
async def seed_admin() -> None:
    db = get_db()
    email = os.environ.get("ADMIN_EMAIL", "admin@rivited.io").lower()
    password = os.environ.get("ADMIN_PASSWORD", "rivited2026")
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one(
            {
                "email": email,
                "name": "RIVITED Admin",
                "role": "admin",
                "password_hash": hash_password(password),
                "auth_provider": "password",
                "mfa_enabled": False,
                "created_at": datetime.now(timezone.utc),
            }
        )
    elif not verify_password(password, existing.get("password_hash")):
        await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": hash_password(password)}},
        )
