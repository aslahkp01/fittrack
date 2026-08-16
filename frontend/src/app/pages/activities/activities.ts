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

  // Edit Modal State
  editingActivity = signal<any | null>(null);
  editSport = 'running';
  editDistance: number | null = 5.0;
  editDurationMins: number | null = 45;
  editSteps: number | null = 8000;
  isUpdating = signal(false);

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

    // Sorting (using activity_date field)
    if (this.sortBy === 'newest') {
      list.sort((a, b) => new Date(b.activity_date || 0).getTime() - new Date(a.activity_date || 0).getTime());
    } else if (this.sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.activity_date || 0).getTime() - new Date(b.activity_date || 0).getTime());
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

  // Edit Activity Flow
  openEditModal(act: any) {
    this.editingActivity.set({ ...act });
    this.editSport = act.sport;
    this.editDistance = act.distance_km;
    this.editDurationMins = act.duration_seconds ? Math.round(act.duration_seconds / 60) : null;
    this.editSteps = act.steps;
  }

  closeEditModal() {
    this.editingActivity.set(null);
  }

  onEditSportChange(sport: string) {
    this.editSport = sport;
    if (sport === 'running' || sport === 'walking') {
      if (!this.editDistance) this.editDistance = 5.0;
      this.editDurationMins = null;
      this.editSteps = null;
    } else if (sport === 'cycling') {
      if (!this.editDistance) this.editDistance = 15.0;
      this.editDurationMins = null;
      this.editSteps = null;
    } else if (sport === 'swimming' || sport === 'gym') {
      if (!this.editDurationMins) this.editDurationMins = 45;
      this.editDistance = null;
      this.editSteps = null;
    } else if (sport === 'steps') {
      if (!this.editSteps) this.editSteps = 8000;
      this.editDistance = null;
      this.editDurationMins = null;
    }
  }

  get editEstimatedPoints(): number {
    const sport = this.editSport;
    if (sport === 'running') {
      return Math.floor((Number(this.editDistance) || 0) * 100);
    } else if (sport === 'walking') {
      return Math.floor((Number(this.editDistance) || 0) * 50);
    } else if (sport === 'cycling') {
      return Math.floor((Number(this.editDistance) || 0) * 25);
    } else if (sport === 'swimming') {
      return Math.floor((Number(this.editDurationMins) || 0) * 15);
    } else if (sport === 'gym') {
      return Math.floor((Number(this.editDurationMins) || 0) * 5);
    } else if (sport === 'steps') {
      return Math.floor((Number(this.editSteps) || 0) / 100);
    }
    return 0;
  }

  saveEditActivity() {
    const act = this.editingActivity();
    if (!act) return;

    let metric_type = 'distance';
    if (this.editSport === 'swimming' || this.editSport === 'gym') {
      metric_type = 'duration';
    } else if (this.editSport === 'steps') {
      metric_type = 'steps';
    }

    const payload: any = {
      sport: this.editSport,
      metric_type: metric_type,
      distance_km: metric_type === 'distance' ? Number(this.editDistance) : null,
      duration_seconds: metric_type === 'duration' ? Number(this.editDurationMins) * 60 : null,
      steps: metric_type === 'steps' ? Number(this.editSteps) : null
    };

    this.isUpdating.set(true);
    this.activityService.updateActivity(act.id, payload).subscribe({
      next: (updated: any) => {
        this.isUpdating.set(false);
        this.activities.update(list => list.map(a => a.id === act.id ? { 
          ...a, 
          ...updated, 
          activity_date: a.activity_date 
        } : a));
        this.closeEditModal();
        this.toastMessage.set('Workout updated successfully!');
        setTimeout(() => this.toastMessage.set(null), 3000);
      },
      error: (err: any) => {
        console.error('Update error:', err);
        this.isUpdating.set(false);
        alert(err?.error?.detail || 'Failed to update activity.');
      }
    });
  }

  // Export to CSV
  exportToCSV() {
    const data = this.filteredActivities;
    if (!data.length) {
      alert('No activities to export.');
      return;
    }

    const headers = ['ID', 'Sport', 'Metric Type', 'Distance (km)', 'Duration (mins)', 'Steps', 'Points', 'Activity Date'];
    const rows = data.map(a => [
      a.id,
      `"${a.sport}"`,
      `"${a.metric_type}"`,
      a.distance_km ?? '',
      a.duration_seconds ? Math.round(a.duration_seconds / 60) : '',
      a.steps ?? '',
      a.points,
      `"${a.activity_date || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `fittrack_activities_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toastMessage.set('✓ CSV export downloaded successfully!');
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  // Export to JSON
  exportToJSON() {
    const data = this.filteredActivities;
    if (!data.length) {
      alert('No activities to export.');
      return;
    }

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `fittrack_activities_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.toastMessage.set('✓ JSON export downloaded successfully!');
    setTimeout(() => this.toastMessage.set(null), 3000);
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
