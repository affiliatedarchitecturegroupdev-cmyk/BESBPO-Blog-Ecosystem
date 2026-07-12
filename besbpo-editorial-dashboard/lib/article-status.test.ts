import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedTransitions,
  statusLabel,
  unapprovedFields,
  blockedByApprovalGate,
} from './article-status.ts';

test('allowedTransitions returns the correct next states for draft', () => {
  assert.deepEqual(allowedTransitions('draft'), ['division_review']);
});

test('allowedTransitions returns an empty array for a terminal state', () => {
  assert.deepEqual(allowedTransitions('archived'), []);
});

test('allowedTransitions returns multiple options where the graph branches', () => {
  assert.deepEqual(allowedTransitions('corporate_review'), ['scheduled', 'published', 'rejected']);
});

test('statusLabel formats a single-word status', () => {
  assert.equal(statusLabel('draft'), 'Draft');
});

test('statusLabel formats a multi-word status with each word capitalised', () => {
  assert.equal(statusLabel('division_review'), 'Division Review');
});

test('unapprovedFields returns nothing when every field is human-authored', () => {
  const result = unapprovedFields({
    excerptSource: 'human',
    divisionTagsSource: 'human',
    seoMetaSource: 'human',
  });
  assert.deepEqual(result, []);
});

test('unapprovedFields lists every field still ai_proposed', () => {
  const result = unapprovedFields({
    excerptSource: 'ai_proposed',
    divisionTagsSource: 'human_approved',
    seoMetaSource: 'ai_proposed',
  });
  assert.deepEqual(result, ['excerpt', 'seoMeta']);
});

test('unapprovedFields treats human_approved as satisfying the gate', () => {
  const result = unapprovedFields({
    excerptSource: 'human_approved',
    divisionTagsSource: 'human_approved',
    seoMetaSource: 'human_approved',
  });
  assert.deepEqual(result, []);
});

test('blockedByApprovalGate returns nothing for a transition the gate does not apply to', () => {
  const result = blockedByApprovalGate(
    { excerptSource: 'ai_proposed', divisionTagsSource: 'ai_proposed', seoMetaSource: 'ai_proposed' },
    'division_review',
  );
  assert.deepEqual(result, []);
});

test('blockedByApprovalGate returns the unapproved fields for a gated transition', () => {
  const result = blockedByApprovalGate(
    { excerptSource: 'ai_proposed', divisionTagsSource: 'human', seoMetaSource: 'human' },
    'published',
  );
  assert.deepEqual(result, ['excerpt']);
});

test('blockedByApprovalGate returns nothing when everything is approved, even for a gated transition', () => {
  const result = blockedByApprovalGate(
    { excerptSource: 'human_approved', divisionTagsSource: 'human', seoMetaSource: 'human_approved' },
    'scheduled',
  );
  assert.deepEqual(result, []);
});
