import test from 'node:test';
import assert from 'node:assert/strict';
import authReducer, { fetchCurrentUser } from './authSlice.js';

test('fetchCurrentUser pending sets auth status to loading', () => {
  const state = authReducer(
    {
      user: null,
      accessToken: null,
      status: 'idle',
      error: null,
    },
    fetchCurrentUser.pending()
  );

  assert.equal(state.status, 'loading');
  assert.equal(state.error, null);
});
