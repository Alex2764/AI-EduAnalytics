import assert from 'node:assert/strict';
import { buildTestLinkEntries, TEST_GROUP_LABELS } from '../src/utils/testLinks';

function run() {
  assert.equal(TEST_GROUP_LABELS[1], 'I група');
  assert.equal(TEST_GROUP_LABELS[2], 'II група');

  const single = buildTestLinkEntries(
    [{ group_number: 1, token: 'aaa-bbb-ccc' }],
    false
  );
  assert.equal(single.length, 1);
  assert.equal(single[0].label, undefined);
  assert.ok(single[0].url.includes('/take/aaa-bbb-ccc'));

  const twoGroups = buildTestLinkEntries(
    [
      { group_number: 2, token: 'token-g2' },
      { group_number: 1, token: 'token-g1' },
    ],
    true
  );
  assert.equal(twoGroups.length, 2);
  assert.equal(twoGroups[0].label, 'I група');
  assert.equal(twoGroups[0].url.includes('token-g1'), true);
  assert.equal(twoGroups[1].label, 'II група');
  assert.equal(twoGroups[1].url.includes('token-g2'), true);

  console.log('test-test-links: all passed');
}

run();
