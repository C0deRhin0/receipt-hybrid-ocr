const assert = require('node:assert/strict');
const test = require('node:test');
const { ExtractionCache } = require('../src/services/extraction-cache');

test('extraction cache evicts the least recently used entry', () => {
  const cache = new ExtractionCache();
  const options = { ttlMs: 60_000, maxEntries: 2 };
  cache.set('first', { value: 1 }, options);
  cache.set('second', { value: 2 }, options);

  assert.deepEqual(cache.get('first'), { value: 1 });
  cache.set('third', { value: 3 }, options);

  assert.equal(cache.get('second'), null);
  assert.deepEqual(cache.get('first'), { value: 1 });
  assert.deepEqual(cache.get('third'), { value: 3 });
});

test('extraction cache expires entries and returns defensive copies', async () => {
  const cache = new ExtractionCache();
  const original = { structured: { fields: { merchant: { value: 'Example' } } } };
  cache.set('receipt', original, { ttlMs: 20, maxEntries: 1 });

  const cached = cache.get('receipt');
  cached.structured.fields.merchant.value = 'Changed';
  assert.equal(cache.get('receipt').structured.fields.merchant.value, 'Example');

  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(cache.get('receipt'), null);
});
