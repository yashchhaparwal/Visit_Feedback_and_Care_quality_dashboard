import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskAbusive } from '../src/lib/profanity.js';
import { classifySentiment } from '../src/lib/sentiment.js';
import { needsFollowUp, netPromoterScore, overallRating } from '../src/lib/quality.js';
import { toCsv } from '../src/lib/csv.js';

test('profanity: masks abusive words, including disguised ones', () => {
  for (const text of ['This is bullshit', 'what the f**k', 'Sh1t service', 'fuuuuck this', 'total chutiya', 'B!tch']) {
    const r = maskAbusive(text);
    assert.equal(r.flagged, true, text);
    assert.match(r.text, /•••/, text);
  }
});

test('profanity: leaves innocent text alone (no Scunthorpe problem)', () => {
  for (const text of [
    'Shift started 45 minutes late',
    'She helped him assist with the class exercises',
    'Passed the assessment, as expected',
    'Visited Scunthorpe and Essex',
    'Cocktail of medicines was given on time',
    'Great!!! Thank you',
  ]) {
    assert.deepEqual(maskAbusive(text), { text, flagged: false }, text);
  }
});

test('profanity: keeps punctuation and handles empty input', () => {
  assert.equal(maskAbusive('Bloody useless!').text, '•••••• useless!');
  assert.deepEqual(maskAbusive(null), { text: null, flagged: false });
  assert.deepEqual(maskAbusive(''), { text: '', flagged: false });
});

test('sentiment: tags English and Hinglish comments', () => {
  assert.equal(classifySentiment('Very caring and punctual, thank you!').label, 'positive');
  assert.equal(classifySentiment('Rude and always late').label, 'negative');
  assert.equal(classifySentiment('Didi bahut acchi hai').label, 'positive');
  assert.equal(classifySentiment('Bilkul bekar service').label, 'negative');
  assert.equal(classifySentiment('Visit was on Tuesday').label, 'neutral');
  assert.equal(classifySentiment('not good').label, 'negative');
  assert.deepEqual(classifySentiment('   '), { label: null, score: null });
});

test('quality: overall rating and follow-up rule', () => {
  const good = { punctuality: 5, quality_of_care: 4, hygiene: 5, behaviour: 4, recommend_score: 9 };
  assert.equal(overallRating(good), 4.5);
  assert.equal(needsFollowUp(good), false);
  assert.equal(needsFollowUp({ ...good, hygiene: 2 }), true, 'one category at 2 is enough');
  assert.equal(needsFollowUp({ ...good, recommend_score: 4 }), true, 'unlikely to recommend');
  assert.equal(needsFollowUp({ punctuality: 3, quality_of_care: 3, hygiene: 3, behaviour: 3, recommend_score: 7 }), false);
});

test('quality: NPS', () => {
  assert.equal(netPromoterScore([]), null);
  assert.equal(netPromoterScore([10, 9, 8, 7, 6]), 20); // 2 promoters, 1 detractor, 5 total
  assert.equal(netPromoterScore([0, 1, 2]), -100);
});

test('csv: escapes quotes, commas, newlines and formula injection', () => {
  const csv = toCsv(
    [{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }],
    [{ a: 'He said "hi", then left', b: '=HYPERLINK("x")' }, { a: 'line1\nline2', b: -3 }],
  );
  const lines = csv.replace('﻿', '').split('\r\n');
  assert.equal(lines[0], 'A,B');
  assert.equal(lines[1], `"He said ""hi"", then left","'=HYPERLINK(""x"")"`);
  assert.equal(lines[2], '"line1\nline2",-3');
});
