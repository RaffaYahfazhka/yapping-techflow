import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);

const { validateDialogueOutput, createAiSpeechBubble } = await import('../src/lib/engine/employeeDialogue');
const { createEmployeeSim, employeeStateTick } = await import('../src/lib/engine/socialEngine');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
};

// 1. Validation Tests
test('validateDialogueOutput: accepts natural conversational text', () => {
  const res = validateDialogueOutput('Wah kopinya enak banget, lanjut ngoding lagi.');
  assert.equal(res.valid, true);
  assert.equal(res.text, 'Wah kopinya enak banget, lanjut ngoding lagi.');
});

test('validateDialogueOutput: strips outer quotes and employee name prefix', () => {
  const res1 = validateDialogueOutput('"Keren banget fiturnya!"', 'tara');
  assert.equal(res1.valid, true);
  assert.equal(res1.text, 'Keren banget fiturnya!');

  const res2 = validateDialogueOutput('Tara: Istirahat bentar ah sambil liat sunset', 'Tara');
  assert.equal(res2.valid, true);
  assert.equal(res2.text, 'Istirahat bentar ah sambil liat sunset');
});

test('validateDialogueOutput: rejects empty or whitespace-only text', () => {
  assert.equal(validateDialogueOutput('').valid, false);
  assert.equal(validateDialogueOutput('   ').valid, false);
  assert.equal(validateDialogueOutput(null).valid, false);
  assert.equal(validateDialogueOutput(undefined).valid, false);
});

test('validateDialogueOutput: rejects text exceeding 140 characters', () => {
  const longText = 'A'.repeat(141);
  const res = validateDialogueOutput(longText);
  assert.equal(res.valid, false);
  assert.equal(res.reason, 'exceeds-max-length');
});

test('validateDialogueOutput: rejects code blocks, HTML tags, or braces', () => {
  assert.equal(validateDialogueOutput('```js console.log("hack"); ```').valid, false);
  assert.equal(validateDialogueOutput('<script>alert(1)</script>').valid, false);
  assert.equal(validateDialogueOutput('{ key: "value" }').valid, false);
});

test('validateDialogueOutput: rejects error traces or exception dumps', () => {
  assert.equal(validateDialogueOutput('Internal server error occurred at line 42').valid, false);
  assert.equal(validateDialogueOutput('Uncaught TypeError: null is not an object').valid, false);
});

// 2. Speech Bubble Creation & Invariant Tests
test('createAiSpeechBubble: returns null when dialogue is null (NO static quote fallback)', () => {
  const bubble = createAiSpeechBubble('tara', '☕', null, 5000);
  assert.equal(bubble, null);
});

test('createAiSpeechBubble: returns null when dialogue is invalid', () => {
  const bubble = createAiSpeechBubble('tara', '☕', '```malformed```', 5000);
  assert.equal(bubble, null);
});

test('createAiSpeechBubble: creates valid bubble on verified AI text', () => {
  const bubble = createAiSpeechBubble('tara', '☕', 'Kopi pantry hari ini mantap!', 5000);
  assert.ok(bubble);
  assert.equal(bubble.agentId, 'tara');
  assert.equal(bubble.emoji, '☕');
  assert.equal(bubble.text, 'Kopi pantry hari ini mantap!');
  assert.equal(bubble.expiresAt, 5000);
});

// 3. Runtime Decoupling Test: AI dialogue never controls movement or state
test('socialEngine: employee positions, states, and deadlines remain deterministic', () => {
  const sim1 = createEmployeeSim({ x: 0, z: 0 });
  const sim2 = createEmployeeSim({ x: 0, z: 0 });

  // Tick both with same seed and time
  const ticked1 = employeeStateTick(sim1, 1000, 42);
  const ticked2 = employeeStateTick(sim2, 1000, 42);

  // States, stateUntil, and positions must match identically regardless of bubbles
  assert.deepEqual(ticked1.states, ticked2.states);
  assert.deepEqual(ticked1.stateUntil, ticked2.stateUntil);
  assert.deepEqual(ticked1.positions, ticked2.positions);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
