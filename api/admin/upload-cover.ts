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
const COVERS_FOLDER = 'covers';

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

    const { password, subject, bookFilename, ext, base64Content } = await req.json();

    if (password !== adminPassword) {
      return Response.json({ error: 'Incorrect password.' }, { status: 401, headers: CORS_HEADERS });
    }

    const cleanSubject = sanitizeSegment(subject || '');
    const cleanBaseName = sanitizeSegment((bookFilename || '').replace(/\.pdf$/i, ''));
    const cleanExt = (ext || 'jpg').replace(/[^a-zA-Z]/g, '').toLowerCase();

    if (!cleanSubject || !cleanBaseName) {
      return Response.json({ error: 'Subject and book are required.' }, { status: 400, headers: CORS_HEADERS });
    }
    if (!base64Content) {
      return Response.json({ error: 'No image content received.' }, { status: 400, headers: CORS_HEADERS });
    }

    const path = `${COVERS_FOLDER}/${cleanSubject}/${cleanBaseName}.${cleanExt}`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

    // Check if a cover already exists for this book — if so, update it (overwrite) instead of failing
    let existingSha: string | undefined;
    const existingRes = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
      headers: { Authorization: `token ${githubToken}` },
    });
    if (existingRes.ok) {
      const existingData = await existingRes.json();
      existingSha = existingData.sha;
    }

    const commitRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${githubToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        message: `${existingSha ? 'Update' : 'Add'} cover: ${cleanSubject}/${cleanBaseName}`,
        content: base64Content,
        branch: GITHUB_BRANCH,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    if (!commitRes.ok) {
      const errData = await commitRes.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub commit failed (${commitRes.status}). Try a smaller image.`);
    }

    return Response.json({ ok: true, path }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || 'Cover upload failed.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
