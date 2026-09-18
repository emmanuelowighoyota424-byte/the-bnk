import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoots = [path.join(root, 'src'), path.join(root, 'scripts')];
const allowedFiles = new Set([path.normalize(path.join(root, 'src/lib/banking.ts'))]);
const patterns = [
  /\bbalance\s*\+=/,
  /\bbalance\s*-=/,
  /\bavailableBalance\s*\+=/,
  /\bavailableBalance\s*-=/,
  /\bbalance\s*:\s*\{\s*(?:increment|decrement)\s*:/,
  /\bavailableBalance\s*:\s*\{\s*(?:increment|decrement)\s*:/,
];
function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  const out=[];
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const full=path.join(dir,entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}
test('all operational balance mutations stay inside authoritative posting workflow', () => {
  const violations=[];
  for (const file of sourceRoots.flatMap(filesUnder)) {
    if (allowedFiles.has(path.normalize(file))) continue;
    const text=fs.readFileSync(file,'utf8');
    for (const pattern of patterns) if (pattern.test(text)) violations.push(path.relative(root,file));
  }
  assert.deepEqual([...new Set(violations)], [], `Direct balance mutation found outside src/lib/banking.ts: ${[...new Set(violations)].join(', ')}`);
});
