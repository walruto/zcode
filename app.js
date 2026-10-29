const form = document.querySelector("#schedule-form");
const status = document.querySelector("#status");
const button = form.querySelector('button[type="submit"]');
const joinAt = document.querySelector("#join-at");
const scheduleType = document.querySelector("#schedule-type");
const onceFields = document.querySelector("#once-fields");
const repeatFields = document.querySelector("#repeat-fields");
const startDate = document.querySelector("#start-date");
const endDate = document.querySelector("#end-date");
const timeList = document.querySelector("#time-list");

const earliest = new Date(Date.now() + 11 * 60 * 1000);
earliest.setSeconds(0, 0);
joinAt.min = toLocalInput(earliest);
joinAt.value = toLocalInput(earliest);
startDate.value = toDateInput(earliest);
startDate.min = toDateInput(earliest);
const defaultEnd = new Date(earliest);
defaultEnd.setDate(defaultEnd.getDate() + 28);
endDate.value = toDateInput(defaultEnd);
endDate.min = startDate.value;
document.querySelector(`input[name="weekday"][value="${earliest.getDay()}"]`).checked = true;
timeList.querySelector("input").value = earliest.toTimeString().slice(0, 5);

scheduleType.addEventListener("change", syncMode);
startDate.addEventListener("change", () => { endDate.min = startDate.value; });
document.querySelector("#add-time").addEventListener("click", () => {
  const row = document.createElement("div");
  row.className = "time-row";
  row.innerHTML = '<input type="time" name="repeatTime" required /><button class="remove-time" type="button" aria-label="Remove time">Remove</button>';
  row.querySelector("button").addEventListener("click", () => row.remove());
  timeList.append(row);
  row.querySelector("input").focus();
});
syncMode();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  button.firstChild.textContent = "Scheduling… ";
  status.hidden = true;

  const data = new FormData(form);
  try {
    const joinTimes = scheduleType.value === "once"
      ? [new Date(data.get("joinAt")).toISOString()]
      : recurringJoinTimes();
    const response = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingUrl: data.get("zoomUrl"),
        joinTimes,
        botName: data.get("botName"),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not schedule the bot.");

    status.className = "status";
    status.textContent = `Scheduled ${result.count} bot${result.count === 1 ? "" : "s"}. You can close this page.`;
    status.hidden = false;
  } catch (error) {
    status.className = "status error";
    status.textContent = error.message;
    status.hidden = false;
  } finally {
    button.disabled = false;
    button.firstChild.textContent = "Schedule bot ";
  }
});

function toLocalInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toDateInput(date) {
  return toLocalInput(date).slice(0, 10);
}

function syncMode() {
  const repeating = scheduleType.value === "repeat";
  onceFields.hidden = repeating;
  repeatFields.hidden = !repeating;
  joinAt.disabled = repeating;
  for (const input of repeatFields.querySelectorAll("input")) input.disabled = !repeating;
}

function recurringJoinTimes() {
  const weekdays = new Set(
    [...document.querySelectorAll('input[name="weekday"]:checked')].map((input) => Number(input.value)),
  );
  const times = [...document.querySelectorAll('input[name="repeatTime"]')]
    .map((input) => input.value)
    .filter(Boolean);
  if (!startDate.value || !endDate.value || !weekdays.size || !times.length) {
    throw new Error("Choose a date range, at least one weekday, and at least one time.");
  }

  const [startYear, startMonth, startDay] = startDate.value.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.value.split("-").map(Number);
  const current = new Date(startYear, startMonth - 1, startDay, 12);
  const end = new Date(endYear, endMonth - 1, endDay, 12);
  const results = [];
  for (; current <= end; current.setDate(current.getDate() + 1)) {
    if (!weekdays.has(current.getDay())) continue;
    for (const value of times) {
      const [hour, minute] = value.split(":").map(Number);
      const occurrence = new Date(current.getFullYear(), current.getMonth(), current.getDate(), hour, minute);
      if (occurrence.getTime() >= Date.now() + 10 * 60 * 1000) results.push(occurrence.toISOString());
    }
  }
  const unique = [...new Set(results)].sort();
  if (!unique.length) throw new Error("This schedule has no future meeting times.");
  if (unique.length > 30) throw new Error(`This creates ${unique.length} bots. Shorten it to 30 or fewer.`);
  return unique;
}
