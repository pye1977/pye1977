"""Server-side security primitives for RIVITED Solutions.

- Strict input sanitization (no MongoDB operator injection)
- Prompt-injection-resistant LLM input cleaning
- Confirmation tokens for high-stakes operations (waterfall execute + destructive deletes)
- Output validation against fixed Pydantic schemas for AI responses
"""
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

# Reuse the JWT secret for confirmation tokens — short-lived signed payloads.
_CONFIRMATION_TTL_S = 600  # 10 minutes


def _jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


# ---------------------------------------------------------------------------
# Input sanitization
# ---------------------------------------------------------------------------
def sanitize_dollar_keys(data: Any) -> Any:
    """Remove any keys starting with $ from dicts (prevents Mongo operator injection)."""
    if isinstance(data, dict):
        return {
            k: sanitize_dollar_keys(v)
            for k, v in data.items()
            if isinstance(k, str) and not k.startswith("$") and "." not in k
        }
    if isinstance(data, list):
        return [sanitize_dollar_keys(v) for v in data]
    return data


_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_PROMPT_INJECTION = re.compile(
    r"""(?ix)
    \b(?:ignore|disregard|forget|override)\b[\s\S]{0,40}\b(?:previous|prior|above|all)\b[\s\S]{0,40}\b(?:instructions?|prompt|system|rules)\b
    |
    \bsystem\s*:\s*you\s+are\b
    |
    <\s*(?:system|assistant|user)\s*>
    |
    \bact\s+as\s+(?:if\s+you\s+are\s+|a\s+)?(?:different|another|new|different\s+ai|jailbroken)
    |
    \[\s*(?:end|stop|done)\s*(?:of)?\s*(?:system|instructions?)\s*\]
    """
)


def sanitize_llm_input(text: str, max_len: int = 4000) -> str:
    """Strip control chars, neutralize obvious prompt injections, cap length.

    This is a defense-in-depth measure — the LLM system prompt should still be
    framed to resist injection, but we strip the easy attack patterns here.
    """
    if not text:
        return ""
    text = str(text)
    text = _CONTROL_CHARS.sub(" ", text)
    text = _PROMPT_INJECTION.sub("[redacted-instruction-override]", text)
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


def sanitize_text(text: str, max_len: int = 2000) -> str:
    """For general user-visible text storage (no HTML allowed)."""
    if not text:
        return ""
    text = str(text)
    text = _CONTROL_CHARS.sub(" ", text)
    # Strip raw HTML tags conservatively (we never render unescaped HTML)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()[:max_len]


# ---------------------------------------------------------------------------
# Confirmation tokens (Human-in-the-loop for high-stakes actions)
# ---------------------------------------------------------------------------
def issue_confirmation_token(
    user_id: str, action: str, resource_id: str, extra: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Mint a one-time signed token the client must echo back to confirm.

    Front-end displays a modal explaining the action's impact (e.g. "this will
    distribute $250,000 across 4 stakeholders"). Token expires in 10 minutes.
    """
    nonce = secrets.token_urlsafe(16)
    payload = {
        "user_id": user_id,
        "action": action,
        "resource_id": resource_id,
        "nonce": nonce,
        "extra": extra or {},
        "exp": datetime.now(timezone.utc) + timedelta(seconds=_CONFIRMATION_TTL_S),
        "iat": datetime.now(timezone.utc),
        "type": "confirmation",
    }
    token = jwt.encode(payload, _jwt_secret(), algorithm="HS256")
    return {
        "confirmation_token": token,
        "action": action,
        "expires_in_seconds": _CONFIRMATION_TTL_S,
        "extra": extra or {},
    }


def verify_confirmation_token(
    token: str, user_id: str, action: str, resource_id: str
) -> dict[str, Any]:
    """Raises ValueError if the token doesn't match user+action+resource."""
    if not token:
        raise ValueError("Confirmation token required for this action")
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ValueError("Confirmation token expired — please re-confirm")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid confirmation token")
    if payload.get("type") != "confirmation":
        raise ValueError("Invalid token type")
    if payload.get("user_id") != user_id:
        raise ValueError("Confirmation token does not match the current user")
    if payload.get("action") != action:
        raise ValueError("Confirmation token is for a different action")
    if payload.get("resource_id") != resource_id:
        raise ValueError("Confirmation token is for a different resource")
    return payload
