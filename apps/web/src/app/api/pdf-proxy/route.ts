import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export async function GET(req: NextRequest) {
  const submissionId = req.nextUrl.searchParams.get('submissionId');
  if (!submissionId) {
    return NextResponse.json({ error: 'submissionId requerido' }, { status: 400 });
  }

  const authHeader = req.headers.get('authorization') || '';
  // Token may also come from cookie if you set one; otherwise require header
  if (!authHeader) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // 1. Get presigned URL from backend
  const urlRes = await fetch(`${API_URL}/submissions/${submissionId}/download-url`, {
    headers: { Authorization: authHeader },
  }).catch(() => null);

  if (!urlRes || !urlRes.ok) {
    return NextResponse.json({ error: 'No se pudo obtener el archivo' }, { status: 404 });
  }

  const urlData = await urlRes.json();
  const presignedUrl: string = urlData?.data?.url;
  if (!presignedUrl) {
    return NextResponse.json({ error: 'URL no disponible' }, { status: 404 });
  }

  // 2. Stream the file from MinIO to the browser
  const fileRes = await fetch(presignedUrl).catch(() => null);
  if (!fileRes || !fileRes.ok) {
    return NextResponse.json({ error: 'No se pudo descargar el archivo' }, { status: 502 });
  }

  const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
  const buffer = await fileRes.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
