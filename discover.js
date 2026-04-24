// discover.js — run by GitHub Actions daily
// Searches URLScan.io for DSJ Exchange mirror domains
// and saves results to a GitHub Gist

const GIST_ID      = process.env.GIST_ID;      // set in GitHub Actions secrets
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // automatically provided by Actions

const QUERIES = [
  'page.domain:ddjea.com',
  'page.domain:dsjexchange*',
  'hash:748942c6',
  'filename:chart-loading-animation.gif',
  'page.title:"DSJ"',
];

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function searchURLScan() {
  console.log('Searching URLScan.io...');
  const found = new Set();

  for (const q of QUERIES) {
    try {
      const url = `https://urlscan.io/api/v1/search/?q=${encodeURIComponent(q)}&size=100`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) { console.log(`  [SKIP] ${q} → HTTP ${res.status}`); continue; }
      const data = await res.json();
      let count = 0;
      (data.results || []).forEach(r => {
        const domain = (r.page?.domain || '').trim();
        if (!domain || !domain.includes('.') || domain.includes(' ') || /[A-Z]/.test(domain)) return;
        if (!found.has(domain)) { found.add(domain); count++; }
      });
      console.log(`  [OK] "${q}" → ${count} new domains`);
      await sleep(2000);
    } catch(e) {
      console.log(`  [ERR] ${q}: ${e.message}`);
    }
  }

  return [...found].sort();
}

async function updateGist(domains) {
  console.log(`\nUpdating Gist with ${domains.length} domains...`);
  const content = domains.join('\n');

  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: { 'domains.txt': { content } }
    })
  });

  if (res.ok) {
    const data = await res.json();
    console.log(`Gist updated: ${data.html_url}`);
    console.log(`Raw URL: ${data.files['domains.txt'].raw_url}`);
  } else {
    const err = await res.text();
    console.error(`Failed to update Gist: ${res.status} ${err}`);
    process.exit(1);
  }
}

async function main() {
  if (!GIST_ID)      { console.error('Missing GIST_ID env var'); process.exit(1); }
  if (!GITHUB_TOKEN) { console.error('Missing GITHUB_TOKEN env var'); process.exit(1); }

  console.log('='.repeat(50));
  console.log('  DSJ Exchange — Domain Discovery');
  console.log('='.repeat(50));

  const domains = await searchURLScan();

  console.log(`\nFound ${domains.length} unique domains.`);
  domains.forEach(d => console.log('  ' + d));

  await updateGist(domains);
}

main().catch(e => { console.error(e); process.exit(1); });
