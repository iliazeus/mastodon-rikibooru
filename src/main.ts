import * as bot from "./bot";

main();

async function main() {
  await bot.init();
  setInterval(bot.updateBooruDb, 24 * 60 * 60 * 1000);
  setInterval(bot.postImage, 60 * 60 * 1000);
}
