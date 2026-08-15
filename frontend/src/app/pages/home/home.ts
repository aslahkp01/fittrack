import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

interface Quote {
  id: number;
  text: string;
  author: string;
  category: string;
  tag: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  selectedCategory: string = 'All';

  quotes: Quote[] = [
    {
      id: 1,
      text: "The only bad workout is the one that didn't happen.",
      author: "Fitness Creed",
      category: "Consistency",
      tag: "🔥 Daily Habit"
    },
    {
      id: 2,
      text: "Discipline is choosing between what you want now and what you want most.",
      author: "Abraham Lincoln",
      category: "Discipline",
      tag: "⚡ Focus"
    },
    {
      id: 3,
      text: "The body achieves what the mind believes.",
      author: "Napoleon Hill",
      category: "Mindset",
      tag: "🧠 Mental Power"
    },
    {
      id: 4,
      text: "Success isn't always about greatness. It's about consistency. Consistent hard work gains success.",
      author: "Dwayne Johnson",
      category: "Perseverance",
      tag: "🏆 Hard Work"
    },
    {
      id: 5,
      text: "Strength does not come from physical capacity. It comes from an indomitable will.",
      author: "Mahatma Gandhi",
      category: "Strength",
      tag: "💪 Willpower"
    },
    {
      id: 6,
      text: "Push yourself because no one else is going to do it for you.",
      author: "Athlete Proverb",
      category: "Motivation",
      tag: "🚀 Drive"
    },
    {
      id: 7,
      text: "It never gets easier, you just get better.",
      author: "Greg LeMond",
      category: "Progress",
      tag: "📈 Growth"
    },
    {
      id: 8,
      text: "Small daily improvements over time lead to stunning results.",
      author: "Robin Sharma",
      category: "Consistency",
      tag: "⏳ Long Term"
    }
  ];

  categories: string[] = ['All', 'Consistency', 'Discipline', 'Mindset', 'Strength', 'Perseverance'];

  currentQuoteIndex: number = 0;

  constructor(private authService: AuthService) {}

  get currentUser() {
    return this.authService.getUser();
  }

  get filteredQuotes(): Quote[] {
    if (this.selectedCategory === 'All') {
      return this.quotes;
    }
    return this.quotes.filter(q => q.category === this.selectedCategory);
  }

  selectCategory(category: string) {
    this.selectedCategory = category;
  }

  nextQuote() {
    this.currentQuoteIndex = (this.currentQuoteIndex + 1) % this.quotes.length;
  }

  prevQuote() {
    this.currentQuoteIndex = (this.currentQuoteIndex - 1 + this.quotes.length) % this.quotes.length;
  }
}
