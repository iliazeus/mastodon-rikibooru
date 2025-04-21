import { env } from "node:process";
import * as fs from "node:fs/promises";

import * as mastodon from "./mastodon.js";
import * as rikibooru from "./rikibooru.js";

const {
  BOORU_DB_FILENAME = "./booru.json",
  STATE_FILENAME = "./state.json",
  HISTORY_FILENAME = "./history.jsonl",
} = env;

interface State {
  skippedVkIds: number[];
}

interface PostHistoryItem {
  imageInfo: rikibooru.ImageInfo;
  mastodonStatus: mastodon.Status;
}

interface BooruDb {
  /** @example Date.now() */
  updatedAt: number;
  images: rikibooru.ImageQueryResult;
}

export async function init(): Promise<void> {
  try {
    await fs.access(BOORU_DB_FILENAME);
  } catch {
    const db: BooruDb = { updatedAt: Date.now(), images: await rikibooru.queryImages("-") };
    await fs.writeFile(BOORU_DB_FILENAME, JSON.stringify(db), "utf-8");
  }

  try {
    await fs.access(STATE_FILENAME);
  } catch {
    const state: State = { skippedVkIds: [] };
    await fs.writeFile(STATE_FILENAME, JSON.stringify(state), "utf-8");
  }
}

export async function tick(): Promise<void> {
  const booruDb: BooruDb = await updateBooruDbIfNeeded();
  const state: State = JSON.parse(await fs.readFile(STATE_FILENAME, "utf-8"));

  const instance = await mastodon.getInstanceInfo();
  const booruMeta = await rikibooru.getMetadata();

  const allSensitiveTags = booruMeta[3].tags.map((x) => x.tag).filter((x) => x !== "пейр");

  // prettier-ignore
  const allTagNames = new Map(
      [booruMeta[1].tags, booruMeta[2].tags, booruMeta[3].tags, booruMeta[4].tags, booruMeta[5].tags]
        .flatMap((x) => x.map((y) => [y.tag, y.name])),
    );

  const [imageInfo, imageFile] = await selectImage({ booruDb, state });

  const sensitiveTags = imageInfo.tags.filter((x) => allSensitiveTags.includes(x));

  const tagNames = imageInfo.tags.map((x) => allTagNames.get(x)).filter((x) => !!x);
  if (!tagNames.includes("Смешарик")) tagNames.unshift("Смешарики");

  const hashtags = imageInfo.tags.filter((x) => !x.startsWith("artist_")).map((x) => "#" + x);
  if (!hashtags.includes("#смешарики")) hashtags.unshift("#смешарики");

  let text = [
    tagNames.join("; "),
    `source: ${imageInfo.linktopost}`,
    `artist: ${imageInfo.artist_aliases.map((x) => "https://" + x).join(" ")}`,
    "",
    hashtags.join(" "),
  ].join("\n");

  if (text.length > instance.configuration.statuses.max_characters) {
    text = [
      `source: ${imageInfo.linktopost}`,
      `author: https://${imageInfo.artist_aliases[0]}`,
      "",
      hashtags.join(" "),
    ].join("\n");
  }

  if (text.length > instance.configuration.statuses.max_characters) {
    text = [`source: ${imageInfo.linktopost}`, "", "#смешарики"].join("\n");
  }

  const status: mastodon.Status = {
    visibility: "public",
    language: "ru",
    sensitive: sensitiveTags.length > 0,
    spoiler_text: sensitiveTags.length > 0 ? sensitiveTags.join(", ") : undefined,
    status: text,
  };

  const media: mastodon.Media = { file: imageFile, description: tagNames.join("; ") };

  const mastodonStatus = await mastodon.postStatusWithAttachments(status, [media]);

  state.skippedVkIds.push(imageInfo.vk_id);
  await fs.writeFile(STATE_FILENAME, JSON.stringify(state), "utf-8");

  const historyItem: PostHistoryItem = { imageInfo, mastodonStatus };
  await fs.appendFile(HISTORY_FILENAME, JSON.stringify(historyItem) + "\n", "utf-8");
}

async function updateBooruDbIfNeeded(): Promise<BooruDb> {
  let db: BooruDb = JSON.parse(await fs.readFile(BOORU_DB_FILENAME, "utf-8"));
  if (Date.now() - db.updatedAt <= 24 * 60 * 60 * 1000) return db;

  db = { updatedAt: Date.now(), images: await rikibooru.queryImages("-") };
  await fs.writeFile(BOORU_DB_FILENAME, JSON.stringify(db), "utf-8");
  return db;
}

async function selectImage(opts: {
  booruDb: BooruDb;
  state: State;
}): Promise<[rikibooru.ImageInfo, File]> {
  const { booruDb, state } = opts;

  for (const image of booruDb.images.photos) {
    if (state.skippedVkIds.includes(image.vk_id)) continue;

    const post = await rikibooru.getVkPost(image.linktopost);

    const anyNonEmptyTags = post.content.find((x) => x.tags.length > 0)?.tags;
    if (!anyNonEmptyTags) continue;

    for (const imageInfo of post.content) {
      if (state.skippedVkIds.includes(imageInfo.vk_id)) continue;
      if (imageInfo.tags.length === 0) imageInfo.tags = anyNonEmptyTags;

      try {
        const imageFile = await rikibooru.getImage(imageInfo);
        return [imageInfo, imageFile];
      } catch (e) {
        console.error(e);
      }
    }
  }

  throw new Error("no suitable image found");
}
