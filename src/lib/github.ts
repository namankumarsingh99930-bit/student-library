// ---- Configure your GitHub repo here ----
export const GITHUB_OWNER = 'namankumarsingh99930-bit';
export const GITHUB_REPO = 'student-library';
export const GITHUB_BRANCH = 'main';
export const BOOKS_FOLDER = 'books';
export const COVERS_FOLDER = 'covers';
// ------------------------------------------

export interface BookEntry {
  subject: string;
  name: string;
  path: string;
  size: number;
  coverPath?: string;
}

export interface LibraryData {
  subjects: string[];
  books: BookEntry[];
}

/**
 * Fetches the entire repo file tree in ONE API call and extracts every PDF
 * under the books/ folder, grouped by subject (the first-level folder name).
 */
export async function fetchLibrary(): Promise<LibraryData> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`
  );

  if (!res.ok) {
    throw new Error(
      res.status === 404 ? 'Repository or branch not found.' : `GitHub API error (${res.status})`
    );
  }

  const data = await res.json();
  const tree: any[] = data.tree || [];

  // Build a lookup of covers: "<subject>::<basename>" -> cover file path
  const coverMap = new Map<string, string>();
  tree
    .filter(
      (item) =>
        item.type === 'blob' &&
        item.path.startsWith(`${COVERS_FOLDER}/`) &&
        /\.(jpg|jpeg|png|webp|gif)$/i.test(item.path)
    )
    .forEach((item) => {
      const parts = item.path.split('/');
      const subject = parts[1];
      const filename = parts[parts.length - 1];
      const baseName = filename.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '').toLowerCase();
      if (subject && baseName) coverMap.set(`${subject}::${baseName}`, item.path);
    });

  const books: BookEntry[] = tree
    .filter((item) => item.type === 'blob' && item.path.startsWith(`${BOOKS_FOLDER}/`) && item.path.toLowerCase().endsWith('.pdf'))
    .map((item) => {
      const parts = item.path.split('/');
      const subject = parts[1] || 'Uncategorized';
      const name = parts[parts.length - 1];
      const baseName = name.replace(/\.pdf$/i, '').toLowerCase();
      const coverPath = coverMap.get(`${subject}::${baseName}`);
      return { subject, name, path: item.path, size: item.size || 0, coverPath };
    });

  const subjectSet = new Set<string>();
  tree
    .filter((item) => item.path.startsWith(`${BOOKS_FOLDER}/`))
    .forEach((item) => {
      const parts = item.path.split('/');
      if (parts.length >= 2 && parts[1]) subjectSet.add(parts[1]);
    });

  return {
    subjects: Array.from(subjectSet).sort(),
    books,
  };
}

export function rawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`;
}

/**
 * Finds the most recently added book PDF paths by scanning recent commits
 * that touched the books/ folder. Returns file paths, newest first.
 */
export async function fetchRecentBookPaths(limit = 5): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?path=${BOOKS_FOLDER}&per_page=15`
    );
    if (!res.ok) return [];
    const commits = await res.json();
    if (!Array.isArray(commits)) return [];

    const found: string[] = [];
    const seen = new Set<string>();

    for (const commit of commits) {
      if (found.length >= limit) break;
      try {
        const detailRes = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits/${commit.sha}`
        );
        if (!detailRes.ok) continue;
        const detail = await detailRes.json();
        const files = detail.files || [];
        for (const f of files) {
          if (
            f.status === 'added' &&
            f.filename?.startsWith(`${BOOKS_FOLDER}/`) &&
            f.filename.toLowerCase().endsWith('.pdf') &&
            !seen.has(f.filename)
          ) {
            seen.add(f.filename);
            found.push(f.filename);
            if (found.length >= limit) break;
          }
        }
      } catch {
        continue;
      }
    }

    return found;
  } catch {
    return [];
  }
}

export function humanizeTitle(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatSize(bytes: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SPINE_COLORS = ['#0F6D5C', '#C08A2E', '#7C3AED', '#B91C63', '#1D4ED8', '#B45309', '#0891B2', '#BE123C'];

export function colorForSubject(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SPINE_COLORS[Math.abs(hash) % SPINE_COLORS.length];
}

const QUIZZES_FOLDER = 'quizzes';

export interface QuizEntry {
  subject: string;
  title: string;
  path: string;
}

export interface QuizIndex {
  subjects: string[];
  quizzes: QuizEntry[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface QuizContent {
  title: string;
  subject: string;
  questions: QuizQuestion[];
}

export async function fetchQuizIndex(): Promise<QuizIndex> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`
  );
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Repository or branch not found.' : `GitHub API error (${res.status})`);
  }
  const data = await res.json();
  const tree: any[] = data.tree || [];

  const quizzes: QuizEntry[] = tree
    .filter((item) => item.type === 'blob' && item.path.startsWith(`${QUIZZES_FOLDER}/`) && item.path.toLowerCase().endsWith('.json'))
    .map((item) => {
      const parts = item.path.split('/');
      const subject = parts[1] || 'Uncategorized';
      const filename = parts[parts.length - 1];
      const title = filename.replace(/\.json$/i, '').replace(/-/g, ' ');
      return { subject, title, path: item.path };
    });

  const subjects = Array.from(new Set(quizzes.map((q) => q.subject))).sort();
  return { subjects, quizzes };
}

export async function fetchQuizContent(path: string): Promise<QuizContent> {
  const res = await fetch(rawUrl(path));
  if (!res.ok) throw new Error('Could not load this quiz.');
  return res.json();
}
