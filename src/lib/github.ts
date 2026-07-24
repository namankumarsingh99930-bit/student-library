// ---- Configure your GitHub repo here ----
export const GITHUB_OWNER = 'namankumarsingh99930-bit';
export const GITHUB_REPO = 'student-library';
export const GITHUB_BRANCH = 'main';
export const BOOKS_FOLDER = 'books';
// ------------------------------------------

export interface BookEntry {
  subject: string;
  name: string;
  path: string;
  size: number;
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

  const books: BookEntry[] = tree
    .filter((item) => item.type === 'blob' && item.path.startsWith(`${BOOKS_FOLDER}/`) && item.path.toLowerCase().endsWith('.pdf'))
    .map((item) => {
      const parts = item.path.split('/');
      const subject = parts[1] || 'Uncategorized';
      const name = parts[parts.length - 1];
      return { subject, name, path: item.path, size: item.size || 0 };
    });

  const subjectSet = new Set<string>();
  // Also pick up empty subject folders (folders with only a .gitkeep placeholder)
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

const SPINE_COLORS = ['#0F6D5C', '#C08A2E', '#7C3AED', '#B91C63', '#1D4ED8', '#B45309', '#0891B2', '#BE123C'];

export function colorForSubject(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SPINE_COLORS[Math.abs(hash) % SPINE_COLORS.length];
}
