import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../services/dashboard';
import { ActivityService } from '../../services/activity';
import { AuthService } from '../../services/auth';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-activities',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './activities.html',
  styleUrl: './activities.css'
})
export class Activities implements OnInit {

  activities = signal<any[]>([]);
  isLoading = signal(true);
  errorMsg = signal('');
  toastMessage = signal<string | null>(null);

  searchTerm = '';
  sportFilter = 'all';
  sortBy = 'newest'; // 'newest' | 'oldest' | 'points' | 'distance'

  constructor(
    private dashboardService: DashboardService,
    private activityService: ActivityService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadActivities();
  }

  loadActivities() {
    const user = this.authService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.dashboardService.getDashboard(user.id).subscribe({
      next: (data: any) => {
        this.activities.set(data.activities || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching activities:', err);
        this.errorMsg.set('Unable to load your activities. Try again.');
        this.isLoading.set(false);
      }
    });
  }

  get totalWorkouts(): number {
    return this.activities().length;
  }

  get totalPoints(): number {
    return this.activities().reduce((sum, a) => sum + (a.points || 0), 0);
  }

  get totalDistance(): string {
    const sum = this.activities().reduce((acc, a) => acc + (a.distance_km || 0), 0);
    return sum.toFixed(1);
  }

  get favoriteSport(): string {
    const acts = this.activities();
    if (!acts.length) return 'None';
    const counts: Record<string, number> = {};
    acts.forEach(a => {
      counts[a.sport] = (counts[a.sport] || 0) + 1;
    });
    let maxSport = 'None';
    let maxCount = 0;
    for (const [s, c] of Object.entries(counts)) {
      if (c > maxCount) {
        maxCount = c;
        maxSport = s;
      }
    }
    return maxSport.charAt(0).toUpperCase() + maxSport.slice(1);
  }

  getSportCount(sport: string): number {
    if (sport === 'all') return this.activities().length;
    return this.activities().filter(a => a.sport.toLowerCase() === sport.toLowerCase()).length;
  }

  setSportFilter(sport: string) {
    this.sportFilter = sport;
  }

  get filteredActivities() {
    let list = this.activities().filter(act => {
      const search = this.searchTerm.toLowerCase().trim();
      const matchesSearch = !search || 
        act.sport.toLowerCase().includes(search) || 
        (act.metric_type && act.metric_type.toLowerCase().includes(search));
      const matchesSport = this.sportFilter === 'all' || act.sport.toLowerCase() === this.sportFilter.toLowerCase();
      return matchesSearch && matchesSport;
    });

    // Sorting
    if (this.sortBy === 'newest') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (this.sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (this.sortBy === 'points') {
      list.sort((a, b) => (b.points || 0) - (a.points || 0));
    } else if (this.sortBy === 'distance') {
      list.sort((a, b) => (b.distance_km || 0) - (a.distance_km || 0));
    }

    return list;
  }

  deleteActivity(id: number) {
    if (!confirm('Are you sure you want to delete this workout?')) return;

    this.activityService.deleteActivity(id).subscribe({
      next: () => {
        this.activities.update(list => list.filter(a => a.id !== id));
        this.toastMessage.set('Activity deleted successfully.');
        setTimeout(() => this.toastMessage.set(null), 3000);
      },
      error: (err) => {
        console.error('Delete error:', err);
        alert('Failed to delete activity.');
      }
    });
  }

  getMetricValue(act: any): string {
    if (act.sport === 'running' || act.sport === 'walking' || act.sport === 'cycling') {
      return act.distance_km ? `${act.distance_km} km` : '0 km';
    } else if (act.sport === 'swimming' || act.sport === 'gym') {
      if (!act.duration_seconds) return '0 min';
      const mins = Math.round(act.duration_seconds / 60);
      return `${mins} min`;
    } else if (act.sport === 'steps') {
      return act.steps ? `${act.steps.toLocaleString()} steps` : '0 steps';
    }
    return '';
  }

  getSportIcon(sport: string): string {
    switch (sport?.toLowerCase()) {
      case 'running': return '🏃';
      case 'walking': return '🚶';
      case 'cycling': return '🚴';
      case 'swimming': return '🏊';
      case 'gym': return '🏋️';
      case 'steps': return '👣';
      default: return '⚡';
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (isToday) return `Today at ${timeStr}`;
      if (isYesterday) return `Yesterday at ${timeStr}`;

      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

}

