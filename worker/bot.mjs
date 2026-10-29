export function webJoinUrl(meetingUrl) {
  const url = new URL(meetingUrl);
  const meetingId = url.pathname.match(/^\/j\/(\d+)\/?$/)?.[1];
  if (!meetingId) throw new Error("Zoom link must contain /j/<meeting-id>.");
  const result = new URL(`https://app.zoom.us/wc/${meetingId}/join`);
  result.searchParams.set("fromPWA", "1");
  if (url.searchParams.get("pwd")) result.searchParams.set("pwd", url.searchParams.get("pwd"));
  return result.toString();
}

export async function joinZoom({ meetingUrl, botName, maxMinutes = 240 }) {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--disable-dev-shm-usage", "--disable-gpu", "--mute-audio", "--no-sandbox"],
  });
  try {
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await page.goto(webJoinUrl(meetingUrl), { waitUntil: "domcontentloaded", timeout: 60_000 });

    const nameInput = page.locator('input[placeholder*="name" i], input[name="inputname"], #inputname').first();
    await nameInput.waitFor({ state: "visible", timeout: 60_000 });
    await nameInput.fill(botName);
    await page.getByRole("button", { name: /^join$/i }).click({ timeout: 30_000 });

    const deadline = Date.now() + maxMinutes * 60_000;
    while (!page.isClosed() && Date.now() < deadline) {
      const ended = await page.getByText(/meeting has ended|removed by the host|invalid meeting id/i).count();
      if (ended) break;
      await page.waitForTimeout(15_000);
    }
  } finally {
    await browser.close();
  }
}
