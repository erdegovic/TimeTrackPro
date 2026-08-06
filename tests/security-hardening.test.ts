import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isTrustedStateChangingRequest } from "../server/security";
import { validateProfileImageDataUrl } from "../server/utils/profile-image";

const tickdOrigins = new Set(["https://tickd.me", "https://www.tickd.me"]);

test("unsafe API requests accept Tickd origins and reject cross-site origins", () => {
  assert.equal(isTrustedStateChangingRequest({
    method: "POST",
    origin: "https://tickd.me",
  }, tickdOrigins), true);

  assert.equal(isTrustedStateChangingRequest({
    method: "POST",
    origin: "https://attacker.example",
  }, tickdOrigins), false);

  assert.equal(isTrustedStateChangingRequest({
    method: "POST",
    fetchSite: "cross-site",
    origin: "https://tickd.me",
  }, tickdOrigins), false);
});

test("same-origin browser requests can use fetch metadata when Origin is absent", () => {
  assert.equal(isTrustedStateChangingRequest({
    method: "DELETE",
    fetchSite: "same-origin",
  }, tickdOrigins), true);

  assert.equal(isTrustedStateChangingRequest({ method: "POST" }, tickdOrigins), false);
  assert.equal(isTrustedStateChangingRequest({ method: "GET" }, tickdOrigins), true);
});

test("profile image validation checks type, size, and file signature", () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const validPng = `data:image/png;base64,${pngHeader.toString("base64")}`;

  assert.equal(validateProfileImageDataUrl(validPng).valid, true);
  assert.equal(validateProfileImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=").valid, false);
  assert.equal(validateProfileImageDataUrl("data:image/png;base64,bm90LXJlYWxseS1hLXBuZw==").valid, false);
});

test("active authentication code contains no fixed credential bypass", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const authRoutes = readFileSync(new URL("../server/routes/auth.ts", import.meta.url), "utf8");
  const activeAuth = `${routes}\n${authRoutes}`;

  assert.doesNotMatch(activeAuth, /password123/i);
  assert.doesNotMatch(activeAuth, /test@example\.com/i);
  assert.doesNotMatch(activeAuth, /master.?password/i);
});
