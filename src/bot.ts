import assert from "node:assert/strict";

import * as mastodon from "./mastodon.js";
import * as rikibooru from "./rikibooru.js";

export interface State {
  skippedVkIds: number[];
}

export interface PostHistoryItem {
  imageInfo: rikibooru.ImageInfo;
  mastodonStatus: mastodon.Status;
}

export function initialState(): State {
  return { skippedVkIds: [] };
}

/** mutates `state`, which needs to be persisted after the call */
export async function tick(opts: {
  state: State;
  historyPush: (item: PostHistoryItem) => void | Promise<void>;
}): Promise<void> {
  const { state, historyPush } = opts;

  const meta = await rikibooru.getMetadata();

  const allSensitiveTags = meta[3].tags.map((x) => x.tag).filter((x) => x !== "пейр");

  // prettier-ignore
  const allTagNames = new Map(
    [meta[1].tags, meta[2].tags, meta[3].tags, meta[4].tags, meta[5].tags]
      .flatMap((x) => x.map((y) => [y.tag, y.name])),
  );

  let booruId = meta[0].sum_count - 1;
  let imageInfo: rikibooru.ImageInfo;

  let foundImage = false;
  while (!foundImage) {
    imageInfo = await rikibooru.getImageInfo(booruId);

    // it turns out booru ids aren't persistent, so we check by vk_id
    if (state.skippedVkIds.includes(imageInfo.vk_id)) {
      booruId -= 1;
      continue;
    }

    // moderators often add tags later; we can just wait until that is done
    if (imageInfo.tags.length === 0) {
      booruId -= 1;
      continue;
    }

    foundImage = true;
  }

  assert(imageInfo!);

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
  await historyPush({ imageInfo, mastodonStatus });
}
