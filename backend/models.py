from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=True, unique=True)
    password_hash = Column(String, nullable=True)

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    sport = Column(String, nullable=False)
    metric_type = Column(String, nullable=False)
    distance_km = Column(Float, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    steps = Column(Integer, nullable=True)
    points = Column(Integer, nullable=False)
    activity_date = Column(
        DateTime,
        default=datetime.utcnow
    )
class LeaderboardSnapshot(Base):
    __tablename__ = "leaderboard_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    rank = Column(Integer, nullable=False)
    snapshot_date = Column(DateTime, default=datetime.utcnow)