#!/usr/bin/env node
// Pack the contents of dist/ into a Yandex.Games-ready zip in the project root.
// Usage:
//   npm run build && npm run zip
import { execSync } from 'node:child_process';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = join(__filename, '..', '..');
const dist = join(root, 'dist');
const zipName = 'merge-pets-2048.zip';
const zipPath = join(root, zipName);

if (!existsSync(dist)) {
    console.error(`dist/ does not exist. Run \`npm run build\` first.`);
    process.exit(1);
}
if (!existsSync(join(dist, 'index.html'))) {
    console.error(`dist/index.html is missing. Build artifacts look broken.`);
    process.exit(1);
}

// Validate file naming conventions required by Yandex.Games:
//   * no spaces in file names
//   * no non-ASCII characters
const violations = [];
const walk = (dir) => {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const rel = relative(dist, full);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            walk(full);
            continue;
        }
        if (/\s/.test(rel)) violations.push(`space in: ${rel}`);
        if (/[^\x00-\x7F]/.test(rel)) violations.push(`non-ASCII in: ${rel}`);
    }
};
walk(dist);
if (violations.length) {
    console.error('File-name violations detected:');
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(2);
}

// Use system zip; fall back to a JS implementation only if needed.
try {
    execSync(`rm -f ${JSON.stringify(zipPath)}`);
    execSync(`cd ${JSON.stringify(dist)} && zip -r ${JSON.stringify(zipPath)} .`, { stdio: 'inherit' });
    console.log(`\nBuilt: ${zipName} (${(statSync(zipPath).size / 1024).toFixed(1)} KB)`);
} catch (err) {
    console.error('Failed to create zip via system `zip` command. Make sure `zip` is installed.');
    console.error(err);
    process.exit(3);
}
