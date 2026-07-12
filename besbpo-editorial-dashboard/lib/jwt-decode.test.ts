import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSessionUser } from './jwt-decode.ts';

function fakeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  // The signature segment is never verified by decodeSessionUser (it's
  // explicitly display-only, not a security check) — its exact value is
  // irrelevant to what's being tested here.
  return `${header}.${body}.fake-signature`;
}

test('decodeSessionUser extracts sub, roles, email, and displayName from a valid token', () => {
  const token = fakeToken({
    sub: 'u1',
    roles: ['division_editor'],
    email: 'a@example.com',
    displayName: 'Test User',
  });
  const result = decodeSessionUser(token);
  assert.deepEqual(result, {
    id: 'u1',
    email: 'a@example.com',
    displayName: 'Test User',
    roles: ['division_editor'],
  });
});

test('decodeSessionUser defaults email and displayName to empty strings when absent', () => {
  const token = fakeToken({ sub: 'u1', roles: [] });
  const result = decodeSessionUser(token);
  assert.equal(result?.email, '');
  assert.equal(result?.displayName, '');
});

test('decodeSessionUser defaults roles to an empty array when absent', () => {
  const token = fakeToken({ sub: 'u1' });
  const result = decodeSessionUser(token);
  assert.deepEqual(result?.roles, []);
});

test('decodeSessionUser returns null when sub is missing', () => {
  const token = fakeToken({ roles: ['division_editor'] });
  assert.equal(decodeSessionUser(token), null);
});

test('decodeSessionUser returns null when sub is not a string', () => {
  const token = fakeToken({ sub: 12345 });
  assert.equal(decodeSessionUser(token), null);
});

test('decodeSessionUser returns null (not throw) for a malformed token with too few segments', () => {
  assert.equal(decodeSessionUser('not-a-real-token'), null);
});

test('decodeSessionUser returns null (not throw) for a token whose payload is not valid base64', () => {
  assert.equal(decodeSessionUser('header.!!!not-valid-base64!!!.signature'), null);
});

test('decodeSessionUser returns null (not throw) for a token whose payload is valid base64 but not JSON', () => {
  const notJson = Buffer.from('this is not json').toString('base64url');
  assert.equal(decodeSessionUser(`header.${notJson}.signature`), null);
});

test('decodeSessionUser ignores a non-array roles value rather than crashing', () => {
  const token = fakeToken({ sub: 'u1', roles: 'not-an-array' });
  const result = decodeSessionUser(token);
  assert.deepEqual(result?.roles, []);
});
