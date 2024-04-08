import "source-map-support/register";
import * as bot from "./bot";

main();

async function main() {
  await bot.init();
  setInterval(bot.tick, 2 * 60 * 60 * 1000);
}
