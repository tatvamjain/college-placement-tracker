import asyncio
import json
import logging
import signal

from redis.asyncio import Redis
from sqlalchemy import func, select, update

from app.config import settings
from app.db import SessionLocal, engine
from app.models import AuthOutbox

log = logging.getLogger("auth.relay")

STREAM = "auth.events"
BATCH_SIZE = 100
IDLE_SLEEP_SECONDS = 1.0
STREAM_MAXLEN = 10_000

redis = Redis(
    host=settings.redis_host,
    port=settings.redis_port,
    password=settings.redis_password,
    decode_responses=True,
    socket_timeout=2,
    socket_connect_timeout=2,
)


async def relay_batch() -> int:
    async with SessionLocal() as session:
        rows = (
            await session.scalars(
                select(AuthOutbox)
                .where(AuthOutbox.published_at.is_(None))
                .order_by(AuthOutbox.id)
                .limit(BATCH_SIZE)
                .with_for_update(skip_locked=True)
            )
        ).all()
        if not rows:
            return 0

        pipe = redis.pipeline(transaction=False)
        for row in rows:
            pipe.xadd(
                STREAM,
                {"event_type": row.event_type, "payload": json.dumps(row.payload)},
                maxlen=STREAM_MAXLEN,
                approximate=True,
            )
        await pipe.execute()

        await session.execute(
            update(AuthOutbox)
            .where(AuthOutbox.id.in_([r.id for r in rows]))
            .values(published_at=func.now())
        )
        await session.commit()
        return len(rows)


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    log.info("relay started, stream=%s", STREAM)
    while not stop.is_set():
        try:
            sent = await relay_batch()
        except Exception:
            log.exception("relay batch failed, will retry")
            sent = 0
        if sent:
            log.info("published %d events", sent)
            continue
        try:
            await asyncio.wait_for(stop.wait(), timeout=IDLE_SLEEP_SECONDS)
        except asyncio.TimeoutError:
            pass

    await redis.aclose()
    await engine.dispose()
    log.info("relay stopped")


if __name__ == "__main__":
    asyncio.run(main())