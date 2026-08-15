import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LeaderboardService } from '../../services/leaderboard';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-leaderboard',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.css'
})
export class Leaderboard implements OnInit {

  users = signal<any[]>([]);
  isLoading = signal(true);
  errorMsg = signal('');
  searchQuery = '';
  currentUser: any = null;

  constructor(
    private leaderboardService: LeaderboardService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.fetchLeaderboard();
  }

  fetchLeaderboard() {
    this.leaderboardService.getLeaderboardTrends().subscribe({
      next: (data: any) => {
        console.log('Leaderboard data received:', data);
        this.users.set(data || []);
        this.isLoading.set(false);
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        console.error('Leaderboard error:', error);
        this.errorMsg.set('Unable to load leaderboard. Please try again.');
        this.isLoading.set(false);
      } 
    });
  }

  get top1(): any {
    return this.users().find(u => u.rank === 1) || null;
  }

  get top2(): any {
    return this.users().find(u => u.rank === 2) || null;
  }

  get top3(): any {
    return this.users().find(u => u.rank === 3) || null;
  }

  get myRank(): any {
    if (!this.currentUser) return null;
    const currentId = Number(this.currentUser.id || this.currentUser.user_id);
    const currentName = (this.currentUser.name || this.currentUser.username || '').toLowerCase().trim();
    return this.users().find(u => {
      const uId = Number(u.user_id || u.id);
      const uName = (u.name || '').toLowerCase().trim();
      return (currentId && uId === currentId) || (currentName && uName === currentName);
    }) || null;
  }

  isCurrentUser(user: any): boolean {
    if (!this.currentUser) return false;
    const currentId = Number(this.currentUser.id || this.currentUser.user_id);
    const currentName = (this.currentUser.name || this.currentUser.username || '').toLowerCase().trim();
    const uId = Number(user.user_id || user.id);
    const uName = (user.name || '').toLowerCase().trim();
    return (currentId && uId === currentId) || (currentName && uName === currentName);
  }

  get pointsToNextRank(): number {
    const my = this.myRank;
    if (!my || my.rank <= 1) return 0;
    const higherUser = this.users().find(u => u.rank === my.rank - 1);
    if (!higherUser) return 0;
    return Math.max(1, (higherUser.total_points || 0) - (my.total_points || 0) + 1);
  }

  get filteredUsers(): any[] {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) return this.users();
    return this.users().filter(u => u.name?.toLowerCase().includes(query));
  }

  getAthleteTier(points: number): { label: string; class: string } {
    if (points >= 1000) return { label: 'Diamond Elite', class: 'tier-diamond' };
    if (points >= 500) return { label: 'Platinum', class: 'tier-platinum' };
    if (points >= 250) return { label: 'Gold Warrior', class: 'tier-gold' };
    if (points >= 100) return { label: 'Silver Pro', class: 'tier-silver' };
    return { label: 'Bronze Scout', class: 'tier-bronze' };
  }

}