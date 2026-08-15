import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {

  private apiUrl = `${environment.apiUrl}/leaderboard`;

  constructor(private http: HttpClient) {}

  getLeaderboard() {
    return this.http.get(this.apiUrl);
  }

  getLeaderboardTrends() {
    return this.http.get(`${this.apiUrl}/trends`);
  }
}