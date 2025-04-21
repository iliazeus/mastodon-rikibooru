import "./polyfill.js"

import { env } from "node:process";

import * as bot from "./bot.js";

const { POST_IMMEDIATELY = false } = env;

main();

async function main() {
  await bot.init();
  if (POST_IMMEDIATELY) await bot.tick();
  setInterval(bot.tick, 2 * 60 * 60 * 1000);
}
