import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ActivityService {

  private apiUrl = 'http://127.0.0.1:8000/api/activities';

  constructor(private http: HttpClient) {}

  createActivity(activity: any) {

    const token = localStorage.getItem('token');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post(
      this.apiUrl,
      activity,
      { headers }
    );
  }

  deleteActivity(activityId: number) {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.delete(
      `${this.apiUrl}/${activityId}`,
      { headers }
    );
  }
}