import asyncio
import sys

from sqlalchemy import update

from app.db import SessionLocal
from app.models import User, UserRole


async def main(email: str) -> None:
    async with SessionLocal() as session:
        result = await session.execute(
            update(User).where(User.email == email.lower()).values(role=UserRole.admin)
        )
        await session.commit()
    print("Promoted to admin" if result.rowcount else "No such user. Log in once first.")


asyncio.run(main(sys.argv[1]))