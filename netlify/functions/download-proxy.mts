import type { Context } from '@netlify/functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  try {
    const reqUrl = new URL(req.url);
    const sourceUrl = reqUrl.searchParams.get('url');
    const filename = reqUrl.searchParams.get('filename') || 'book.pdf';

    if (!sourceUrl) {
      return Response.json({ error: 'Missing source url.' }, { status: 400, headers: CORS_HEADERS });
    }

    const upstream = await fetch(sourceUrl);

    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: 'Could not fetch the file.' }, { status: 502, headers: CORS_HEADERS });
    }

    const contentLength = upstream.headers.get('content-length');
    const headers: Record<string, string> = {
      ...CORS_HEADERS,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
    };
    if (contentLength) headers['Content-Length'] = contentLength;

    // Stream the file straight through — no buffering in memory
    return new Response(upstream.body, { headers });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || 'Download proxy failed.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

export const config = {
  path: '/api/download-proxy',
};
