import json

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.config import settings

ACTIVE_TTL_SECONDS = 300
ARCHIVED_TTL_SECONDS = 86400

redis = Redis(
    host=settings.redis_host,
    port=settings.redis_port,
    password=settings.redis_password,
    decode_responses=True,
    socket_timeout=0.5,
    socket_connect_timeout=0.5,
)


def stats_key(season_label: str) -> str:
    return f"placement:stats:{season_label}"


async def get_json(key: str) -> dict | None:
    try:
        raw = await redis.get(key)
    except RedisError:
        return None
    return json.loads(raw) if raw else None


async def set_json(key: str, value: dict, ttl_seconds: int) -> None:
    try:
        await redis.set(key, json.dumps(value), ex=ttl_seconds)
    except RedisError:
        pass


async def delete(key: str) -> None:
    try:
        await redis.delete(key)
    except RedisError:
        pass