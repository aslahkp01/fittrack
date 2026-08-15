import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup
} from '@angular/forms';
import { ActivityService } from '../../services/activity';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

export interface SportOption {
  id: string;
  name: string;
  icon: string;
  metricType: 'distance' | 'duration' | 'steps';
  rateLabel: string;
  unit: string;
  description: string;
}

@Component({
  selector: 'app-add-activity',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './add-activity.html',
  styleUrl: './add-activity.css'
})
export class AddActivity {

  activityForm: FormGroup;
  isSubmitting = signal(false);
  toastMessage = signal<string | null>(null);

  sportsList: SportOption[] = [
    {
      id: 'running',
      name: 'Running',
      icon: '🏃',
      metricType: 'distance',
      rateLabel: '100 pts / km',
      unit: 'km',
      description: 'Outdoor or treadmill run'
    },
    {
      id: 'walking',
      name: 'Walking',
      icon: '🚶',
      metricType: 'distance',
      rateLabel: '50 pts / km',
      unit: 'km',
      description: 'Daily outdoor walking'
    },
    {
      id: 'cycling',
      name: 'Cycling',
      icon: '🚴',
      metricType: 'distance',
      rateLabel: '25 pts / km',
      unit: 'km',
      description: 'Road, mountain, or stationary bike'
    },
    {
      id: 'swimming',
      name: 'Swimming',
      icon: '🏊',
      metricType: 'duration',
      rateLabel: '15 pts / min',
      unit: 'mins',
      description: 'Lap or open water swim'
    },
    {
      id: 'gym',
      name: 'Gym & Fitness',
      icon: '🏋️',
      metricType: 'duration',
      rateLabel: '5 pts / min',
      unit: 'mins',
      description: 'Weights, HIIT, cardio, or crossfit'
    },
    {
      id: 'steps',
      name: 'Daily Steps',
      icon: '👣',
      metricType: 'steps',
      rateLabel: '1 pt / 100 steps',
      unit: 'steps',
      description: 'Tracked daily step count'
    }
  ];

  constructor(
    private fb: FormBuilder,
    private activityService: ActivityService,
    private router: Router,
    private authService: AuthService
  ) {
    this.activityForm = this.fb.group({
      sport: ['running', Validators.required],
      distance_km: [5.0, [Validators.min(0.01)]],
      duration_minutes: [null, [Validators.min(1)]],
      steps: [null, [Validators.min(1)]]
    });
  }

  get selectedSport(): string {
    return this.activityForm.get('sport')?.value ?? 'running';
  }

  get currentSportInfo(): SportOption | undefined {
    return this.sportsList.find(s => s.id === this.selectedSport);
  }

  selectSport(sportId: string) {
    this.activityForm.patchValue({ sport: sportId });

    // Set smart defaults
    if (sportId === 'running' || sportId === 'walking') {
      this.activityForm.patchValue({ distance_km: 5.0, duration_minutes: null, steps: null });
    } else if (sportId === 'cycling') {
      this.activityForm.patchValue({ distance_km: 15.0, duration_minutes: null, steps: null });
    } else if (sportId === 'swimming' || sportId === 'gym') {
      this.activityForm.patchValue({ duration_minutes: 45, distance_km: null, steps: null });
    } else if (sportId === 'steps') {
      this.activityForm.patchValue({ steps: 8000, distance_km: null, duration_minutes: null });
    }
  }

  setDistance(val: number) {
    this.activityForm.patchValue({ distance_km: val });
  }

  addDistance(increment: number) {
    const current = Number(this.activityForm.get('distance_km')?.value) || 0;
    const newVal = Math.round((current + increment) * 10) / 10;
    this.activityForm.patchValue({ distance_km: newVal });
  }

  setDuration(mins: number) {
    this.activityForm.patchValue({ duration_minutes: mins });
  }

  addDuration(increment: number) {
    const current = Number(this.activityForm.get('duration_minutes')?.value) || 0;
    this.activityForm.patchValue({ duration_minutes: current + increment });
  }

  setSteps(val: number) {
    this.activityForm.patchValue({ steps: val });
  }

  addSteps(increment: number) {
    const current = Number(this.activityForm.get('steps')?.value) || 0;
    this.activityForm.patchValue({ steps: current + increment });
  }

  get estimatedPoints(): number {
    const sport = this.selectedSport;
    if (sport === 'running') {
      const dist = Number(this.activityForm.get('distance_km')?.value) || 0;
      return Math.floor(dist * 100);
    } else if (sport === 'walking') {
      const dist = Number(this.activityForm.get('distance_km')?.value) || 0;
      return Math.floor(dist * 50);
    } else if (sport === 'cycling') {
      const dist = Number(this.activityForm.get('distance_km')?.value) || 0;
      return Math.floor(dist * 25);
    } else if (sport === 'swimming') {
      const mins = Number(this.activityForm.get('duration_minutes')?.value) || 0;
      return Math.floor(mins * 15);
    } else if (sport === 'gym') {
      const mins = Number(this.activityForm.get('duration_minutes')?.value) || 0;
      return Math.floor(mins * 5);
    } else if (sport === 'steps') {
      const st = Number(this.activityForm.get('steps')?.value) || 0;
      return Math.floor(st / 100);
    }
    return 0;
  }

  submitActivity() {
    const user = this.authService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.activityForm.invalid) {
      this.activityForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const sport = this.selectedSport;
    const info = this.currentSportInfo;

    let metric_type = info?.metricType || 'distance';
    let durationSeconds: number | null = null;

    if (metric_type === 'duration') {
      const mins = Number(this.activityForm.value.duration_minutes) || 0;
      durationSeconds = mins * 60;
    }

    const activity = {
      sport: sport,
      metric_type: metric_type,
      distance_km: metric_type === 'distance' ? Number(this.activityForm.value.distance_km) : null,
      duration_seconds: durationSeconds,
      steps: metric_type === 'steps' ? Number(this.activityForm.value.steps) : null
    };

    this.activityService.createActivity(activity).subscribe({
      next: (response: any) => {
        this.isSubmitting.set(false);
        this.toastMessage.set(`Awesome! +${this.estimatedPoints} points earned!`);
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 600);
      },
      error: (error: any) => {
        console.error('Activity error:', error);
        this.isSubmitting.set(false);
        alert('Failed to record activity. Please check input values.');
      }
    });
  }

}