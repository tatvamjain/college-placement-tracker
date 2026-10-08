from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from collections.abc import AsyncIterator
from app.config import settings

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


# base is the base class for all the models from which these models inherit and metadata collects all the tablee definitions

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
# engine manages a connection pool: opening a database connection is slow, so a few are kept open and reused. pool_pre_ping checks a connection is still alive before using it.
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
# session local is a factory that creates unit of works that is sessions
async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session