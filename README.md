# base64url-nopad-encoder

Encodes and decodes byte sequences using the RFC 4648 base64url alphabet without `=` padding — the exact form used inside JWT payloads.

```js
import { encode, decode } from 'base64url-nopad-encoder';

const payload = JSON.stringify({ sub: 'abc', iat: 1700000000 });
const part = encode(payload);          // → string, no padding
const bytes = decode(part);            // → Uint8Array
const back = new TextDecoder().decode(bytes); // original JSON
```

`encode` accepts a `Uint8Array` or a `string` (interpreted as UTF-8 via `TextEncoder`) and returns a `string`. `decode` accepts a `string` and returns a `Uint8Array`.

## Why

JWT segments are separated by `.` and must be URL-safe, so RFC 7519 mandates the base64url alphabet. Padding `=` characters are omitted because they serve no purpose when the receiver already knows the byte length from the segment boundaries. This library does exactly that one thing and nothing else — it is not a JWT library, it does not validate JSON, it does not sign tokens.

One deliberate choice: `decode` accepts padded input (trailing `=` is silently ignored) but rejects characters outside the base64url alphabet. Standard base64 output that uses `+` or `/` will throw. This means you can feed it output from a padded base64url encoder, but not from a stock `btoa`.

The awkward edge: `decode` also rejects non-canonical inputs where the trailing bits of the final character are non-zero (e.g. `'AB'`). Some decoders silently accept these and drop the extra bits; this one does not, because such inputs are ambiguous and should never be produced by a correct encoder.

Zero third-party dependencies. ESM only. Run tests with `node --test test/core.test.js`.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

