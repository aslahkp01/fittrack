import { Component, OnInit, signal } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup
} from '@angular/forms';
import { UserService } from '../../services/user';
import { AuthService } from '../../services/auth';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnInit {

  registerForm: FormGroup;
  isSubmitting = signal(false);
  showPassword = false;

  // Dynamic Popup Alert State
  alertMessage = signal<string | null>(null);
  alertType = signal<'error' | 'success'>('error');
  private alertTimeout: any;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(6)
      ]]  
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

  registerUser() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.showAlert('Please fill in all required fields properly.', 'error');
      return;
    }

    this.isSubmitting.set(true);
    const user = this.registerForm.value;

    this.userService.registerUser(user).subscribe({
      next: (response: any) => {
        this.isSubmitting.set(false);
        this.showAlert('Account created successfully! Redirecting to login...', 'success', 2000);
        this.registerForm.reset();
        setTimeout(() => {
          this.router.navigate(['/login'], { replaceUrl: true });
        }, 1200);
      },
      error: (error: any) => {
        console.error('Registration error:', error);
        this.isSubmitting.set(false);
        const errMsg = error?.error?.detail || error?.error?.message || 'Registration failed. Please check your information.';
        this.showAlert(errMsg, 'error');
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

}