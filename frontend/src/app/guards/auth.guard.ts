import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Protects authenticated routes (Dashboard, Activities, Add Activity).
 * If user is not logged in, redirects to /login with replaceUrl.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getUser() && authService.getToken()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/**
 * Protects guest-only routes (Login, Register).
 * If user is already logged in, redirects them to /dashboard so they never see login/register.
 */
export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getUser() && authService.getToken()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
