export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const GITHUB_OWNER = 'namankumarsingh99930-bit';
const GITHUB_REPO = 'student-library';
const GITHUB_BRANCH = 'main';
const LEADERBOARD_FOLDER = 'leaderboards';
const MAX_ENTRIES = 10;

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function leaderboardPathFor(quizPath: string): string {
  // quizPath looks like "quizzes/Math/algebra-basics.json"
  const inner = quizPath.replace(/^quizzes\//, '').replace(/\.json$/i, '');
  return `${LEADERBOARD_FOLDER}/${inner}.json`;
}

async function getExisting(apiUrl: string, token: string) {
  const res = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) return { entries: [], sha: undefined as string | undefined };
  const data = await res.json();
  try {
    const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
    const entries = JSON.parse(decoded);
    return { entries: Array.isArray(entries) ? entries : [], sha: data.sha };
  } catch {
    return { entries: [], sha: data.sha };
  }
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return Response.json({ error: 'Server is not configured yet (missing GITHUB_TOKEN).' }, { status: 500, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);

  if (req.method === 'GET') {
    const quizPath = url.searchParams.get('quizPath');
    if (!quizPath) return Response.json({ error: 'Missing quizPath.' }, { status: 400, headers: CORS_HEADERS });

    const path = leaderboardPathFor(quizPath);
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodePath(path)}`;
    const { entries } = await getExisting(apiUrl, githubToken);
    return Response.json({ entries }, { headers: CORS_HEADERS });
  }

  if (req.method === 'POST') {
    try {
      const { quizPath, name, score, total } = await req.json();

      if (!quizPath || typeof score !== 'number' || typeof total !== 'number') {
        return Response.json({ error: 'Invalid submission.' }, { status: 400, headers: CORS_HEADERS });
      }

      const cleanName = (name || 'Anonymous').toString().replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 20) || 'Anonymous';
      const safeScore = Math.max(0, Math.min(Math.round(score), 1000));
      const safeTotal = Math.max(1, Math.min(Math.round(total), 1000));

      const path = leaderboardPathFor(quizPath);
      const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodePath(path)}`;
      const { entries, sha } = await getExisting(apiUrl, githubToken);

      entries.push({ name: cleanName, score: safeScore, total: safeTotal, date: new Date().toISOString() });
      entries.sort((a: any, b: any) => b.score / b.total - a.score / a.total);
      const trimmed = entries.slice(0, MAX_ENTRIES);

      const content = JSON.stringify(trimmed, null, 2);
      const base64Content = btoa(unescape(encodeURIComponent(content)));

      const commitRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: `token ${githubToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          message: `Update leaderboard: ${path}`,
          content: base64Content,
          branch: GITHUB_BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });

      if (!commitRes.ok) {
        const errData = await commitRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Could not save score.');
      }

      return Response.json({ ok: true, entries: trimmed }, { headers: CORS_HEADERS });
    } catch (err: any) {
      return Response.json({ error: err?.message || 'Could not save score.' }, { status: 500, headers: CORS_HEADERS });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
}
