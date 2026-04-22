const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const ingressPath = path.join(repoRoot, 'k8s', 'ingress.yml');
const ingress = fs.readFileSync(ingressPath, 'utf8');

const hostMatch = ingress.match(/^\s*-\s+host:\s+([^\s#]+)/m);
const domainMatch = ingress.match(/^\s*-\s+([^\s#]+duckdns\.org)\s*$/m);

if (!hostMatch || !domainMatch) {
  console.error('Could not determine public hostname from k8s/ingress.yml');
  process.exit(1);
}

const host = hostMatch[1];
const domain = domainMatch[1];

if (host !== domain) {
  console.error(`Ingress host (${host}) does not match managed-cert domain (${domain})`);
  process.exit(1);
}

const files = [
  ['services/api-gateway/kong.yml', `https://${host}`],
  ['services/auth-service/src/index.ts', `https://${host}`],
  ['services/economy-service/src/index.ts', `https://${host}`],
];

const failures = [];

for (const [relativePath, expected] of files) {
  const fullPath = path.join(repoRoot, relativePath);
  const content = fs.readFileSync(fullPath, 'utf8');
  if (!content.includes(expected)) {
    failures.push(`${relativePath} is missing ${expected}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Verified public hostname wiring for ${host}`);
