import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Dernier run du pipeline
  const runsResp = await fetch(
    'https://api.github.com/repos/albertduplantin/skidrow/actions/workflows/pipeline.yml/runs?per_page=1',
    { headers, next: { revalidate: 0 } }
  );
  if (!runsResp.ok) {
    return NextResponse.json({ error: 'GitHub API inaccessible' }, { status: 502 });
  }
  const runsData = await runsResp.json();
  const run = runsData.workflow_runs?.[0];
  if (!run) return NextResponse.json({ run: null, steps: [] });

  // Étapes du job
  const jobsResp = await fetch(
    `https://api.github.com/repos/albertduplantin/skidrow/actions/runs/${run.id}/jobs`,
    { headers, next: { revalidate: 0 } }
  );
  const jobsData = jobsResp.ok ? await jobsResp.json() : { jobs: [] };
  const job = jobsData.jobs?.[0];

  const steps = (job?.steps ?? []).map((s: {
    name: string; status: string; conclusion: string | null;
    started_at: string | null; completed_at: string | null;
  }) => ({
    name: s.name,
    status: s.status,
    conclusion: s.conclusion,
    started_at: s.started_at,
    completed_at: s.completed_at,
  }));

  return NextResponse.json({
    run: {
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      created_at: run.created_at,
      updated_at: run.updated_at,
      html_url: run.html_url,
    },
    steps,
  });
}
