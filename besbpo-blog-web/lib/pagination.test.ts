import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate, totalPages, pageNumberParams } from './pagination.ts';

test('totalPages computes ceiling division', () => {
  assert.equal(totalPages(10, 4), 3);
  assert.equal(totalPages(12, 4), 3);
  assert.equal(totalPages(0, 4), 1); // never zero pages, even with no items
});

test('paginate slices the correct page', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const page1 = paginate(items, 4, 1);
  assert.deepEqual(page1.items, [1, 2, 3, 4]);
  assert.equal(page1.pageInfo.hasPrevious, false);
  assert.equal(page1.pageInfo.hasNext, true);

  const page3 = paginate(items, 4, 3);
  assert.deepEqual(page3.items, [9, 10]);
  assert.equal(page3.pageInfo.hasNext, false);
  assert.equal(page3.pageInfo.hasPrevious, true);
});

test('paginate clamps out-of-range page numbers instead of throwing', () => {
  const items = [1, 2, 3];
  const tooHigh = paginate(items, 2, 99);
  assert.equal(tooHigh.pageInfo.pageNumber, 2); // clamped to last valid page

  const tooLow = paginate(items, 2, 0);
  assert.equal(tooLow.pageInfo.pageNumber, 1);
});

test('pageNumberParams enumerates every page for static generation', () => {
  const params = pageNumberParams(10, 4);
  assert.deepEqual(params, [{ page: '1' }, { page: '2' }, { page: '3' }]);
});

test('paginate handles an empty item list without dividing by zero', () => {
  const result = paginate([], 5, 1);
  assert.deepEqual(result.items, []);
  assert.equal(result.pageInfo.totalPages, 1);
});
