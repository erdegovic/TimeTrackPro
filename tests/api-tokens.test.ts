import assert from "node:assert/strict";
import test from "node:test";
import {
  API_TOKEN_PREFIX,
  apiTokenPrefix,
  extractBearerToken,
  generateApiToken,
  hashApiToken,
  looksLikeApiToken,
} from "../shared/api-tokens";

test("generated tokens are tk_ + 40 url-safe characters and unique", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const token = generateApiToken();
    assert.match(token, /^tk_[A-Za-z0-9]{40}$/);
    assert.equal(seen.has(token), false);
    seen.add(token);
  }
});

test("hash is deterministic sha256 hex and never equals the token", () => {
  const token = generateApiToken();
  assert.equal(hashApiToken(token), hashApiToken(token));
  assert.match(hashApiToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(hashApiToken(token), token);
  assert.notEqual(hashApiToken(token), hashApiToken(token + "x"));
});

test("stored prefix reveals only the first eight random characters", () => {
  const token = generateApiToken();
  const prefix = apiTokenPrefix(token);
  assert.equal(prefix.length, API_TOKEN_PREFIX.length + 8);
  assert.ok(token.startsWith(prefix));
});

test("token shape validation", () => {
  assert.equal(looksLikeApiToken(generateApiToken()), true);
  assert.equal(looksLikeApiToken("tk_short"), false);
  assert.equal(looksLikeApiToken(`tk_${"a".repeat(41)}`), false);
  assert.equal(looksLikeApiToken(`tk_${"a".repeat(39)}!`), false);
  assert.equal(looksLikeApiToken("Bearer tk_abc"), false);
  assert.equal(looksLikeApiToken(undefined), false);
});

test("bearer header extraction", () => {
  assert.equal(extractBearerToken("Bearer tk_abc123"), "tk_abc123");
  assert.equal(extractBearerToken("bearer   tk_abc123 "), "tk_abc123");
  assert.equal(extractBearerToken("Basic dXNlcjpwYXNz"), null);
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(extractBearerToken(""), null);
});
