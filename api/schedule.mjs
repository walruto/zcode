const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Forbidden." }, 403);
    if (!process.env.BOT_WORKER_URL || !process.env.BOT_WORKER_TOKEN) {
      return json({ error: "The Zoom bot worker is not connected yet." }, 500);
    }

    try {
      const body = await request.json();
      const input = validate(body);
      const result = await scheduleWorker({
        ...input,
        workerUrl: process.env.BOT_WORKER_URL,
        workerToken: process.env.BOT_WORKER_TOKEN,
      });
      return json(result, 201);
    } catch (error) {
      const status = error.status || 400;
      return json({ error: error.message || "Could not schedule the bot." }, status);
    }
  },
};

export function validate(body) {
  if (!body || typeof body !== "object") throw new Error("Invalid request.");
  const meetingUrl = String(body.meetingUrl || "").trim();
  const parsed = new URL(meetingUrl);
  if (parsed.protocol !== "https:" || !(parsed.hostname === "zoom.us" || parsed.hostname.endsWith(".zoom.us"))) {
    throw new Error("Enter a valid Zoom meeting link.");
  }

  const botName = String(body.botName || "").trim();
  if (!botName || botName.length > 100) throw new Error("Bot name must be 1–100 characters.");

  if (!Array.isArray(body.joinTimes) || !body.joinTimes.length || body.joinTimes.length > 30) {
    throw new Error("Schedule between 1 and 30 meeting times.");
  }
  const joinTimes = [...new Set(body.joinTimes.map((value) => {
    const joinAt = new Date(value);
    if (Number.isNaN(joinAt.getTime())) throw new Error("Enter a valid date and time.");
    if (joinAt.getTime() < Date.now() + 10 * 60 * 1000) {
      throw new Error("Schedule every bot more than 10 minutes ahead.");
    }
    return joinAt.toISOString();
  }))];
  return { meetingUrl, botName, joinTimes };
}

export async function scheduleWorker({ meetingUrl, botName, joinTimes, workerUrl, workerToken, fetchImpl = fetch }) {
  const response = await fetchImpl(`${workerUrl.replace(/\/$/, "")}/schedule`, {
    method: "POST",
    headers: { Authorization: `Bearer ${workerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ meetingUrl, botName, joinTimes }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "The Zoom bot worker rejected the schedule.");
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }
  return body;
}
