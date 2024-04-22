import * as bot from "./bot.js";

main();

async function main() {
  await bot.init();
  setInterval(bot.tick, 2 * 60 * 60 * 1000);
}
