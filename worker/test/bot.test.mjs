import test from "node:test";
import assert from "node:assert/strict";
import { webJoinUrl } from "../bot.mjs";

test("converts a Zoom invite to the web app without losing its passcode", () => {
  assert.equal(
    webJoinUrl("https://example.zoom.us/j/123456789?pwd=a%2Bb"),
    "https://app.zoom.us/wc/123456789/join?fromPWA=1&pwd=a%2Bb",
  );
});
