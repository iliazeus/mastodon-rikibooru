import * as mastodon from "./mastodon.js";
import * as rikibooru from "./rikibooru.js";

export interface State {
  postHistory: PostHistoryItem[];
  skippedBooruIds: number[];
}

export interface PostHistoryItem {
  booruId: number;
  mastodonId: string;
  postedAt: Date;
}

export function initialState(): State {
  return { postHistory: [], skippedBooruIds: [] };
}

/** mutates `state`, which needs to be persisted after the call */
export async function tick(state: State): Promise<void> {
  const meta = await rikibooru.getMetadata();

  const allSensitiveTags = meta[3].tags.map((x) => x.tag).filter((x) => x !== "пейр");

  // prettier-ignore
  const allTagNames = new Map(
    [meta[1].tags, meta[2].tags, meta[3].tags, meta[4].tags, meta[5].tags]
      .flatMap((x) => x.map((y) => [y.tag, y.name])),
  );

  let booruId = meta[0].sum_count - 1;
  while (true) {
    while (
      state.postHistory.some((x) => x.booruId === booruId) ||
      state.skippedBooruIds.includes(booruId)
    ) {
      booruId -= 1;
    }

    const imageInfo = await rikibooru.getImageInfo(booruId);

    if (imageInfo.tags.length === 0) {
      // moderators often add tags later; we can just wait until that is done
      booruId -= 1;
      continue;
    }

    const sensitiveTags = imageInfo.tags.filter((x) => allSensitiveTags.includes(x));

    // if (sensitiveTags.length > 0) {
    //   // TODO: should we allow this?
    //   state.skippedBooruIds.push(booruId);
    //   booruId -= 1;
    //   continue;
    // }

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

    const res = await mastodon.postStatusWithAttachments(status, [media]);

    state.postHistory.push({
      booruId: booruId,
      mastodonId: res.id,
      postedAt: new Date(),
    });

    return;
  }
}
