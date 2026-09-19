import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, getDisplayUrl } from '../utils/url-normalizer.js';

test('Google Docs normalization across tabs/sections', () => {
  const url1 = 'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit';
  const url2 = 'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#heading=h.gjdgxs';
  const url3 = 'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?tab=t.0#heading=h.123';
  const url4 = 'https://docs.google.com/document/u/0/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view';

  const r1 = normalizeUrl(url1, 'smart');
  const r2 = normalizeUrl(url2, 'smart');
  const r3 = normalizeUrl(url3, 'smart');
  const r4 = normalizeUrl(url4, 'smart');

  const expected = 'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
  assert.equal(r1.canonicalUrl, expected);
  assert.equal(r2.canonicalUrl, expected);
  assert.equal(r3.canonicalUrl, expected);
  assert.equal(r4.canonicalUrl, expected);

  // Sub details are preserved
  assert.match(r2.subDetail, /Heading: h\.gjdgxs/);
  assert.match(r3.subDetail, /Heading: h\.123/);
  assert.match(r3.subDetail, /Tab: t\.0/);
});

test('Google Sheets normalization across tabs (#gid)', () => {
  const sheet1 = 'https://docs.google.com/spreadsheets/d/1qpyC0Xh8x23Bup85tx0BQPouv423079Stv0881XdkWQ/edit#gid=0';
  const sheet2 = 'https://docs.google.com/spreadsheets/d/1qpyC0Xh8x23Bup85tx0BQPouv423079Stv0881XdkWQ/edit#gid=1534012019';
  const sheet3 = 'https://docs.google.com/spreadsheets/u/1/d/1qpyC0Xh8x23Bup85tx0BQPouv423079Stv0881XdkWQ/edit?usp=sharing#gid=1534012019&range=B5';

  const r1 = normalizeUrl(sheet1, 'smart');
  const r2 = normalizeUrl(sheet2, 'smart');
  const r3 = normalizeUrl(sheet3, 'smart');

  const expected = 'https://docs.google.com/spreadsheets/d/1qpyC0Xh8x23Bup85tx0BQPouv423079Stv0881XdkWQ';
  assert.equal(r1.canonicalUrl, expected);
  assert.equal(r2.canonicalUrl, expected);
  assert.equal(r3.canonicalUrl, expected);

  assert.match(r1.subDetail, /Sheet gid: 0/);
  assert.match(r2.subDetail, /Sheet gid: 1534012019/);
  assert.match(r3.subDetail, /Sheet gid: 1534012019/);
  assert.match(r3.subDetail, /Range: B5/);
});

test('Google Slides normalization', () => {
  const slide1 = 'https://docs.google.com/presentation/d/1yZabc123/edit#slide=id.p';
  const slide2 = 'https://docs.google.com/presentation/d/1yZabc123/edit#slide=id.g12345';

  const r1 = normalizeUrl(slide1, 'smart');
  const r2 = normalizeUrl(slide2, 'smart');

  assert.equal(r1.canonicalUrl, 'https://docs.google.com/presentation/d/1yZabc123');
  assert.equal(r2.canonicalUrl, 'https://docs.google.com/presentation/d/1yZabc123');
  assert.equal(r1.subDetail, 'Slide: id.p');
  assert.equal(r2.subDetail, 'Slide: id.g12345');
});

test('Tracking parameter stripping', () => {
  const url1 = 'https://example.com/article?id=42&utm_source=twitter&utm_medium=social';
  const url2 = 'https://example.com/article?fbclid=IwAR123&id=42';
  const url3 = 'https://example.com/article?id=42';

  const r1 = normalizeUrl(url1, 'smart');
  const r2 = normalizeUrl(url2, 'smart');
  const r3 = normalizeUrl(url3, 'smart');

  assert.equal(r1.canonicalUrl, 'https://example.com/article?id=42');
  assert.equal(r2.canonicalUrl, 'https://example.com/article?id=42');
  assert.equal(r3.canonicalUrl, 'https://example.com/article?id=42');
});

test('Fragment / Hash stripping on standard websites', () => {
  const url1 = 'https://en.wikipedia.org/wiki/Chrome';
  const url2 = 'https://en.wikipedia.org/wiki/Chrome#History';
  const url3 = 'https://en.wikipedia.org/wiki/Chrome#Features';

  const r1 = normalizeUrl(url1, 'smart');
  const r2 = normalizeUrl(url2, 'smart');
  const r3 = normalizeUrl(url3, 'smart');

  assert.equal(r1.canonicalUrl, 'https://en.wikipedia.org/wiki/Chrome');
  assert.equal(r2.canonicalUrl, 'https://en.wikipedia.org/wiki/Chrome');
  assert.equal(r3.canonicalUrl, 'https://en.wikipedia.org/wiki/Chrome');
  assert.equal(r2.subDetail, 'History');
  assert.equal(r3.subDetail, 'Features');
});

test('Exact mode behaves strictly', () => {
  const url1 = 'https://docs.google.com/document/d/123/edit#heading=h.1';
  const url2 = 'https://docs.google.com/document/d/123/edit#heading=h.2';

  const r1 = normalizeUrl(url1, 'exact');
  const r2 = normalizeUrl(url2, 'exact');

  assert.notEqual(r1.canonicalUrl, r2.canonicalUrl);
  assert.equal(r1.canonicalUrl, url1);
  assert.equal(r2.canonicalUrl, url2);
});

test('GitHub pull request normalization', () => {
  const pr1 = 'https://github.com/facebook/react/pull/12345';
  const pr2 = 'https://github.com/facebook/react/pull/12345/files';
  const pr3 = 'https://github.com/facebook/react/pull/12345#issuecomment-9876';

  const r1 = normalizeUrl(pr1, 'smart');
  const r2 = normalizeUrl(pr2, 'smart');
  const r3 = normalizeUrl(pr3, 'smart');

  assert.equal(r1.canonicalUrl, 'https://github.com/facebook/react/pull/12345');
  assert.equal(r2.canonicalUrl, 'https://github.com/facebook/react/pull/12345');
  assert.equal(r3.canonicalUrl, 'https://github.com/facebook/react/pull/12345');
});

test('YouTube video normalization', () => {
  const yt1 = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const yt2 = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123';
  const yt3 = 'https://youtu.be/dQw4w9WgXcQ?t=42';

  const r1 = normalizeUrl(yt1, 'smart');
  const r2 = normalizeUrl(yt2, 'smart');
  const r3 = normalizeUrl(yt3, 'smart');

  assert.equal(r1.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(r2.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(r3.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('getDisplayUrl helper', () => {
  assert.equal(getDisplayUrl('https://docs.google.com/document/d/123'), 'docs.google.com/document/d/123');
  assert.equal(getDisplayUrl('https://github.com/react/pull/1'), 'github.com/react/pull/1');
});
