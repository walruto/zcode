import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { joinZoom } from "./bot.mjs";
import { load, save } from "./store.mjs";

const port = Number(process.env.PORT || 3000);
const dataFile = process.env.DATA_FILE || "/data/schedules.json";
const token = process.env.WORKER_TOKEN || "";
let jobs = await load(dataFile);

createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") return send(response, 200, { ok: true });
    if (request.method !== "POST" || request.url !== "/schedule") return send(response, 404, { error: "Not found." });
    if (!authorized(request.headers.authorization)) return send(response, 401, { error: "Unauthorized." });

    const input = validate(await readJson(request));
    const created = [];
    for (const joinAt of input.joinTimes) {
      const fingerprint = `${input.meetingUrl}|${input.botName}|${joinAt}`;
      let job = jobs.find((candidate) => candidate.fingerprint === fingerprint);
      if (!job) {
        job = { id: randomUUID(), fingerprint, ...input, joinAt, status: "pending", createdAt: new Date().toISOString() };
        delete job.joinTimes;
        jobs.push(job);
      }
      created.push(job.id);
    }
    await save(dataFile, jobs);
    return send(response, 201, { ids: created, count: created.length });
  } catch (error) {
    return send(response, 400, { error: error.message || "Invalid request." });
  }
}).listen(port, "0.0.0.0", () => console.log(`Zoom worker listening on ${port}`));

setInterval(runDueJobs, 10_000).unref();
await runDueJobs();

async function runDueJobs() {
  const due = jobs.filter((job) => job.status === "pending" && new Date(job.joinAt).getTime() <= Date.now());
  for (const job of due) {
    job.status = "running";
    await save(dataFile, jobs);
    joinZoom(job).then(
      async () => { job.status = "complete"; await save(dataFile, jobs); },
      async (error) => { job.status = "failed"; job.error = error.message; await save(dataFile, jobs); },
    );
  }
}

function validate(input) {
  const url = new URL(String(input.meetingUrl || ""));
  if (url.protocol !== "https:" || !(url.hostname === "zoom.us" || url.hostname.endsWith(".zoom.us"))) throw new Error("Invalid Zoom link.");
  const botName = String(input.botName || "").trim();
  if (!botName || botName.length > 100) throw new Error("Invalid bot name.");
  if (!Array.isArray(input.joinTimes) || input.joinTimes.length < 1 || input.joinTimes.length > 30) throw new Error("Supply 1–30 join times.");
  const joinTimes = [...new Set(input.joinTimes.map((value) => new Date(value).toISOString()))];
  return { meetingUrl: url.toString(), botName, joinTimes };
}

function authorized(header = "") {
  if (!token) return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 100_000) throw new Error("Request too large.");
  }
  return JSON.parse(body);
}

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}
