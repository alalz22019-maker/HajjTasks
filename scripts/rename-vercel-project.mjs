const isVercelProd = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production';
if (!isVercelProd) process.exit(0);

const token = process.env.VERCEL_OIDC_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = 'team_OWkPpZgRATzDJ6Aa2eCJdcTr';

if (!token || !projectId) {
  console.log('[PlayIn] Vercel rename skipped: project OIDC context unavailable.');
  process.exit(0);
}

try {
  const response = await fetch(`https://api.vercel.com/v9/projects/${projectId}?teamId=${teamId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'playin' }),
  });

  if (response.ok) {
    console.log('[PlayIn] Vercel project renamed to playin.');
  } else {
    const body = await response.text();
    console.log(`[PlayIn] Vercel rename not applied (${response.status}): ${body.slice(0, 300)}`);
  }
} catch (error) {
  console.log(`[PlayIn] Vercel rename attempt failed safely: ${error?.message || error}`);
}
