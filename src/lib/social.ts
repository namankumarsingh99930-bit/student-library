// ---------------- Leaderboard ----------------
export interface LeaderboardEntry {
  name: string;
  score: number;
  total: number;
  date: string;
}

export async function fetchLeaderboard(quizPath: string): Promise<LeaderboardEntry[]> {
  const res = await fetch(`/api/leaderboard?quizPath=${encodeURIComponent(quizPath)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.entries || [];
}

export async function submitScore(quizPath: string, name: string, score: number, total: number): Promise<LeaderboardEntry[]> {
  const res = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizPath, name, score, total }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Could not save score.');
  return data.entries || [];
}

// ---------------- Ratings ----------------
export interface RatingCounts {
  up: number;
  down: number;
}

export async function fetchRating(bookPath: string): Promise<RatingCounts> {
  const res = await fetch(`/api/rating?bookPath=${encodeURIComponent(bookPath)}`);
  if (!res.ok) return { up: 0, down: 0 };
  return res.json();
}

export async function submitRating(bookPath: string, vote: 'up' | 'down'): Promise<RatingCounts> {
  const res = await fetch('/api/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookPath, vote }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Could not save rating.');
  return data;
}

export function hasRatedLocally(bookPath: string): boolean {
  try {
    const voted = JSON.parse(localStorage.getItem('studyshelf_voted') || '[]');
    return voted.includes(bookPath);
  } catch {
    return false;
  }
}

export function markRatedLocally(bookPath: string) {
  try {
    const voted = JSON.parse(localStorage.getItem('studyshelf_voted') || '[]');
    if (!voted.includes(bookPath)) voted.push(bookPath);
    localStorage.setItem('studyshelf_voted', JSON.stringify(voted));
  } catch {
    // ignore
  }
}

// ---------------- Bookmarks (fully local, no backend) ----------------
const BOOKMARKS_KEY = 'studyshelf_bookmarks';

export function getBookmarks(): string[] {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function isBookmarked(bookPath: string): boolean {
  return getBookmarks().includes(bookPath);
}

export function toggleBookmark(bookPath: string): string[] {
  const current = getBookmarks();
  const next = current.includes(bookPath)
    ? current.filter((p) => p !== bookPath)
    : [...current, bookPath];
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
  return next;
}
