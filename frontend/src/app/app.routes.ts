import { Routes } from '@angular/router';
import { Leaderboard } from './pages/leaderboard/leaderboard';
import { Dashboard } from './pages/dashboard/dashboard';
import { AddActivity } from './pages/add-activity/add-activity';
import { Register } from './pages/register/register';
import { Login } from './pages/login/login';
import { Activities } from './pages/activities/activities';
import { Home } from './pages/home/home';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: Home
  },
  {
    path: 'home',
    component: Home
  },
  {
    path: 'leaderboard',
    component: Leaderboard
  },
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard]
  },
  {
    path: 'add-activity',
    component: AddActivity,
    canActivate: [authGuard]
  },
  {
    path: 'activities',
    component: Activities,
    canActivate: [authGuard]
  },
  {
    path: 'register',
    component: Register,
    canActivate: [guestGuard]
  },
  {
    path: 'login',
    component: Login,
    canActivate: [guestGuard]
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];