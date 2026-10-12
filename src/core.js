/**
 * Base64url NoPad Encoder — encode and decode using the base64url alphabet
 * without the `=` padding characters defined in RFC 4648 §5.
 *
 * The base64url alphabet (RFC 4648 §5, Table 2) replaces `+` with `-`
 * and `/` with `_`, making the output safe unencoded inside URL path,
 * query, and fragment components. Padding `=` is omitted entirely,
 * which is the form used inside JWT payloads (RFC 7519 §3).
 */

/**
 * Base64url alphabet, index → character. We build this once at module
 * load instead of writing a lookup string literal by hand so the
 * mapping is self-documenting and impossible to typo.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Reverse lookup: character → 6-bit value. Using a Uint8Array (filled
 * with 0xff for invalid bytes) lets `decode` reject stray characters
 * with a single array read rather than calling `indexOf` on the
 * alphabet string for every byte.
 */
const REVERSE = (() => {
  const table = new Uint8Array(256).fill(0xff);
  for (let i = 0; i < ALPHABET.length; i++) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

/**
 * Convert a byte sequence to a base64url string with no padding.
 *
 * @param {Uint8Array|string} bytes - Bytes to encode. A string is
 *   interpreted as UTF-8, matching `TextEncoder` semantics. This is
 *   the same convention `btoa` uses and keeps the common case (JWT
 *   payloads are UTF-8 JSON) ergonomic.
 * @returns {string} Base64url string with no `=` padding.
 */
export function encode(bytes) {
  if (typeof bytes === 'string') {
    bytes = new TextEncoder().encode(bytes);
  }
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('encode expects a Uint8Array or a string');
  }
  if (bytes.length === 0) {
    return '';
  }
  const out = [];
  let i = 0;
  // Process every complete group of three bytes → four characters.
  for (; i + 3 <= bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out.push(
      ALPHABET[b0 >> 2],
      ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)],
      ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)],
      ALPHABET[b2 & 0x3f],
    );
  }
  // Handle the trailing one or two bytes. Padding is omitted, so the
  // receiver relies on the length to recover the original byte count.
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const b0 = bytes[i];
    out.push(ALPHABET[b0 >> 2], ALPHABET[(b0 & 0x03) << 4]);
  } else if (remaining === 2) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    out.push(
      ALPHABET[b0 >> 2],
      ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)],
      ALPHABET[(b1 & 0x0f) << 2],
    );
  }
  return out.join('');
}

/**
 * Decode a base64url string (with or without padding) back into bytes.
 *
 * Accepting padded input costs nothing — the `=` characters are
 * skipped — and makes interop with libraries that insist on padding
 * painless. Decoding still rejects characters outside the base64url
 * alphabet, so it will not silently accept standard base64.
 *
 * @param {string} input - Base64url string. Trailing `=` padding is
 *   tolerated but ignored; no other non-alphabet characters are.
 * @returns {Uint8Array} The decoded bytes.
 */
export function decode(input) {
  if (typeof input !== 'string') {
    throw new TypeError('decode expects a string');
  }
  if (input.length === 0) {
    return new Uint8Array(0);
  }
  // Drop padding before counting; it carries no bits.
  const trimmed = input.replace(/=+$/, '');
  // The byte count is fully determined by the unpadded length: groups
  // of four characters yield three bytes, and the final partial group
  // yields one byte for two characters or two bytes for three.
  const dataLen = Math.floor(trimmed.length / 4) * 3;
  const remainder = trimmed.length % 4;
  const out = new Uint8Array(dataLen + (remainder === 2 ? 1 : remainder === 3 ? 2 : 0));
  let pos = 0;
  let i = 0;
  while (i + 4 <= trimmed.length) {
    const c0 = REVERSE[trimmed.charCodeAt(i)];
    const c1 = REVERSE[trimmed.charCodeAt(i + 1)];
    const c2 = REVERSE[trimmed.charCodeAt(i + 2)];
    const c3 = REVERSE[trimmed.charCodeAt(i + 3)];
    if ((c0 | c1 | c2 | c3) === 0xff) {
      throw new Error('invalid base64url character');
    }
    out[pos++] = (c0 << 2) | (c1 >> 4);
    out[pos++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
    out[pos++] = ((c2 & 0x03) << 6) | c3;
    i += 4;
  }
  // Trailing partial group.
  if (remainder === 2) {
    const c0 = REVERSE[trimmed.charCodeAt(i)];
    const c1 = REVERSE[trimmed.charCodeAt(i + 1)];
    if (c0 === 0xff || c1 === 0xff) {
      throw new Error('invalid base64url character');
    }
    // The low four bits of c1 must be zero; if not, the input is
    // ambiguous (extra bits cannot be represented in one byte).
    if ((c1 & 0x0f) !== 0) {
      throw new Error('non-canonical base64url: trailing bits not zero');
    }
    out[pos++] = (c0 << 2) | (c1 >> 4);
  } else if (remainder === 3) {
    const c0 = REVERSE[trimmed.charCodeAt(i)];
    const c1 = REVERSE[trimmed.charCodeAt(i + 1)];
    const c2 = REVERSE[trimmed.charCodeAt(i + 2)];
    if (c0 === 0xff || c1 === 0xff || c2 === 0xff) {
      throw new Error('invalid base64url character');
    }
    if ((c2 & 0x03) !== 0) {
      throw new Error('non-canonical base64url: trailing bits not zero');
    }
    out[pos++] = (c0 << 2) | (c1 >> 4);
    out[pos++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
  } else if (remainder === 1) {
    // A single trailing character cannot map to any whole byte.
    throw new Error('invalid base64url length');
  }
  return out;
}
