import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterLink,
  RouterOutlet,
  RouterLinkActive,
  Router,
  NavigationEnd
} from '@angular/router';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterLink,
    RouterOutlet,
    RouterLinkActive
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

  sidebarOpen = true;
  mobileMenuOpen = false;
  publicNavOpen = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Auto-close sidebar on mobile after navigation
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          this.sidebarOpen = false;
        }
        this.closeMobileMenu();
        this.closePublicNav();
      }
    });

    // Check window width on initial load
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      this.sidebarOpen = false;
    }
  }

  get currentUser() {
    return this.authService.getUser();
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }

  openSidebar() {
    this.sidebarOpen = true;
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }

  togglePublicNav() {
    this.publicNavOpen = !this.publicNavOpen;
  }

  closePublicNav() {
    this.publicNavOpen = false;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  @HostListener('window:resize')
  onResize() {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 1024 && this.sidebarOpen) {
        // on narrow screens close sidebar automatically if screen shrinks
      }
    }
  }

}