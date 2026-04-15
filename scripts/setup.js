#!/usr/bin/env node
// Cross-platform first-time setup: copies .env.example -> .env for every service.
// Safe to re-run — skips services that already have a .env.
// Usage: npm run setup

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SERVICES = [
  'services/auth-service',
  'services/territory-service',
  'services/vote-service',
  'services/economy-service',
  'services/profile-service',
];

let copied = 0;
let skipped = 0;

for (const service of SERVICES) {
  const example = path.join(ROOT, service, '.env.example');
  const target  = path.join(ROOT, service, '.env');

  if (!fs.existsSync(example)) {
    console.warn(`  WARN  no .env.example found in ${service}`);
    continue;
  }

  if (fs.existsSync(target)) {
    console.log(`  skip  ${service}/.env already exists`);
    skipped++;
  } else {
    fs.copyFileSync(example, target);
    console.log(`  copy  ${service}/.env.example -> .env`);
    copied++;
  }
}

console.log(`\nSetup done. ${copied} copied, ${skipped} already existed.`);
if (copied > 0) {
  console.log('\nNext steps:');
  console.log('  1. docker-compose up postgres-auth postgres-territory postgres-vote postgres-economy postgres-profile redis rabbitmq minio -d');
  console.log('  2. npm run dev');
}
