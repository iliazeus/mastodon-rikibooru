import "dotenv/config";

import { env } from "node:process";
import * as fs from "node:fs/promises";

import * as bot from "./bot.js";

const {
  STATE_FILENAME = "./state.json",
  HISTORY_FILENAME = "./history.jsonl",
  TICK_INTERVAL = 60 * 60 * 1000,
} = env;

setInterval(tick, Number(TICK_INTERVAL));
tick();

async function tick() {
  try {
    const state = await fs
      .readFile(STATE_FILENAME, "utf-8")
      .then((x) => JSON.parse(x) as bot.State)
      .catch(() => bot.initialState());

    const historyPush = async (item: any) => {
      await fs.appendFile(HISTORY_FILENAME, JSON.stringify(item) + "\n", "utf-8");
    };

    await bot.tick({ state, historyPush });

    await fs.writeFile(STATE_FILENAME, JSON.stringify(state), "utf-8");
  } catch (error) {
    console.error(error);
  }
}
