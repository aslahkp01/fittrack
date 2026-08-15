import { Component, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormGroup
} from '@angular/forms';
import { AuthService } from '../../services/auth';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {

  loginForm: FormGroup;
  showPassword = false;
  isSubmitting = signal(false);

  // Dynamic Popup Alert State
  alertMessage = signal<string | null>(null);
  alertType = signal<'error' | 'success'>('error');
  private alertTimeout: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  ngOnInit() {
    if (this.authService.getUser() && this.authService.getToken()) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  showAlert(message: string, type: 'error' | 'success' = 'error', durationMs: number = 4500) {
    if (this.alertTimeout) clearTimeout(this.alertTimeout);
    this.alertMessage.set(message);
    this.alertType.set(type);
    this.alertTimeout = setTimeout(() => {
      this.closeAlert();
    }, durationMs);
  }

  closeAlert() {
    this.alertMessage.set(null);
  }

  loginUser() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.showAlert('Please fill in all required fields correctly.', 'error');
      return;
    }

    this.isSubmitting.set(true);
    const credentials = this.loginForm.value;

    this.authService.login(credentials).subscribe({
      next: (response: any) => {
        this.isSubmitting.set(false);
        this.authService.saveLoginData(response);
        this.showAlert('Login successful! Redirecting...', 'success', 1500);
        setTimeout(() => {
          this.router.navigate(['/dashboard'], { replaceUrl: true });
        }, 600);
      },
      error: (error: any) => {
        this.isSubmitting.set(false);
        console.error('Login error:', error);
        const errMsg = error?.error?.detail || error?.error?.message || 'Invalid email or password. Please try again.';
        this.showAlert(errMsg, 'error');
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

}