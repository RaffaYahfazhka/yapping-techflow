import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);

const { MODEL_MANIFEST, getModelEntriesByCategory } = await import('../src/lib/data/modelManifest');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
};

const ROOT = resolve('.');

test('manifest contains all 11 required penthouse characters', () => {
  const characters = getModelEntriesByCategory('character');
  const expectedIds = [
    'raffa', 'khansaku', 'arga', 'vani', 'tara',
    'reno', 'kian', 'jajang', 'altair', 'kenzo', 'damian'
  ];
  assert.equal(characters.length, 11);
  for (const id of expectedIds) {
    const entry = MODEL_MANIFEST[id];
    assert.ok(entry, `Missing character entry: ${id}`);
    assert.equal(entry.category, 'character');
  }
});

test('manifest contains architecture and prop entries', () => {
  const arch = getModelEntriesByCategory('architecture');
  assert.ok(arch.length >= 3);

  const props = getModelEntriesByCategory('prop');
  assert.ok(props.length >= 7);
});

test('every manifest entry has non-empty fallbackAriaLabel and boundingBox', () => {
  for (const [id, entry] of Object.entries(MODEL_MANIFEST)) {
    assert.ok(entry.fallbackAriaLabel && entry.fallbackAriaLabel.length > 0, `Missing fallbackAriaLabel on ${id}`);
    assert.equal(entry.boundingBox.length, 3, `Invalid boundingBox on ${id}`);
    assert.ok(entry.boundingBox.every((v) => typeof v === 'number' && v > 0), `Non-positive boundingBox on ${id}`);
  }
});

test('every manifest asset exists locally as a valid GLB binary', () => {
  for (const [id, entry] of Object.entries(MODEL_MANIFEST)) {
    // entry.path starts with '/'
    const localPath = join(ROOT, 'public', entry.path);
    assert.ok(existsSync(localPath), `File does not exist: ${localPath} for ${id}`);

    const buffer = readFileSync(localPath);
    assert.ok(buffer.length >= 20, `File too small to be GLB: ${localPath}`);

    // Check 12-byte GLB header
    const magic = buffer.toString('ascii', 0, 4);
    assert.equal(magic, 'glTF', `Invalid GLB magic header for ${id}`);

    const version = buffer.readUInt32LE(4);
    assert.equal(version, 2, `GLB version must be 2 for ${id}`);

    const totalLength = buffer.readUInt32LE(8);
    assert.equal(totalLength, buffer.length, `GLB header length mismatch for ${id}`);

    // Chunk 0: JSON
    const jsonChunkLength = buffer.readUInt32LE(12);
    const jsonChunkType = buffer.toString('ascii', 16, 20);
    assert.equal(jsonChunkType, 'JSON', `Chunk 0 must be JSON for ${id}`);

    const jsonBytes = buffer.subarray(20, 20 + jsonChunkLength);
    const parsedGltf = JSON.parse(jsonBytes.toString('utf8'));
    assert.equal(parsedGltf.asset?.version, '2.0', `glTF asset.version must be 2.0 for ${id}`);
    assert.ok(Array.isArray(parsedGltf.nodes), `glTF nodes missing for ${id}`);
    assert.ok(Array.isArray(parsedGltf.meshes), `glTF meshes missing for ${id}`);

    // Chunk 1: BIN
    const binHeaderOffset = 20 + jsonChunkLength;
    if (binHeaderOffset < buffer.length) {
      const binChunkType = buffer.readUInt32LE(binHeaderOffset + 4);
      assert.equal(binChunkType, 0x004e4942, `Chunk 1 must be BIN for ${id}`);
    }
  }
});

console.log(`\nResults: ${passed} passed, 0 failed`);
