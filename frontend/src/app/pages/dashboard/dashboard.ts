import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { DashboardService } from '../../services/dashboard';
import { ActivityService } from '../../services/activity';
import { Chart } from 'chart.js/auto';
import { AuthService } from '../../services/auth';
import { Router, RouterLink } from '@angular/router';
import { TitleCasePipe, CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    TitleCasePipe,
    CommonModule,
    RouterLink
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {

  dashboard = signal<any>(null);
  isLoading = signal<boolean>(true);
  isLoggingFast = signal<boolean>(false);
  toastMessage = signal<string | null>(null);
  toastType = signal<'success' | 'info' | 'error'>('success');
  timeFilter = signal<'7d' | '30d' | 'all'>('7d');

  volumeChart: Chart | undefined;
  sportChart: Chart | undefined;

  private toastTimeout: any;

  constructor(
    private dashboardService: DashboardService,
    private activityService: ActivityService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router
  ) {}

  get currentUser() {
    return this.authService.getUser();
  }

  ngOnInit() {
    const user = this.authService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadDashboard();
  }

  loadDashboard(preserveLoadingState: boolean = false) {
    const user = this.authService.getUser();
    if (!user) return;

    if (!preserveLoadingState) {
      this.isLoading.set(true);
    }

    this.dashboardService.getDashboard(user.id).subscribe({
      next: (data: any) => {
        this.dashboard.set(data);
        this.isLoading.set(false);

        setTimeout(() => {
          this.createVolumeChart();
          this.createSportChart();
          this.cdr.detectChanges();
        }, 50);
      },
      error: (error: any) => {
        console.error('Dashboard error:', error);
        this.isLoading.set(false);
      }
    });
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  getUserFirstName(): string {
    const name = this.dashboard()?.user?.name || this.currentUser?.first_name || 'Athlete';
    return name.split(' ')[0];
  }

  getUserFullName(): string {
    if (this.dashboard()?.user?.name) {
      return this.dashboard().user.name;
    }
    if (this.currentUser) {
      return `${this.currentUser.first_name} ${this.currentUser.last_name}`;
    }
    return 'Athlete';
  }

  setTimeFilter(filter: '7d' | '30d' | 'all') {
    this.timeFilter.set(filter);
    this.createVolumeChart();
  }

  // Fast 1-Click Workout Logging
  quickLog(sport: string, metricType: string, value: number, label: string) {
    if (this.isLoggingFast()) return;
    this.isLoggingFast.set(true);

    const payload: any = {
      sport: sport,
      metric_type: metricType
    };

    if (metricType === 'distance') {
      payload.distance_km = value;
    } else if (metricType === 'duration') {
      payload.duration_seconds = value;
    } else if (metricType === 'steps') {
      payload.steps = value;
    }

    this.activityService.createActivity(payload).subscribe({
      next: (res: any) => {
        this.isLoggingFast.set(false);
        this.showToast(`🔥 Logged ${label}! Points earned.`, 'success');
        this.loadDashboard(true);
      },
      error: (err: any) => {
        this.isLoggingFast.set(false);
        this.showToast('Could not log workout. Please try again.', 'error');
        console.error('Quick log error:', err);
      }
    });
  }

  deleteActivity(activityId: number, event: Event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to remove this activity?')) return;

    this.activityService.deleteActivity(activityId).subscribe({
      next: () => {
        this.showToast('Activity removed.', 'info');
        this.loadDashboard(true);
      },
      error: (err: any) => {
        console.error('Delete error:', err);
        this.showToast('Failed to delete activity.', 'error');
      }
    });
  }

  showToast(message: string, type: 'success' | 'info' | 'error' = 'success') {
    this.toastMessage.set(message);
    this.toastType.set(type);

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.toastMessage.set(null);
    }, 3800);
  }

  // Stat Aggregations
  getTotalActivitiesCount(): number {
    return this.dashboard()?.activities?.length || 0;
  }

  getTotalDistance(): string {
    const activities = this.dashboard()?.activities;
    if (!activities || !activities.length) return '0.0';
    const totalKm = activities.reduce((sum: number, act: any) => sum + (act.distance_km || 0), 0);
    return totalKm > 0 ? totalKm.toFixed(1) : '0.0';
  }

  getTotalDurationHours(): string {
    const activities = this.dashboard()?.activities;
    if (!activities || !activities.length) return '0.0';
    const totalSecs = activities.reduce((sum: number, act: any) => sum + (act.duration_seconds || 0), 0);
    const totalHours = totalSecs / 3600;
    return totalHours > 0 ? totalHours.toFixed(1) : '0.0';
  }

  getTotalSteps(): string {
    const activities = this.dashboard()?.activities;
    if (!activities || !activities.length) return '0';
    const totalSteps = activities.reduce((sum: number, act: any) => sum + (act.steps || 0), 0);
    return totalSteps.toLocaleString();
  }

  // Goal Progress Calculations (Weekly Targets)
  getPointsGoalProgress(): { current: number; target: number; pct: number } {
    const current = this.dashboard()?.weekly_stats?.this_week_points || 0;
    const target = 150;
    const pct = Math.min(100, Math.round((current / target) * 100));
    return { current, target, pct };
  }

  getDistanceGoalProgress(): { current: number; target: number; pct: number } {
    const current = this.dashboard()?.weekly_stats?.this_week_distance || 0;
    const target = 25.0;
    const pct = Math.min(100, Math.round((current / target) * 100));
    return { current, target, pct };
  }

  getDurationGoalProgress(): { current: number; target: number; pct: number } {
    const current = this.dashboard()?.weekly_stats?.this_week_duration_hours || 0;
    const target = 5.0;
    const pct = Math.min(100, Math.round((current / target) * 100));
    return { current, target, pct };
  }

  getActivityMetricDisplay(activity: any): string {
    if (activity.distance_km) {
      return `${activity.distance_km} km`;
    }
    if (activity.duration_seconds) {
      const minutes = Math.round(activity.duration_seconds / 60);
      return `${minutes} min`;
    }
    if (activity.steps) {
      return `${activity.steps.toLocaleString()} steps`;
    }
    return `${activity.points} pts`;
  }

  getActivityDateDisplay(activity: any): string {
    if (!activity.activity_date) return 'Today';
    const date = new Date(activity.activity_date);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return 'Today';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getSportBadgeClass(sport: string): string {
    switch (sport?.toLowerCase()) {
      case 'running':
      case 'walking':
        return 'badge-green';
      case 'cycling':
        return 'badge-orange';
      case 'swimming':
        return 'badge-blue';
      case 'gym':
        return 'badge-purple';
      case 'steps':
        return 'badge-pink';
      default:
        return 'badge-purple';
    }
  }

  // Chart.js 1: Volume Over Time (Line Chart)
  createVolumeChart() {
    const canvas = document.getElementById('volumeChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.volumeChart) {
      this.volumeChart.destroy();
    }

    const dashboardData = this.dashboard();
    let rawVolume = dashboardData?.volume_over_time || [];

    const currentFilter = this.timeFilter();
    let filteredData = [...rawVolume];

    if (currentFilter === '7d') {
      filteredData = filteredData.slice(-7);
    } else if (currentFilter === '30d') {
      filteredData = filteredData.slice(-30);
    }

    let dates: string[] = [];
    let points: number[] = [];

    if (filteredData.length > 0) {
      dates = filteredData.map((item: any) => {
        const d = new Date(item.date);
        return currentFilter === '7d'
          ? d.toLocaleDateString('en-US', { weekday: 'short' })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      points = filteredData.map((item: any) => item.points);
    } else {
      dates = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      points = [0, 0, 0, 0, 0, 0, 0];
    }

    const ctx = canvas.getContext('2d');
    let gradient = null;
    if (ctx) {
      gradient = ctx.createLinearGradient(0, 0, 0, 280);
      gradient.addColorStop(0, 'rgba(109, 61, 245, 0.28)');
      gradient.addColorStop(0.7, 'rgba(109, 61, 245, 0.04)');
      gradient.addColorStop(1, 'rgba(109, 61, 245, 0)');
    }

    this.volumeChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Points Earned',
            data: points,
            fill: true,
            backgroundColor: gradient || 'rgba(109, 61, 245, 0.1)',
            borderColor: '#6D3DF5',
            borderWidth: 2.8,
            tension: 0.4,
            pointBackgroundColor: '#FFFFFF',
            pointBorderColor: '#6D3DF5',
            pointBorderWidth: 2.5,
            pointRadius: 4.5,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: '#6D3DF5',
            pointHoverBorderColor: '#FFFFFF',
            pointHoverBorderWidth: 2.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181B',
            titleFont: { family: 'Inter', size: 12, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 10,
            displayColors: false,
            callbacks: {
              label: (context) => `⚡ ${context.parsed.y} points`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'Inter', size: 11, weight: 'normal' },
              color: '#9CA3AF'
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: '#F3F4F6' },
            ticks: {
              font: { family: 'Inter', size: 11, weight: 'normal' },
              color: '#9CA3AF',
              stepSize: 15
            }
          }
        }
      }
    });
  }

  // Chart.js 2: Sport Breakdown (Doughnut Chart)
  createSportChart() {
    const canvas = document.getElementById('sportChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.sportChart) {
      this.sportChart.destroy();
    }

    const breakdown = this.dashboard()?.sport_breakdown || {};
    const sports = Object.keys(breakdown);

    let labels: string[] = [];
    let counts: number[] = [];
    let backgroundColors: string[] = [];

    const sportColorMap: { [key: string]: string } = {
      running: '#10B981',
      walking: '#06B6D4',
      cycling: '#F59E0B',
      swimming: '#3B82F6',
      gym: '#6D3DF5',
      steps: '#EC4899'
    };

    if (sports.length > 0) {
      sports.forEach(sport => {
        labels.push(sport.charAt(0).toUpperCase() + sport.slice(1));
        counts.push(breakdown[sport]?.count || 1);
        backgroundColors.push(sportColorMap[sport.toLowerCase()] || '#8B5CF6');
      });
    } else {
      labels = ['No Data'];
      counts = [1];
      backgroundColors = ['#E5E7EB'];
    }

    this.sportChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: counts,
            backgroundColor: backgroundColors,
            borderWidth: 3,
            borderColor: '#FFFFFF',
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: 'Inter', size: 11, weight: 'bold' },
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 12,
              color: '#4B5563'
            }
          },
          tooltip: {
            backgroundColor: '#18181B',
            titleFont: { family: 'Inter', size: 12, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed} workouts`
            }
          }
        }
      }
    });
  }

}