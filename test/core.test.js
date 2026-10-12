import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode } from '../src/core.js';

test('empty input round-trips', () => {
  assert.equal(encode(''), '');
  assert.equal(encode(new Uint8Array(0)), '');
  assert.deepEqual(decode(''), new Uint8Array(0));
});

test('one-byte input round-trips', () => {
  const bytes = new Uint8Array([0x00]);
  assert.equal(encode(bytes), 'AA');
  assert.deepEqual(decode('AA'), bytes);
});

test('two-byte input round-trips', () => {
  const bytes = new Uint8Array([0x01, 0x02]);
  assert.equal(encode(bytes), 'AQI');
  assert.deepEqual(decode('AQI'), bytes);
});

test('three-byte input round-trips', () => {
  const bytes = new Uint8Array([0x01, 0x02, 0x03]);
  assert.equal(encode(bytes), 'AQID');
  assert.deepEqual(decode('AQID'), bytes);
});

test('string input is encoded as UTF-8', () => {
  assert.equal(encode('hello'), 'aGVsbG8');
  assert.deepEqual(decode('aGVsbG8'), new TextEncoder().encode('hello'));
});

test('uses base64url alphabet, not standard base64', () => {
  // Bytes 251, 255, 250 would produce +/ and = in standard base64.
  const bytes = new Uint8Array([0xfb, 0xff, 0xfa]);
  const encoded = encode(bytes);
  assert.equal(encoded, '-__6');
  assert.deepEqual(decode('-__6'), bytes);
});

test('round-trip over a range of lengths', () => {
  const data = new Uint8Array(100);
  for (let i = 0; i < data.length; i++) {
    data[i] = (i * 37 + 11) & 0xff;
  }
  for (let len = 0; len <= data.length; len++) {
    const slice = data.subarray(0, len);
    assert.deepEqual(decode(encode(slice)), slice);
  }
});

test('decode tolerates trailing padding', () => {
  const bytes = new Uint8Array([0x01, 0x02]);
  assert.deepEqual(decode('AQI'), bytes);
  assert.deepEqual(decode('AQI='), bytes);
  assert.deepEqual(decode('AQI=='), bytes);
});

test('decode rejects standard-base64 characters', () => {
  assert.throws(() => decode('A+AC'), /invalid base64url character/);
  assert.throws(() => decode('A/AC'), /invalid base64url character/);
});

test('decode rejects invalid length', () => {
  // A single trailing character cannot map to any whole byte.
  assert.throws(() => decode('A'), /invalid base64url length/);
});

test('decode rejects non-canonical trailing bits (two-char group)', () => {
  // 'AA' decodes to 0x00. 'AB' has nonzero trailing bits.
  assert.throws(() => decode('AB'), /non-canonical/);
});

test('decode rejects non-canonical trailing bits (three-char group)', () => {
  // 'AAB' decodes to 0x00 0x00. 'AAC' has nonzero trailing bits.
  assert.throws(() => decode('AAC'), /non-canonical/);
});

test('encode rejects unsupported input types', () => {
  assert.throws(() => encode(42), TypeError);
  assert.throws(() => encode(null), TypeError);
});

test('decode rejects unsupported input types', () => {
  assert.throws(() => decode(42), TypeError);
  assert.throws(() => decode(null), TypeError);
});
