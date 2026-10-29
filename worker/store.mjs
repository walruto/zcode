import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function load(file) {
  try {
    const jobs = JSON.parse(await readFile(file, "utf8"));
    return jobs.map((job) => job.status === "running" ? { ...job, status: "failed", error: "Worker restarted during call." } : job);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function save(file, jobs) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(jobs, null, 2));
  await rename(temporary, file);
}
