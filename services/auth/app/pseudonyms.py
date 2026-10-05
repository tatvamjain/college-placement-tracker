import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Pseudonym

ADJECTIVES = [
    "brave", "calm", "clever", "eager", "gentle", "happy", "jolly", "keen", "lucky", "mellow",
    "nimble", "quiet", "rapid", "silent", "sunny", "swift", "witty", "bold", "bright", "cosmic",
]
ANIMALS = [
    "otter", "falcon", "panda", "tiger", "koala", "lynx", "heron", "dolphin", "fox", "owl",
    "yak", "bison", "gecko", "raven", "wolf", "crane", "lemur", "puma", "seal", "whale",
]


def generate_display_name() -> str:
    return f"{secrets.choice(ADJECTIVES)}-{secrets.choice(ANIMALS)}-{secrets.randbelow(1_000_000):06d}"


async def unique_display_name(session: AsyncSession, max_tries: int = 5) -> str:
    for _ in range(max_tries):
        name = generate_display_name()
        taken = await session.scalar(
            select(Pseudonym.pseudo_id).where(Pseudonym.display_name == name)
        )
        if taken is None:
            return name
    raise RuntimeError("Could not generate a unique display name")