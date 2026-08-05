import assert from "node:assert/strict";
import test from "node:test";
import { isPublicRoute } from "../client/src/lib/public-routes";

test("legal documents remain available without authentication", () => {
  assert.equal(isPublicRoute("/terms"), true);
  assert.equal(isPublicRoute("/privacy"), true);
  assert.equal(isPublicRoute("/refund-policy"), true);
  assert.equal(isPublicRoute("/verify-email-change"), true);
});

test("protected application pages are not treated as public", () => {
  assert.equal(isPublicRoute("/dashboard"), false);
  assert.equal(isPublicRoute("/clients"), false);
});
