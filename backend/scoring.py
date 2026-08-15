import math

def calculate_points(activity) -> int:
    sport = (activity.sport or "").lower().strip()

    # Distance-based: Points scale linearly based on distance, floored to nearest integer
    if sport == "running":
        if activity.distance_km is None or activity.distance_km <= 0:
            return 0
        # 1 km = 100 Points
        return math.floor(float(activity.distance_km) * 100)

    if sport == "walking":
        if activity.distance_km is None or activity.distance_km <= 0:
            return 0
        # 1 km = 50 Points (e.g. 1.55 km * 50 = 77.5 -> 77 pts)
        return math.floor(float(activity.distance_km) * 50)

    if sport == "cycling":
        if activity.distance_km is None or activity.distance_km <= 0:
            return 0
        # 1 km = 25 Points
        return math.floor(float(activity.distance_km) * 25)

    # Duration-based: Only fully completed minutes count (floored to nearest whole minute)
    if sport == "swimming":
        if activity.duration_seconds is None or activity.duration_seconds <= 0:
            return 0
        # 1 minute = 15 Points (e.g. 1m 55s -> 1 min -> 15 pts)
        completed_minutes = int(activity.duration_seconds) // 60
        return completed_minutes * 15

    if sport == "gym":
        if activity.duration_seconds is None or activity.duration_seconds <= 0:
            return 0
        # 1 minute = 5 Points (e.g. 45m -> 225 pts)
        completed_minutes = int(activity.duration_seconds) // 60
        return completed_minutes * 5

    # Count-based: Points awarded only for fully completed blocks of 100 steps
    if sport == "steps":
        if activity.steps is None or activity.steps <= 0:
            return 0
        # 100 steps = 1 Point (e.g. 399 steps -> 300 steps -> 3 pts)
        completed_hundreds = int(activity.steps) // 100
        return completed_hundreds * 1

    return 0