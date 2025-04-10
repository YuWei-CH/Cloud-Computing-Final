from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.ext.asyncio import async_sessionmaker
from config import settings
import logging

logger = logging.getLogger(__name__)

# Create async engine
DATABASE_URL = f"postgresql+asyncpg://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
engine = create_async_engine(DATABASE_URL, echo=settings.DB_ECHO_SQL)

# Create async session factory
async_session = async_sessionmaker(
    engine, 
    class_=AsyncSession,
    expire_on_commit=False
)

# Create declarative base
Base = declarative_base()

async def get_db():
    """Dependency for getting async db session"""
    db = async_session()
    try:
        yield db
    finally:
        await db.close()

# Initialize database
async def init_db():
    """Create all tables if they don't exist"""
    async with engine.begin() as conn:
        logger.info("Creating database tables (if they don't exist)")
        await conn.run_sync(Base.metadata.create_all) 