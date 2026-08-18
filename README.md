# ⚡ FitTrack — Gamified Fitness Challenge Application

A full-stack fitness challenge application designed to gamify workouts across different sports (**Running, Walking, Cycling, Swimming, Gym, Daily Steps**) into a normalized scoring system with a real-time global leaderboard and personal dashboard.

---

## 🚀 Tech Stack

- **Frontend**: Angular 18+ (Standalone Components, Signals, Reactive Forms, Chart.js)
- **Backend**: Python 3.13, FastAPI, SQLAlchemy ORM, Pydantic, Bcrypt, Python-JOSE (JWT)
- **Database**: Relational SQLite (`fitness.db`)
- **Testing**: Pytest (100% automated test coverage for normalization and edge cases)
- **Design Document**: Detailed architecture in [DESIGN.md](DESIGN.md)

---

## 🏃 Scoring & Normalization Rules

All athletic activities scale to a unified integer Points system:

| Activity | Metric | Conversion Rate | Calculation Rule |
| :--- | :--- | :--- | :--- |
| **Running** | Distance (km) | 100 Points / km | `math.floor(distance_km * 100)` |
| **Walking** | Distance (km) | 50 Points / km | `math.floor(distance_km * 50)` (e.g. 1.55 km = 77 pts) |
| **Cycling** | Distance (km) | 25 Points / km | `math.floor(distance_km * 25)` |
| **Swimming** | Duration (min) | 15 Points / min | `(duration_seconds // 60) * 15` (e.g. 1m 55s = 15 pts) |
| **Gym** | Duration (min) | 5 Points / min | `(duration_seconds // 60) * 5` (e.g. 45 min = 225 pts) |
| **Daily Steps** | Count (steps) | 1 Point / 100 steps | `(steps // 100) * 1` (e.g. 399 steps = 3 pts) |

---

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js (v18+) & npm
- Python (v3.10+)

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
API Documentation will be live at `http://127.0.0.1:8000/docs`.

### 3. Run Backend Automated Tests
```bash
cd backend
pytest test_fitness_challenge.py -v
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run start
```
The application will be accessible at `http://localhost:4200`.

### 5. Run Frontend Unit Tests
```bash
cd frontend
npm test -- --watch=false
```


---

## 📄 Software Design Document
For full architecture diagrams, database ERD, API specifications, and trade-off analysis, review [DESIGN.md](DESIGN.md).
