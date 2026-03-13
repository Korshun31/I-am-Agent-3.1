#!/usr/bin/env node
/**
 * Prepare project for TestFlight upload.
 * 1. Clean node_modules and reinstall (ensures calendar patches apply)
 * 2. Clear Metro/Expo caches
 * 3. Verify calendar patches
 * 4. Ready for: npm run build:ios
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
}

function rmRF(dir) {
  const rel = path.relative(root, dir);
  if (fs.existsSync(dir)) {
    try {
      execSync(`rm -rf "${dir}"`, { cwd: root });
      console.log(`Removed: ${rel}`);
    } catch (e) {
      console.error(`Failed to remove ${rel}:`, e.message);
      throw e;
    }
  }
}

console.log('═══════════════════════════════════════════════════════');
console.log('  Preparing for TestFlight upload');
console.log('═══════════════════════════════════════════════════════');

console.log('\n[1/4] Cleaning node_modules...');
rmRF(path.join(root, 'node_modules'));

console.log('\n[2/4] Clearing caches...');
rmRF(path.join(root, '.expo'));

console.log('\n[3/4] Fresh install (postinstall → calendar patches)...');
run('npm install');

console.log('\n[4/4] Verifying calendar patches...');
run('node scripts/verify-build.js');

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Ready for TestFlight.');
console.log('  Run: npm run build:ios');
console.log('═══════════════════════════════════════════════════════\n');
