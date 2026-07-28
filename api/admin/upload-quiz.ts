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
const QUIZZES_FOLDER = 'quizzes';

function sanitize(input: string): string {
  return (input || '').replace(/[/\\]/g, '').trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
  }

  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const githubToken = process.env.GITHUB_TOKEN;

    if (!adminPassword || !githubToken) {
      return Response.json(
        { error: 'Server is not configured yet (missing ADMIN_PASSWORD or GITHUB_TOKEN).' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const { password, subject, quizTitle, questions } = await req.json();

    if (password !== adminPassword) {
      return Response.json({ error: 'Incorrect password.' }, { status: 401, headers: CORS_HEADERS });
    }

    const cleanSubject = sanitize(subject || '');
    const cleanTitle = sanitize(quizTitle || '');

    if (!cleanSubject || !cleanTitle) {
      return Response.json({ error: 'Subject and quiz title are required.' }, { status: 400, headers: CORS_HEADERS });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return Response.json({ error: 'Add at least one question.' }, { status: 400, headers: CORS_HEADERS });
    }

    for (const q of questions) {
      if (
        !q.question?.trim() ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        q.options.some((o: string) => !o?.trim()) ||
        typeof q.correctIndex !== 'number' ||
        q.correctIndex < 0 ||
        q.correctIndex > 3
      ) {
        return Response.json({ error: 'Every question needs 4 filled options and a marked correct answer.' }, { status: 400, headers: CORS_HEADERS });
      }
    }

    const slug = slugify(cleanTitle);
    const path = `${QUIZZES_FOLDER}/${cleanSubject}/${slug}.json`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodePath(path)}`;

    const existingRes = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
      headers: { Authorization: `token ${githubToken}` },
    });
    if (existingRes.ok) {
      return Response.json(
        { error: `A quiz named "${cleanTitle}" already exists in "${cleanSubject}". Choose a different title.` },
        { status: 409, headers: CORS_HEADERS }
      );
    }

    const quizData = { title: cleanTitle, subject: cleanSubject, questions };
    const content = JSON.stringify(quizData, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(content)));

    const commitRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${githubToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        message: `Add quiz: ${cleanSubject}/${cleanTitle}`,
        content: base64Content,
        branch: GITHUB_BRANCH,
      }),
    });

    if (!commitRes.ok) {
      const errData = await commitRes.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub commit failed (${commitRes.status}).`);
    }

    return Response.json({ ok: true, path, subject: cleanSubject, title: cleanTitle }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || 'Quiz publish failed.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
