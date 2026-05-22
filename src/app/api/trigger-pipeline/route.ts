import { NextResponse } from 'next/server';

export async function POST() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'GITHUB_TOKEN non configuré' }, { status: 500 });
  }

  const resp = await fetch(
    'https://api.github.com/repos/albertduplantin/skidrow/actions/workflows/pipeline.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );

  if (resp.status === 204) {
    return NextResponse.json({ success: true });
  }

  const body = await resp.text();
  return NextResponse.json({ error: body }, { status: resp.status });
}
