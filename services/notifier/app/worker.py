import asyncio
import json
import logging
import os
import signal
import socket
import time

import httpx
from redis.asyncio import Redis
from redis.exceptions import ResponseError

from app.config import settings

log = logging.getLogger("notifier")

STREAMS = ["placement.events", "auth.events"]
GROUP = "notifier"
CONSUMER = f"{socket.gethostname()}-{os.getpid()}"
DEAD_LETTER_STREAM = "notifier.dead"
MAX_DELIVERIES = 5
CLAIM_IDLE_MS = 30_000
RECLAIM_EVERY_SECONDS = 10
DONE_TTL_SECONDS = 7 * 86400

redis = Redis(
    host=settings.redis_host,
    port=settings.redis_port,
    password=settings.redis_password,
    decode_responses=True,
)


# ---------- handlers: what this service actually does ----------

async def on_drive_created(payload: dict) -> None:
    drive_id = payload["data"]["drive_id"]
    async with httpx.AsyncClient(timeout=3) as client:
        resp = await client.get(f"{settings.placement_url}/drives/{drive_id}")
        resp.raise_for_status()
        drive = resp.json()
    log.info(
        "NOTIFY: %s is visiting on %s (%d roles)",
        drive["company"]["name"],
        drive["visit_date"] or "date TBA",
        len(drive["roles"]),
    )


async def on_drive_update_posted(payload: dict) -> None:
    changes = payload["data"]["changes"]
    log.info("NOTIFY: update on drive %s: %s", changes["drive_id"], changes["message"])


async def on_user_banned(payload: dict) -> None:
    data = payload["data"]
    log.info("MODERATION: hide content from %s until %s", data["pseudo_id"], data["banned_until"])


HANDLERS = {
    "DriveCreated": on_drive_created,
    "DriveUpdatePosted": on_drive_update_posted,
    "UserBanned": on_user_banned,
}


# ---------- plumbing: delivery, idempotency, retries ----------

async def ensure_groups() -> None:
    for stream in STREAMS:
        try:
            await redis.xgroup_create(stream, GROUP, id="0", mkstream=True)
            log.info("created group %s on %s", GROUP, stream)
        except ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise


async def handle(fields: dict) -> None:
    payload = json.loads(fields["payload"])
    done_key = f"notifier:done:{payload['event_id']}"
    if await redis.exists(done_key):
        log.info("skip duplicate %s", payload["event_id"])
        return
    handler = HANDLERS.get(fields["event_type"])
    if handler is not None:
        await handler(payload)
    await redis.set(done_key, 1, ex=DONE_TTL_SECONDS)


async def process(stream: str, msg_id: str, fields: dict) -> None:
    try:
        await handle(fields)
    except Exception:
        log.exception("failed %s %s, will retry", stream, msg_id)
        return
    await redis.xack(stream, GROUP, msg_id)


async def reclaim() -> None:
    for stream in STREAMS:
        pending = await redis.xpending_range(
            stream, GROUP, min="-", max="+", count=50, idle=CLAIM_IDLE_MS
        )
        for entry in pending:
            msg_id = entry["message_id"]
            if entry["times_delivered"] >= MAX_DELIVERIES:
                original = await redis.xrange(stream, msg_id, msg_id)
                if original:
                    await redis.xadd(
                        DEAD_LETTER_STREAM, {"source": stream, "source_id": msg_id, **original[0][1]}
                    )
                await redis.xack(stream, GROUP, msg_id)
                log.error("dead-lettered %s %s", stream, msg_id)
                continue
            for claimed_id, fields in await redis.xclaim(
                stream, GROUP, CONSUMER, CLAIM_IDLE_MS, [msg_id]
            ):
                if fields:
                    await process(stream, claimed_id, fields)


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    await ensure_groups()
    log.info("notifier %s listening on %s", CONSUMER, ", ".join(STREAMS))
    last_reclaim = 0.0
    while not stop.is_set():
        try:
            response = await redis.xreadgroup(
                GROUP, CONSUMER, {s: ">" for s in STREAMS}, count=10, block=2000
            )
            for stream, messages in response or []:
                for msg_id, fields in messages:
                    await process(stream, msg_id, fields)
            if time.monotonic() - last_reclaim > RECLAIM_EVERY_SECONDS:
                await reclaim()
                last_reclaim = time.monotonic()
        except Exception:
            log.exception("loop error")
            await asyncio.sleep(1)

    await redis.aclose()
    log.info("notifier stopped")


if __name__ == "__main__":
    asyncio.run(main())