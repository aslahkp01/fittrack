import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'fittrack_theme';
  
  // Theme state signal (defaulting to dark for modern fitness aesthetics)
  currentTheme = signal<Theme>('dark');

  constructor() {
    this.initializeTheme();
  }

  private initializeTheme() {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(this.THEME_KEY) as Theme | null;
      if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light')) {
        this.setTheme(savedTheme);
      } else {
        // Default to dark theme for premier gamified fitness look
        this.setTheme('dark');
      }
    }
  }

  setTheme(theme: Theme) {
    this.currentTheme.set(theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark-theme');
        document.documentElement.classList.remove('light-theme');
      } else {
        document.documentElement.classList.add('light-theme');
        document.documentElement.classList.remove('dark-theme');
      }
      localStorage.setItem(this.THEME_KEY, theme);
    }
  }

  toggleTheme() {
    const nextTheme: Theme = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  get isDarkMode(): boolean {
    return this.currentTheme() === 'dark';
  }
}
