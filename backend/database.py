"""MongoDB connection and collection accessors for RIVITED Solutions."""
import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return _client


def get_db() -> AsyncIOMotorDatabase:
    global _db
    if _db is None:
        _db = get_client()[os.environ["DB_NAME"]]
    return _db


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


async def ensure_indexes() -> None:
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.password_reset_tokens.create_index(
        "expires_at", expireAfterSeconds=0
    )
    await db.spvs.create_index("producer_id")
    await db.spvs.create_index("status")
    await db.cap_table.create_index("spv_id")
    await db.waterfall_tiers.create_index("spv_id")
    await db.investments.create_index("spv_id")
    await db.investments.create_index("investor_user_id")
    await db.rights.create_index("spv_id")
    await db.episodes.create_index("spv_id")
    await db.episode_unlocks.create_index([("user_id", 1), ("episode_id", 1)])
    await db.vendors.create_index("name")
    await db.audit_events.create_index("block_number")
    await db.audit_events.create_index("spv_id")
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.waterfall_payouts.create_index("spv_id")
