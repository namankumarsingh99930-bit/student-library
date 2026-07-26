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
const BOOKS_FOLDER = 'books';

function sanitizeSegment(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
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

    const { password, subject, filename, base64Content } = await req.json();

    if (password !== adminPassword) {
      return Response.json({ error: 'Incorrect password.' }, { status: 401, headers: CORS_HEADERS });
    }

    const cleanSubject = sanitizeSegment(subject || '');
    const cleanFilename = sanitizeSegment((filename || '').replace(/\.pdf$/i, '')) + '.pdf';

    if (!cleanSubject) {
      return Response.json({ error: 'Subject name is required.' }, { status: 400, headers: CORS_HEADERS });
    }
    if (!base64Content) {
      return Response.json({ error: 'No file content received.' }, { status: 400, headers: CORS_HEADERS });
    }

    const path = `${BOOKS_FOLDER}/${cleanSubject}/${cleanFilename}`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

    const existingRes = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
      headers: { Authorization: `token ${githubToken}` },
    });

    if (existingRes.ok) {
      return Response.json(
        { error: `A book named "${cleanFilename}" already exists in "${cleanSubject}". Rename the file or delete the old one first.` },
        { status: 409, headers: CORS_HEADERS }
      );
    }

    const commitRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${githubToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        message: `Add book: ${cleanSubject}/${cleanFilename}`,
        content: base64Content,
        branch: GITHUB_BRANCH,
      }),
    });

    if (!commitRes.ok) {
      const errData = await commitRes.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub commit failed (${commitRes.status}). File may be too large — use manual GitHub upload for files over ~4MB.`);
    }

    return Response.json(
      { ok: true, path, subject: cleanSubject, filename: cleanFilename },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return Response.json(
      { error: err?.message || 'Upload failed.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
