import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildTicketCalendar, buildTicketing, writeJson } from "./update-data.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, "data");

async function readJson(fileName) {
  return JSON.parse(await readFile(join(DATA_DIR, fileName), "utf8"));
}

async function main() {
  const [games, calendar, meta] = await Promise.all([
    readJson("games.json"),
    readJson("ticketing-calendar.json"),
    readJson("meta.json"),
  ]);
  const year = Number(String(meta.updatedAt ?? "").slice(0, 4)) || new Date().getUTCFullYear();

  const rebuiltGames = games.map((game) => ({ ...game, ticketing: buildTicketing(game) }));
  const rebuiltCalendar = buildTicketCalendar(calendar, year);

  await Promise.all([
    writeJson("games.json", rebuiltGames),
    writeJson("ticketing-calendar.json", rebuiltCalendar),
  ]);
  console.log(`rebuilt ticketing metadata: games=${rebuiltGames.length}, calendar=${rebuiltCalendar.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
