import { mkdir, writeFile } from "node:fs/promises";

const pad = (value) => String(value).padStart(2, "0");
const now = new Date();
const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).formatToParts(now);
const part = (type) => parts.find((item) => item.type === type).value;
const stamp = [
  part("year"),
  part("month"),
  part("day"),
  "-",
  pad(part("hour") === "24" ? "00" : part("hour")),
  part("minute"),
].join("");

await mkdir(new URL("../src", import.meta.url), { recursive: true });
await writeFile(
  new URL("../src/buildInfo.js", import.meta.url),
  `export const BUILD_STAMP = "${stamp}";\n`,
);
