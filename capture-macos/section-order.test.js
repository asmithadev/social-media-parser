const { test } = require('node:test');
const assert = require('node:assert/strict');
const orderedPlan = require('./section-order');

test('capture plans follow documented section order without changing their input', () => {
  const sections = [{ id: 1, sectionName: 'friends' }, { id: 2, sectionName: 'account_info' },
    { id: 3, sectionName: 'messages' }, { id: 4, sectionName: 'posts' }];
  const plan = [1, 3, 4, 2].map(sectionId => ({ sectionId }));
  assert.deepEqual(orderedPlan(plan, sections).map(step => step.sectionId), [2, 4, 3, 1]);
  assert.deepEqual(plan.map(step => step.sectionId), [1, 3, 4, 2]);
});
