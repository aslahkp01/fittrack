import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app, get_db, SECRET_KEY, ALGORITHM
from database import Base
from models import User, Activity, LeaderboardSnapshot
from scoring import calculate_points
from jose import jwt

# In-memory test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)


# ==============================================================================
# 1. User Registration Tests & Duplicate Prevention Edge Cases
# ==============================================================================

def test_user_registration_success():
    """Test successful user registration returns unique userId"""
    response = client.post("/api/users", json={
        "first_name": "Alice",
        "last_name": "Walker",
        "email": "alice@example.com",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "userId" in data
    assert data["userId"] is not None
    assert data["first_name"] == "Alice"
    assert data["last_name"] == "Walker"
    assert data["email"] == "alice@example.com"

def test_user_registration_duplicate_name_case_insensitive():
    """The system must prevent duplicate registrations for users with the same first and last names (case-insensitive)."""
    # First registration
    res1 = client.post("/api/users", json={
        "first_name": "Bob",
        "last_name": "Marley",
        "email": "bob@example.com",
        "password": "password123"
    })
    assert res1.status_code == 200

    # Duplicate with exact same name
    res2 = client.post("/api/users", json={
        "first_name": "Bob",
        "last_name": "Marley",
        "email": "bob2@example.com",
        "password": "password123"
    })
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"].lower()

    # Duplicate with different case ("bob marley")
    res3 = client.post("/api/users", json={
        "first_name": "bob",
        "last_name": "marley",
        "email": "bob3@example.com",
        "password": "password123"
    })
    assert res3.status_code == 400
    assert "already exists" in res3.json()["detail"].lower()

def test_user_registration_duplicate_email():
    """System must prevent duplicate registrations with same email."""
    client.post("/api/users", json={
        "first_name": "Charlie",
        "last_name": "Brown",
        "email": "charlie@example.com",
        "password": "password123"
    })
    res2 = client.post("/api/users", json={
        "first_name": "Charles",
        "last_name": "Smith",
        "email": "charlie@example.com",
        "password": "password123"
    })
    assert res2.status_code == 400


# ==============================================================================
# 2. Data Ingestion & API Validation Tests (400 Bad Request on invalid schemas)
# ==============================================================================

def test_data_ingestion_invalid_sport():
    """API must return 400 Bad Request for invalid sports."""
    # Register user
    reg = client.post("/api/users", json={
        "first_name": "Dave",
        "last_name": "Miller",
        "email": "dave@example.com",
        "password": "password123"
    })
    user_id = reg.json()["userId"]

    res = client.post("/api/activities", json={
        "user_id": user_id,
        "sport": "skydiving",
        "metric_type": "distance",
        "distance_km": 10.0
    })
    assert res.status_code == 400
    assert "Invalid sport" in res.json()["detail"]

def test_data_ingestion_mismatched_metric_type():
    """API must return 400 Bad Request for mismatched sport/metric types."""
    reg = client.post("/api/users", json={
        "first_name": "Emma",
        "last_name": "Watson",
        "email": "emma@example.com",
        "password": "password123"
    })
    user_id = reg.json()["userId"]

    # Running with duration (should be distance)
    res1 = client.post("/api/activities", json={
        "user_id": user_id,
        "sport": "running",
        "metric_type": "duration",
        "duration_seconds": 1800
    })
    assert res1.status_code == 400
    assert "Mismatched metric type" in res1.json()["detail"]

    # Gym with distance (should be duration)
    res2 = client.post("/api/activities", json={
        "user_id": user_id,
        "sport": "gym",
        "metric_type": "distance",
        "distance_km": 5.0
    })
    assert res2.status_code == 400
    assert "Mismatched metric type" in res2.json()["detail"]

def test_data_ingestion_non_positive_values():
    """API must return 400 Bad Request for zero or negative values."""
    reg = client.post("/api/users", json={
        "first_name": "Frank",
        "last_name": "Sinatra",
        "email": "frank@example.com",
        "password": "password123"
    })
    user_id = reg.json()["userId"]

    # Distance <= 0
    res = client.post("/api/activities", json={
        "user_id": user_id,
        "sport": "running",
        "metric_type": "distance",
        "distance_km": 0
    })
    assert res.status_code in [400, 422]

    # Duration <= 0
    res2 = client.post("/api/activities", json={
        "user_id": user_id,
        "sport": "swimming",
        "metric_type": "duration",
        "duration_seconds": -60
    })
    assert res2.status_code in [400, 422]


# ==============================================================================
# 3. Scoring System & Normalization Logic Tests
# ==============================================================================

def test_scoring_running():
    """Running: 1 km = 100 Points."""
    class DummyActivity:
        sport = "running"
        distance_km = 5.0
    assert calculate_points(DummyActivity()) == 500

def test_scoring_walking_flooring():
    """Walking: 1 km = 50 Points. Fractional points must be floored (1.55 km = 77.5 -> 77 pts)."""
    class DummyActivity:
        sport = "walking"
        distance_km = 1.55
    assert calculate_points(DummyActivity()) == 77

def test_scoring_cycling():
    """Cycling: 1 km = 25 Points (10.8 km = 270 pts)."""
    class DummyActivity:
        sport = "cycling"
        distance_km = 10.8
    assert calculate_points(DummyActivity()) == 270

def test_scoring_swimming_duration_flooring():
    """Swimming: 1 minute = 15 Points. Only fully completed minutes count (1 min 55 sec = 115s -> 15 pts)."""
    class DummyActivity:
        sport = "swimming"
        duration_seconds = 115
    assert calculate_points(DummyActivity()) == 15

def test_scoring_gym_duration():
    """Gym: 1 minute = 5 Points (45 mins = 2700s -> 225 pts; 59s -> 0 pts)."""
    class DummyActivity45:
        sport = "gym"
        duration_seconds = 2700
    assert calculate_points(DummyActivity45()) == 225

    class DummyActivity59:
        sport = "gym"
        duration_seconds = 59
    assert calculate_points(DummyActivity59()) == 0

def test_scoring_daily_steps_flooring():
    """Steps: 100 steps = 1 Point. Floored to nearest hundred (399 steps -> 3 pts; 99 steps -> 0 pts; 10050 -> 100 pts)."""
    class DummyActivity399:
        sport = "steps"
        steps = 399
    assert calculate_points(DummyActivity399()) == 3

    class DummyActivity99:
        sport = "steps"
        steps = 99
    assert calculate_points(DummyActivity99()) == 0

    class DummyActivity10k:
        sport = "steps"
        steps = 10050
    assert calculate_points(DummyActivity10k()) == 100


# ==============================================================================
# 4. Leaderboard, Rankings & Trends Tests
# ==============================================================================

def test_leaderboard_standings_and_trends():
    """Test leaderboard returns ranked users with correct total points and trends."""
    # Register 2 users
    u1 = client.post("/api/users", json={
        "first_name": "User",
        "last_name": "One",
        "email": "u1@example.com",
        "password": "password123"
    }).json()["userId"]

    u2 = client.post("/api/users", json={
        "first_name": "User",
        "last_name": "Two",
        "email": "u2@example.com",
        "password": "password123"
    }).json()["userId"]

    # User One: 5 km Run (500 pts)
    client.post("/api/activities", json={
        "user_id": u1,
        "sport": "running",
        "metric_type": "distance",
        "distance_km": 5.0
    })

    # User Two: 10 km Run (1000 pts)
    client.post("/api/activities", json={
        "user_id": u2,
        "sport": "running",
        "metric_type": "distance",
        "distance_km": 10.0
    })

    # Get leaderboard trends
    res = client.get("/api/leaderboard/trends")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data[0]["rank"] == 1
    assert data[0]["user_id"] == u2
    assert data[0]["total_points"] == 1000

    assert data[1]["rank"] == 2
    assert data[1]["user_id"] == u1
    assert data[1]["total_points"] == 500

def test_rank_movement_on_new_activity():
    """Test that logging a workout causes rank to move up and others to move down dynamically."""
    u1 = client.post("/api/users", json={
        "first_name": "First",
        "last_name": "Athlete",
        "email": "first@example.com",
        "password": "password123"
    }).json()["userId"]

    u2 = client.post("/api/users", json={
        "first_name": "Second",
        "last_name": "Athlete",
        "email": "second@example.com",
        "password": "password123"
    }).json()["userId"]

    # Initially u1 is #1 with 100 pts, u2 is #2 with 50 pts
    client.post("/api/activities", json={"user_id": u1, "sport": "running", "metric_type": "distance", "distance_km": 1.0})
    client.post("/api/activities", json={"user_id": u2, "sport": "running", "metric_type": "distance", "distance_km": 0.5})

    # Now u2 logs 10 km Run (+1000 pts) -> u2 becomes #1 (1050 pts), u1 becomes #2 (100 pts)
    client.post("/api/activities", json={"user_id": u2, "sport": "running", "metric_type": "distance", "distance_km": 10.0})

    res = client.get("/api/leaderboard/trends")
    assert res.status_code == 200
    trends = res.json()
    
    # u2 moved UP from #2 to #1
    assert trends[0]["user_id"] == u2
    assert trends[0]["rank"] == 1
    assert trends[0]["previous_rank"] == 2
    assert trends[0]["trend"] == "up"

    # u1 moved DOWN from #1 to #2
    assert trends[1]["user_id"] == u1
    assert trends[1]["rank"] == 2
    assert trends[1]["previous_rank"] == 1
    assert trends[1]["trend"] == "down"


# ==============================================================================
# 5. Activity Update (PUT) Endpoint Tests
# ==============================================================================

def test_update_activity_success_recalculates_points():
    """Test updating an activity's metric value recalculates normalized points properly."""
    u = client.post("/api/users", json={
        "first_name": "Updater",
        "last_name": "User",
        "email": "updater@example.com",
        "password": "password123"
    }).json()["userId"]

    # Log in to get token
    login_res = client.post("/api/login", json={
        "email": "updater@example.com",
        "password": "password123"
    }).json()
    token = login_res["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create initial 5.0 km run (500 pts)
    act_res = client.post("/api/activities", json={
        "user_id": u,
        "sport": "running",
        "metric_type": "distance",
        "distance_km": 5.0
    }, headers=headers).json()
    act_id = act_res["activityId"]
    assert act_res["points"] == 500

    # Update distance to 8.5 km (should recalculate to 850 pts)
    update_res = client.put(f"/api/activities/{act_id}", json={
        "distance_km": 8.5
    }, headers=headers)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["points"] == 850
    assert updated_data["distance_km"] == 8.5
    assert updated_data["sport"] == "running"

def test_update_activity_change_sport():
    """Test changing sport from running to cycling updates metric and recalculates points (20 km * 25 = 500 pts)."""
    client.post("/api/users", json={
        "first_name": "Sport",
        "last_name": "Changer",
        "email": "changer@example.com",
        "password": "password123"
    })
    token = client.post("/api/login", json={
        "email": "changer@example.com",
        "password": "password123"
    }).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    act = client.post("/api/activities", json={
        "sport": "running",
        "metric_type": "distance",
        "distance_km": 5.0
    }, headers=headers).json()

    # Change to cycling 20 km
    res = client.put(f"/api/activities/{act['activityId']}", json={
        "sport": "cycling",
        "distance_km": 20.0
    }, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["sport"] == "cycling"
    assert data["points"] == 500

def test_update_activity_forbidden_for_other_user():
    """A user cannot edit another user's activity."""
    u1 = client.post("/api/users", json={"first_name": "User", "last_name": "One", "email": "u1@example.com", "password": "password123"}).json()["userId"]
    u2 = client.post("/api/users", json={"first_name": "User", "last_name": "Two", "email": "u2@example.com", "password": "password123"}).json()["userId"]

    t1 = client.post("/api/login", json={"email": "u1@example.com", "password": "password123"}).json()["token"]
    t2 = client.post("/api/login", json={"email": "u2@example.com", "password": "password123"}).json()["token"]

    act = client.post("/api/activities", json={"sport": "running", "metric_type": "distance", "distance_km": 5.0}, headers={"Authorization": f"Bearer {t1}"}).json()

    # User 2 tries to edit User 1's activity
    res = client.put(f"/api/activities/{act['activityId']}", json={"distance_km": 10.0}, headers={"Authorization": f"Bearer {t2}"})
    assert res.status_code == 403

def test_update_activity_nonexistent():
    """Updating a non-existent activity returns 404."""
    client.post("/api/users", json={"first_name": "User", "last_name": "Three", "email": "u3@example.com", "password": "password123"})
    token = client.post("/api/login", json={"email": "u3@example.com", "password": "password123"}).json()["token"]
    res = client.put("/api/activities/99999", json={"distance_km": 5.0}, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 404


