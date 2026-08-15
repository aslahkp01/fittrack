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

  registerUser() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const user = this.registerForm.value;

    this.userService.registerUser(user).subscribe({
      next: (response: any) => {
        this.isSubmitting.set(false);
        alert('Account created successfully! Please log in.');
        this.registerForm.reset();
        this.router.navigate(['/login'], { replaceUrl: true });
      },
      error: (error: any) => {
        console.error('Registration error:', error);
        this.isSubmitting.set(false);
        alert(error?.error?.detail || error?.error?.message || 'Registration failed');
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

}