import type { Context } from '@netlify/functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const GITHUB_OWNER = 'namankumarsingh99930-bit';
const GITHUB_REPO = 'student-library';
const GITHUB_BRANCH = 'main';
const BOOKS_FOLDER = 'books';

export default async (req: Request, context: Context) => {
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

    const { password, path } = await req.json();

    if (password !== adminPassword) {
      return Response.json({ error: 'Incorrect password.' }, { status: 401, headers: CORS_HEADERS });
    }

    if (!path || typeof path !== 'string' || !path.startsWith(`${BOOKS_FOLDER}/`)) {
      return Response.json({ error: 'Invalid file path.' }, { status: 400, headers: CORS_HEADERS });
    }

    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

    const existingRes = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
      headers: { Authorization: `token ${githubToken}` },
    });

    if (!existingRes.ok) {
      return Response.json({ error: 'File not found.' }, { status: 404, headers: CORS_HEADERS });
    }

    const existingData = await existingRes.json();

    const deleteRes = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `token ${githubToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        message: `Delete book: ${path}`,
        sha: existingData.sha,
        branch: GITHUB_BRANCH,
      }),
    });

    if (!deleteRes.ok) {
      const errData = await deleteRes.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub delete failed (${deleteRes.status}).`);
    }

    return Response.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || 'Delete failed.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

export const config = {
  path: '/api/admin/delete-book',
};
