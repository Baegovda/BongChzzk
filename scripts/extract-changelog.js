import fs from 'node:fs';

export function extractChangelog(markdown, version) {
  const lines = String(markdown).split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start < 0) {
    throw new Error(`CHANGELOG.md has no section for ${version}`);
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## [')) {
      end = index;
      break;
    }
  }
  return `${lines.slice(start, end).join('\n').trim()}\n`;
}

const invoked = process.argv[1] && process.argv[1].endsWith('extract-changelog.js');
if (invoked) {
  const version = process.argv[2];
  const file = process.argv[3] || 'CHANGELOG.md';
  if (!version) {
    console.error('usage: extract-changelog.js <version> [changelog]');
    process.exit(1);
  }
  process.stdout.write(extractChangelog(fs.readFileSync(file, 'utf8'), version));
}
