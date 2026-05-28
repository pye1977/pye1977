"""Simulated blockchain audit trail for RIVITED Solutions.

Each event is appended as a 'block' linked by SHA256(prev_hash + payload + ts).
This provides immutable-style audit trails without a real chain.
"""
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Optional

from database import get_db

GENESIS_HASH = "0x000000RIVITEDgenesis000000000000000000000000000000000000000000"


def _hash_block(prev_hash: str, payload: dict[str, Any], timestamp: str) -> str:
    encoded = json.dumps(payload, sort_keys=True, default=str)
    raw = (prev_hash + encoded + timestamp).encode("utf-8")
    return "0x" + hashlib.sha256(raw).hexdigest()[:60]


async def append_event(
    event_type: str,
    payload: dict[str, Any],
    actor_user_id: Optional[str] = None,
    actor_name: str = "",
    spv_id: Optional[str] = None,
) -> dict[str, Any]:
    db = get_db()
    last = await db.audit_events.find_one(sort=[("block_number", -1)])
    if last:
        block_number = last["block_number"] + 1
        prev_hash = last["block_hash"]
    else:
        block_number = 1
        prev_hash = GENESIS_HASH
    ts = datetime.now(timezone.utc)
    ts_str = ts.isoformat()
    block_hash = _hash_block(prev_hash, payload, ts_str)
    event = {
        "event_type": event_type,
        "actor_user_id": actor_user_id,
        "actor_name": actor_name,
        "spv_id": spv_id,
        "block_number": block_number,
        "block_hash": block_hash,
        "previous_hash": prev_hash,
        "payload": payload,
        "timestamp": ts_str,
    }
    await db.audit_events.insert_one(dict(event))
    event.pop("_id", None)
    return event
