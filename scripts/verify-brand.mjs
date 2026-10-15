import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);

const { AGENTS } = await import('../src/lib/data/agents');
const { PAPER_KEY, LEGACY_KEY, PAPER_DATABASE } = await import('../src/lib/storage/paperLedger');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
};

const ROOT = resolve('.');

test('brand logo and mark assets exist and contain Yapping Techflow branding', () => {
  const logoPath = resolve(ROOT, 'public/brand/logo.svg');
  const markPath = resolve(ROOT, 'public/brand/logo-mark.svg');
  const favPath = resolve(ROOT, 'public/favicon.svg');

  assert.ok(existsSync(logoPath), 'public/brand/logo.svg must exist');
  assert.ok(existsSync(markPath), 'public/brand/logo-mark.svg must exist');
  assert.ok(existsSync(favPath), 'public/favicon.svg must exist');

  const logoContent = readFileSync(logoPath, 'utf8');
  assert.ok(logoContent.includes('YAPPING'), 'logo must include YAPPING');
  assert.ok(logoContent.includes('TECHFLOW'), 'logo must include TECHFLOW');
});

test('layout.tsx contains Yapping Techflow in metadata title', () => {
  const layoutPath = resolve(ROOT, 'src/app/layout.tsx');
  const content = readFileSync(layoutPath, 'utf8');
  assert.ok(content.includes('Yapping Techflow'), 'metadata title must contain Yapping Techflow');
});

test('PhotoModeController watermark contains Yapping Techflow', () => {
  const photoPath = resolve(ROOT, 'src/components/executive/PhotoModeController.tsx');
  const content = readFileSync(photoPath, 'utf8');
  assert.ok(content.includes('Yapping Techflow'), 'photo watermark must contain Yapping Techflow');
});

test('compatibility invariant: employee IDs EMP-001 through EMP-009 are preserved', () => {
  const empIds = AGENTS.map((a) => a.employeeId);
  const expected = [
    'EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005',
    'EMP-006', 'EMP-007', 'EMP-008', 'EMP-009'
  ];
  for (const exp of expected) {
    assert.ok(empIds.includes(exp), `Expected employee number ${exp} preserved in roster`);
  }
});

test('compatibility invariant: storage keys are byte-for-byte preserved', () => {
  assert.equal(PAPER_KEY, 'paper-ledger-v2');
  assert.equal(LEGACY_KEY, 'kantor-raffa.paper-bots.v1');
  assert.equal(PAPER_DATABASE, 'kantor-raffa');
});

console.log(`\nResults: ${passed} passed, 0 failed`);
