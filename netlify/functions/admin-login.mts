import type { Context } from '@netlify/functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
  }

  try {
    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return Response.json(
        { error: 'Server is not configured yet (missing ADMIN_PASSWORD).' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    if (password === adminPassword) {
      return Response.json({ ok: true }, { headers: CORS_HEADERS });
    }

    return Response.json({ error: 'Incorrect password.' }, { status: 401, headers: CORS_HEADERS });
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400, headers: CORS_HEADERS });
  }
};

export const config = {
  path: '/api/admin/login',
};
