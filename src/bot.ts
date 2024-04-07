import "dotenv/config";

import { env } from "node:process";
import * as fs from "node:fs/promises";

import * as mastodon from "./mastodon";
import * as rikibooru from "./rikibooru";

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
  images: rikibooru.ImageQueryResult[];
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

export async function updateBooruDb(): Promise<void> {
  const db: BooruDb = { updatedAt: Date.now(), images: await rikibooru.queryImages("-") };
  await fs.writeFile(BOORU_DB_FILENAME, JSON.stringify(db), "utf-8");
}

export async function postImage(): Promise<void> {
  const booruDb: BooruDb = JSON.parse(await fs.readFile(BOORU_DB_FILENAME, "utf-8"));
  const state: State = JSON.parse(await fs.readFile(STATE_FILENAME, "utf-8"));

  const meta = await rikibooru.getMetadata();

  const allSensitiveTags = meta[3].tags.map((x) => x.tag).filter((x) => x !== "пейр");

  // prettier-ignore
  const allTagNames = new Map(
      [meta[1].tags, meta[2].tags, meta[3].tags, meta[4].tags, meta[5].tags]
        .flatMap((x) => x.map((y) => [y.tag, y.name])),
    );

  const imageInfo = await selectImage({ booruDb, state });

  const sensitiveTags = imageInfo.tags.filter((x) => allSensitiveTags.includes(x));

  const tagNames = imageInfo.tags.map((x) => allTagNames.get(x)).filter((x) => !!x);
  if (!tagNames.includes("Смешарик")) tagNames.unshift("Смешарики");

  const hashtags = imageInfo.tags.filter((x) => !x.startsWith("artist_")).map((x) => "#" + x);
  if (!hashtags.includes("#смешарики")) hashtags.unshift("#смешарики");

  const status: mastodon.Status = {
    visibility: "public",
    language: "ru",
    sensitive: sensitiveTags.length > 0,
    spoiler_text: sensitiveTags.length > 0 ? sensitiveTags.join(", ") : undefined,
    // prettier-ignore
    status: [
        tagNames.join("; "),
        `source: ${imageInfo.linktopost}`,
        "",
        hashtags.join(" "),
      ].join("\n"),
  };

  const media: mastodon.Media = {
    file: await rikibooru.getImage(imageInfo),
    description: tagNames.join("; "),
  };

  const mastodonStatus = await mastodon.postStatusWithAttachments(status, [media]);

  state.skippedVkIds.push(imageInfo.vk_id);
  await fs.writeFile(STATE_FILENAME, JSON.stringify(state), "utf-8");

  const historyItem: PostHistoryItem = { imageInfo, mastodonStatus };
  await fs.appendFile(HISTORY_FILENAME, JSON.stringify(historyItem) + "\n", "utf-8");
}

async function selectImage(opts: { booruDb: BooruDb; state: State }): Promise<rikibooru.ImageInfo> {
  const { booruDb, state } = opts;

  for (const image of booruDb.images) {
    if (state.skippedVkIds.includes(image.vk_id)) continue;

    const postImages = await rikibooru.getImagesFromVkPost(image.linktopost);

    const anyNonEmptyTags = postImages.find((x) => x.tags.length > 0)?.tags;
    if (!anyNonEmptyTags) continue;

    for (const imageInfo of postImages) {
      if (state.skippedVkIds.includes(imageInfo.vk_id)) continue;
      if (imageInfo.tags.length === 0) imageInfo.tags = anyNonEmptyTags;
      return imageInfo;
    }
  }

  throw new Error("no suitable image found");
}
