import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {

  private apiUrl = 'http://localhost:8000/api/leaderboard';

  constructor(private http: HttpClient) {}

  getLeaderboard() {
    return this.http.get(this.apiUrl);
  }
  getLeaderboardTrends() {
  return this.http.get('http://127.0.0.1:8000/api/leaderboard/trends');
}
}