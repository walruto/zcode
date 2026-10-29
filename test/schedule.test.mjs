import test from "node:test";
import assert from "node:assert/strict";
import { scheduleWorker, validate } from "../api/schedule.mjs";

test("rejects non-Zoom links", () => {
  assert.throws(
    () => validate({ meetingUrl: "https://example.com/j/123", botName: "Bot", joinTimes: [future()] }),
    /valid Zoom/,
  );
});

test("requires more than ten minutes notice", () => {
  assert.throws(
    () => validate({ meetingUrl: "https://zoom.us/j/123", botName: "Bot", joinTimes: [new Date().toISOString()] }),
    /10 minutes/,
  );
});

test("accepts multiple unique meeting times", () => {
  const first = future();
  const second = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const result = validate({
    meetingUrl: "https://zoom.us/j/123",
    botName: "Bot",
    joinTimes: [first, first, second],
  });
  assert.deepEqual(result.joinTimes, [first, second]);
});

test("sends schedules to our worker", async () => {
  let sent;
  const joinTimes = [future()];
  const result = await scheduleWorker({
    meetingUrl: "https://example.zoom.us/j/123?pwd=456",
    botName: "Attendance Bot",
    joinTimes,
    workerUrl: "https://worker.example.com/",
    workerToken: "secret",
    fetchImpl: async (_url, options) => {
      sent = JSON.parse(options.body);
      return new Response(JSON.stringify({ ids: ["bot-123"], count: 1 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  assert.equal(result.count, 1);
  assert.deepEqual(sent.joinTimes, joinTimes);
});

function future() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}
