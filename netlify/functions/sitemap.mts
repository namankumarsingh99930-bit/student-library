import type { Context } from '@netlify/functions';

const GITHUB_OWNER = 'namankumarsingh99930-bit';
const GITHUB_REPO = 'student-library';
const GITHUB_BRANCH = 'main';
const BOOKS_FOLDER = 'books';
const SITE_URL = 'https://student-library99930.netlify.app'; // update this if your domain changes

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function humanizeTitle(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async (req: Request, context: Context) => {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`
    );
    const data = await res.json();
    const tree: any[] = data.tree || [];

    const books = tree.filter(
      (item) => item.type === 'blob' && item.path.startsWith(`${BOOKS_FOLDER}/`) && item.path.toLowerCase().endsWith('.pdf')
    );

    const subjects = new Set<string>();
    const urls: string[] = [`${SITE_URL}/`];

    for (const item of books) {
      const parts = item.path.split('/');
      const subject = parts[1];
      const filename = parts[parts.length - 1];
      if (!subject) continue;
      subjects.add(subject);
      const bookSlug = slugify(humanizeTitle(filename));
      urls.push(`${SITE_URL}/subject/${encodeURIComponent(subject)}/${encodeURIComponent(bookSlug)}`);
    }

    for (const subject of subjects) {
      urls.push(`${SITE_URL}/subject/${encodeURIComponent(subject)}`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`).join('\n')}
</urlset>`;

    return new Response(xml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  } catch (err: any) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }
};

export const config = {
  path: '/sitemap.xml',
};
