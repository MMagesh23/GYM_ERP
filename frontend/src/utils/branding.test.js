import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrandPalette } from './branding.js';

test('buildBrandPalette returns a full palette rooted at the selected brand color', () => {
  const palette = buildBrandPalette('#ff6600');

  assert.equal(palette['500'], '#ff6600');
  assert.equal(palette['600'], '#e65c00');
  assert.equal(palette['50'], '#fff4eb');
  assert.equal(palette['900'], '#662200');
});
