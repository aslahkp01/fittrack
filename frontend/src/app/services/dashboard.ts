import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  private apiUrl = 'http://localhost:8000/api/users';

  constructor(private http: HttpClient) {}

  getDashboard(userId: number) {
    return this.http.get(`${this.apiUrl}/${userId}/dashboard`);
  }
}