from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel,Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import Base, engine, get_db
from models import User, Activity, LeaderboardSnapshot
from scoring import calculate_points
from fastapi.middleware.cors import CORSMiddleware
import os
import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
Base.metadata.create_all(bind=engine)

app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/login"
)

SECRET_KEY = os.environ.get("SECRET_KEY", "fitness-challenge-secret-key")
ALGORITHM = "HS256"

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Fitness challenge API"}


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str

class ActivityCreate(BaseModel):
    user_id: int | None = Field(default=None)
    sport: str
    metric_type: str
    distance_km: float | None = Field(default=None, gt=0)
    duration_seconds: int | None = Field(default=None, gt=0)
    steps: int | None = Field(default=None, gt=0)

class ActivityUpdate(BaseModel):
    sport: str | None = Field(default=None)
    metric_type: str | None = Field(default=None)
    distance_km: float | None = Field(default=None, gt=0)
    duration_seconds: int | None = Field(default=None, gt=0)
    steps: int | None = Field(default=None, gt=0)

class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/users")
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User already exists"
        )

    existing_name = db.query(User).filter(
        func.lower(User.first_name) == func.lower(user.first_name),
        func.lower(User.last_name) == func.lower(user.last_name)
    ).first()

    if existing_name:
        raise HTTPException(
            status_code=400,
            detail="A user with this name already exists"
        )

    password_bytes = user.password.encode('utf-8')
    password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

    new_user = User(
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        password_hash=password_hash
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "userId": new_user.id,
        "message": "User created",
        "first_name": new_user.first_name,
        "last_name": new_user.last_name,
        "email": new_user.email
    }

@app.get("/api/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "email": u.email
        }
        for u in users
    ]

def save_current_leaderboard_snapshot(db: Session):
    """Calculates and stores the current leaderboard ranks as a snapshot baseline."""
    users = (
        db.query(
            User.id,
            func.coalesce(func.sum(Activity.points), 0).label("total_points")
        )
        .outerjoin(Activity, User.id == Activity.user_id)
        .group_by(User.id)
        .order_by(func.coalesce(func.sum(Activity.points), 0).desc())
        .all()
    )
    now = datetime.now(timezone.utc)
    for rank, user in enumerate(users, start=1):
        snapshot = LeaderboardSnapshot(
            user_id=user.id,
            rank=rank,
            snapshot_date=now
        )
        db.add(snapshot)
    db.commit()

@app.post("/api/activities")
def create_activity(
    activity: ActivityCreate, 
    db: Session = Depends(get_db), 
    token: str | None = Depends(OAuth2PasswordBearer(tokenUrl="/api/login", auto_error=False))
):
    # Determine target user
    user_id = None
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("user_id")
        except JWTError:
            pass

    if user_id is None and activity.user_id is not None:
        user_id = activity.user_id

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required or valid user_id must be provided"
        )

    # Verify user exists in database
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=404,
            detail=f"User with id {user_id} not found"
        )

    valid_combinations = {
        "running": "distance",
        "walking": "distance",
        "cycling": "distance",
        "swimming": "duration",
        "gym": "duration",
        "steps": "steps"
    }

    sport = (activity.sport or "").lower().strip()
    metric_type = (activity.metric_type or "").lower().strip()

    if sport not in valid_combinations:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sport '{activity.sport}'. Supported sports: {list(valid_combinations.keys())}"
        )

    if metric_type != valid_combinations[sport]:
        raise HTTPException(
            status_code=400,
            detail=f"Mismatched metric type '{activity.metric_type}' for sport '{activity.sport}'. Expected '{valid_combinations[sport]}'"
        )

    if metric_type == "distance":
        if activity.distance_km is None or activity.distance_km <= 0:
            raise HTTPException(
                status_code=400,
                detail="Distance (km) must be provided and greater than 0"
            )

    if metric_type == "duration":
        if activity.duration_seconds is None or activity.duration_seconds <= 0:
            raise HTTPException(
                status_code=400,
                detail="Duration (seconds) must be provided and greater than 0"
            )

    if metric_type == "steps":
        if activity.steps is None or activity.steps <= 0:
            raise HTTPException(
                status_code=400,
                detail="Steps count must be provided and greater than 0"
            )

    points = calculate_points(activity)
    
    # Save a baseline snapshot before applying the new activity so rank movements can be tracked
    save_current_leaderboard_snapshot(db)

    new_activity = Activity(
        user_id=user_id,
        sport=sport,
        metric_type=metric_type,
        distance_km=activity.distance_km if metric_type == "distance" else None,
        duration_seconds=activity.duration_seconds if metric_type == "duration" else None,
        steps=activity.steps if metric_type == "steps" else None,
        points=points
    )

    db.add(new_activity)
    db.commit()
    db.refresh(new_activity)

    return {
        "activityId": new_activity.id,
        "userId": new_activity.user_id,
        "message": "Activity Recorded",
        "sport": new_activity.sport,
        "metric_type": new_activity.metric_type,
        "points": new_activity.points,
        "distance_km": new_activity.distance_km,
        "duration_seconds": new_activity.duration_seconds,
        "steps": new_activity.steps
    }

@app.post("/api/leaderboard/snapshot")
def create_leaderboard_snapshot(
    db: Session = Depends(get_db)
):
    users = db.query(
        User.id,
        func.sum(Activity.points).label("total_points")
    ).join(
        Activity,
        User.id == Activity.user_id
    ).group_by(
        User.id
    ).order_by(
        func.sum(Activity.points).desc()
    ).all()

    rank = 1

    for user in users:

        snapshot = LeaderboardSnapshot(
            user_id=user.id,
            rank=rank
        )

        db.add(snapshot)

        rank += 1

    db.commit()

    return {
        "message": "Leaderboard snapshot created"
    }
@app.get("/api/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):

    results = (
        db.query(
            User.id,
            User.first_name,
            User.last_name,
            func.coalesce(func.sum(Activity.points), 0).label("total_points")
        )
        .outerjoin(Activity, User.id == Activity.user_id)
        .group_by(User.id)
        .order_by(func.coalesce(func.sum(Activity.points), 0).desc())
        .all()
    )

    leaderboard = []

    for rank, user in enumerate(results, start=1):
        leaderboard.append({
            "rank": rank,
            "user_id": user.id,
            "name": f"{user.first_name} {user.last_name}",
            "total_points": user.total_points
        })

    return leaderboard 



@app.get("/api/activities")
def get_activities(db: Session = Depends(get_db)):
    return db.query(Activity).all()

@app.get("/api/users/{user_id}/dashboard")
def get_dashboard(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if user is None:
        return {
            "message": "User not found"
        }

    activities = (
        db.query(Activity)
        .filter(Activity.user_id == user_id)
        .order_by(Activity.activity_date.desc())
        .all()
    )

    total_points = db.query(
        func.sum(Activity.points)
    ).filter(
        Activity.user_id == user_id
    ).scalar() or 0

    # Volume data over time
    volume_data = (
        db.query(
            func.date(Activity.activity_date).label("date"),
            func.sum(Activity.points).label("points"),
            func.sum(func.coalesce(Activity.distance_km, 0)).label("distance"),
            func.sum(func.coalesce(Activity.duration_seconds, 0)).label("duration"),
            func.sum(func.coalesce(Activity.steps, 0)).label("steps")
        )
        .filter(Activity.user_id == user_id)
        .group_by(func.date(Activity.activity_date))
        .order_by(func.date(Activity.activity_date))
        .all()
    )
    volume_over_time = []
    for date, points, distance, duration, steps in volume_data:
        volume_over_time.append({
            "date": date,
            "points": int(points or 0),
            "distance": round(float(distance or 0), 1),
            "duration": int(duration or 0),
            "steps": int(steps or 0)
        })

    # Detailed sport breakdown
    sport_breakdown = (
        db.query(
            Activity.sport,
            func.count(Activity.id).label("count"),
            func.sum(Activity.points).label("points"),
            func.sum(func.coalesce(Activity.distance_km, 0)).label("distance"),
            func.sum(func.coalesce(Activity.duration_seconds, 0)).label("duration"),
            func.sum(func.coalesce(Activity.steps, 0)).label("steps")
        )
        .filter(Activity.user_id == user_id)
        .group_by(Activity.sport)
        .all()
    )

    sport_data = {}
    for sport, count, pts, dist, dur, stp in sport_breakdown:
        sport_data[sport] = {
            "count": count,
            "points": int(pts or 0),
            "distance": round(float(dist or 0), 1),
            "duration_seconds": int(dur or 0),
            "steps": int(stp or 0)
        }

    # Calculate global leaderboard rank
    all_users = (
        db.query(
            User.id,
            func.coalesce(func.sum(Activity.points), 0).label("total_points")
        )
        .outerjoin(Activity, User.id == Activity.user_id)
        .group_by(User.id)
        .order_by(func.coalesce(func.sum(Activity.points), 0).desc(), User.id.asc())
        .all()
    )
    total_athletes = len(all_users)
    user_rank = 1
    for idx, u in enumerate(all_users, start=1):
        if u.id == user_id:
            user_rank = idx
            break

    # Calculate active workout streak (consecutive days)
    user_dates = (
        db.query(func.date(Activity.activity_date))
        .filter(Activity.user_id == user_id)
        .distinct()
        .order_by(func.date(Activity.activity_date).desc())
        .all()
    )
    date_set = set()
    for row in user_dates:
        d_str = row[0]
        if isinstance(d_str, str):
            try:
                date_set.add(datetime.strptime(d_str, "%Y-%m-%d").date())
            except Exception:
                pass
        elif hasattr(d_str, "date"):
            date_set.add(d_str.date())
        else:
            date_set.add(d_str)

    today = datetime.now(timezone.utc).date()
    streak = 0
    if today in date_set:
        check_date = today
    elif (today - timedelta(days=1)) in date_set:
        check_date = today - timedelta(days=1)
    else:
        check_date = None

    if check_date:
        while check_date in date_set:
            streak += 1
            check_date -= timedelta(days=1)

    # Calculate athlete level and tier
    if total_points < 100:
        tier_name = "Bronze Athlete"
        level = 1
        tier_min = 0
        tier_max = 100
    elif total_points < 250:
        tier_name = "Silver Athlete"
        level = 2
        tier_min = 100
        tier_max = 250
    elif total_points < 500:
        tier_name = "Gold Athlete"
        level = 3
        tier_min = 250
        tier_max = 500
    elif total_points < 1000:
        tier_name = "Platinum Athlete"
        level = 4
        tier_min = 500
        tier_max = 1000
    else:
        tier_name = "Diamond Elite"
        level = 5
        tier_min = 1000
        tier_max = 2500

    tier_progress_pct = min(100, max(0, int(((total_points - tier_min) / (tier_max - tier_min)) * 100)))

    # Calculate weekly vs last week comparison
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    fourteen_days_ago = now - timedelta(days=14)

    this_week_acts = [a for a in activities if a.activity_date and a.activity_date >= seven_days_ago]
    last_week_acts = [a for a in activities if a.activity_date and fourteen_days_ago <= a.activity_date < seven_days_ago]

    this_week_pts = sum(a.points or 0 for a in this_week_acts)
    last_week_pts = sum(a.points or 0 for a in last_week_acts)
    pts_trend_pct = round(((this_week_pts - last_week_pts) / last_week_pts * 100)) if last_week_pts > 0 else (100 if this_week_pts > 0 else 0)

    this_week_dist = sum(a.distance_km or 0 for a in this_week_acts)
    last_week_dist = sum(a.distance_km or 0 for a in last_week_acts)
    dist_trend_pct = round(((this_week_dist - last_week_dist) / last_week_dist * 100)) if last_week_dist > 0 else (100 if this_week_dist > 0 else 0)

    this_week_dur = sum(a.duration_seconds or 0 for a in this_week_acts)
    last_week_dur = sum(a.duration_seconds or 0 for a in last_week_acts)
    dur_trend_pct = round(((this_week_dur - last_week_dur) / last_week_dur * 100)) if last_week_dur > 0 else (100 if this_week_dur > 0 else 0)

    this_week_steps = sum(a.steps or 0 for a in this_week_acts)

    # Activity day checklist for last 7 days
    last_7_days_activity = []
    for i in range(6, -1, -1):
        target_d = (today - timedelta(days=i))
        day_label = target_d.strftime("%a")
        has_logged = target_d in date_set
        last_7_days_activity.append({
            "day": day_label,
            "date": str(target_d),
            "active": has_logged
        })

    return {
        "user": {
            "id": user.id,
            "name": f"{user.first_name} {user.last_name}",
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email
        },
        "total_points": total_points,
        "rank": user_rank,
        "total_athletes": total_athletes,
        "streak_days": streak,
        "tier": {
            "name": tier_name,
            "level": level,
            "points": total_points,
            "tier_min": tier_min,
            "tier_max": tier_max,
            "progress_pct": tier_progress_pct,
            "points_needed": max(0, tier_max - total_points)
        },
        "weekly_stats": {
            "this_week_points": this_week_pts,
            "pts_trend_pct": pts_trend_pct,
            "this_week_distance": round(this_week_dist, 1),
            "dist_trend_pct": dist_trend_pct,
            "this_week_duration_hours": round(this_week_dur / 3600, 1),
            "dur_trend_pct": dur_trend_pct,
            "this_week_steps": this_week_steps,
            "last_7_days": last_7_days_activity
        },
        "activities": [
            {
                "id": a.id,
                "user_id": a.user_id,
                "sport": a.sport,
                "metric_type": a.metric_type,
                "distance_km": a.distance_km,
                "duration_seconds": a.duration_seconds,
                "steps": a.steps,
                "points": a.points,
                "activity_date": a.activity_date.isoformat() if a.activity_date else None
            }
            for a in activities
        ],
        "sport_breakdown": sport_data,
        "volume_over_time": volume_over_time
    }

@app.delete("/api/activities/{activity_id}")
def delete_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.user_id == current_user.id
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    # Snapshot baseline before deleting activity
    save_current_leaderboard_snapshot(db)

    db.delete(activity)
    db.commit()
    return {"message": "Activity deleted successfully"}

@app.put("/api/activities/{activity_id}")
def update_activity(
    activity_id: int,
    activity_update: ActivityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.user_id == current_user.id
    ).first()

    if not activity:
        existing = db.query(Activity).filter(Activity.id == activity_id).first()
        if existing:
            raise HTTPException(status_code=403, detail="You do not have permission to edit this activity")
        raise HTTPException(status_code=404, detail="Activity not found")

    valid_combinations = {
        "running": "distance",
        "walking": "distance",
        "cycling": "distance",
        "swimming": "duration",
        "gym": "duration",
        "steps": "steps"
    }

    target_sport = (activity_update.sport or activity.sport).lower().strip()
    target_metric_type = (activity_update.metric_type or activity.metric_type).lower().strip()

    if target_sport not in valid_combinations:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sport '{target_sport}'. Supported sports: {list(valid_combinations.keys())}"
        )

    # Auto-adjust metric type if sport was changed without explicit metric_type
    if activity_update.sport and not activity_update.metric_type:
        target_metric_type = valid_combinations[target_sport]

    if target_metric_type != valid_combinations[target_sport]:
        raise HTTPException(
            status_code=400,
            detail=f"Mismatched metric type '{target_metric_type}' for sport '{target_sport}'. Expected '{valid_combinations[target_sport]}'"
        )

    # Determine metric values
    target_distance = activity_update.distance_km if target_metric_type == "distance" else None
    target_duration = activity_update.duration_seconds if target_metric_type == "duration" else None
    target_steps = activity_update.steps if target_metric_type == "steps" else None

    # Fallback to existing if metric type unchanged and value omitted
    if target_metric_type == "distance" and target_distance is None:
        target_distance = activity.distance_km
    if target_metric_type == "duration" and target_duration is None:
        target_duration = activity.duration_seconds
    if target_metric_type == "steps" and target_steps is None:
        target_steps = activity.steps

    if target_metric_type == "distance" and (target_distance is None or target_distance <= 0):
        raise HTTPException(status_code=400, detail="Distance (km) must be provided and greater than 0")
    if target_metric_type == "duration" and (target_duration is None or target_duration <= 0):
        raise HTTPException(status_code=400, detail="Duration (seconds) must be provided and greater than 0")
    if target_metric_type == "steps" and (target_steps is None or target_steps <= 0):
        raise HTTPException(status_code=400, detail="Steps count must be provided and greater than 0")

    class ScoringProxy:
        def __init__(self, sport, distance_km, duration_seconds, steps):
            self.sport = sport
            self.distance_km = distance_km
            self.duration_seconds = duration_seconds
            self.steps = steps

    proxy = ScoringProxy(target_sport, target_distance, target_duration, target_steps)
    points = calculate_points(proxy)

    # Save baseline snapshot before applying changes
    save_current_leaderboard_snapshot(db)

    activity.sport = target_sport
    activity.metric_type = target_metric_type
    activity.distance_km = target_distance
    activity.duration_seconds = target_duration
    activity.steps = target_steps
    activity.points = points

    db.commit()
    db.refresh(activity)

    return {
        "activityId": activity.id,
        "userId": activity.user_id,
        "message": "Activity updated successfully",
        "sport": activity.sport,
        "metric_type": activity.metric_type,
        "points": activity.points,
        "distance_km": activity.distance_km,
        "duration_seconds": activity.duration_seconds,
        "steps": activity.steps
    }

@app.get("/api/leaderboard/trends")
def get_leaderboard_trends(
    db: Session = Depends(get_db)
):
    users = db.query(
        User.id,
        User.first_name,
        User.last_name,
        func.coalesce(func.sum(Activity.points), 0).label("total_points")
    ).outerjoin(
        Activity,
        User.id == Activity.user_id
    ).group_by(
        User.id
    ).order_by(
        func.coalesce(func.sum(Activity.points), 0).desc()
    ).all()

    current_rank = 1
    current_data = {}

    for user in users:
        current_data[user.id] = {
            "rank": current_rank,
            "name": f"{user.first_name} {user.last_name}",
            "total_points": user.total_points
        }
        current_rank += 1

    # Check if any snapshot exists; if none, initialize baseline
    snapshot_count = db.query(LeaderboardSnapshot).count()
    if snapshot_count == 0 and len(current_data) > 0:
        save_current_leaderboard_snapshot(db)

    previous_snapshots = db.query(
        LeaderboardSnapshot
    ).order_by(
        LeaderboardSnapshot.snapshot_date.desc(),
        LeaderboardSnapshot.id.desc()
    ).all()

    previous_data = {}
    for snapshot in previous_snapshots:
        if snapshot.user_id not in previous_data:
            previous_data[snapshot.user_id] = snapshot.rank

    result = []
    for user_id, user in current_data.items():
        previous_rank = previous_data.get(user_id)

        if previous_rank is None:
            trend = "new"
        elif user["rank"] < previous_rank:
            trend = "up"
        elif user["rank"] > previous_rank:
            trend = "down"
        else:
            trend = "same"

        result.append({
            "user_id": user_id,
            "rank": user["rank"],
            "name": user["name"],
            "total_points": user["total_points"],
            "previous_rank": previous_rank if previous_rank is not None else user["rank"],
            "trend": trend
        })

    return result
@app.post("/api/login")
def login(
    user: LoginRequest,
    db: Session = Depends(get_db)
):

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if existing_user.password_hash is None:
        raise HTTPException(
            status_code=401,
            detail="Password not set for this user"
        )

    password_correct = bcrypt.checkpw(
        user.password.encode("utf-8"),
        existing_user.password_hash.encode("utf-8")
    )

    if not password_correct:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token_data = {
        "user_id": existing_user.id,
        "email": existing_user.email
    }

    token = jwt.encode(
        token_data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": existing_user.id,
            "first_name": existing_user.first_name,
            "last_name": existing_user.last_name,
            "email": existing_user.email
        }
    }