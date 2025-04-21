import assert from "node:assert/strict";
import { env } from "node:process";

const { MASTODON_BASE_URL, MASTODON_USERNAME, MASTODON_ACCESS_TOKEN } = env;
assert(MASTODON_BASE_URL);
assert(MASTODON_USERNAME);
assert(MASTODON_ACCESS_TOKEN);

async function fetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
  init.headers = new Headers(init.headers);
  init.headers.set("Authorization", `Bearer ${MASTODON_ACCESS_TOKEN}`);
  init.headers.set(
    "User-Agent",
    `mastodon-rikibooru/0.1 (+${MASTODON_BASE_URL}/@${MASTODON_USERNAME})`,
  );

  try {
    const response = await globalThis.fetch(url, init);

    if (!response.ok) {
      throw new Error(
        `${init.method ?? "GET"} ${url} ${response.status} ${response.statusText}\n` +
          (await response.text()),
      );
    }

    return response;
  } catch (e) {
    throw new Error(`${init.method ?? "GET"} ${url}`, { cause: e });
  }
}

export interface Instance {
  domain: string;
  title: string;

  configuration: {
    accounts: {
      max_featured_tags: number;
      max_pinned_statuses: number;
    };
    statuses: {
      max_characters: number;
      max_media_attachments: number;
      characters_reserved_per_url: number;
    };
    media_attachments: {
      supported_mime_types: string[];
      image_size_limit: number;
      image_matrix_limit: number;
    };
  };
}

export interface Status {
  status?: string;
  content_type?: string;
  media_ids?: string[];
  sensitive?: boolean;
  spoiler_text?: string;
  visibility?: "public" | "unlisted" | "private" | "direct";

  /**
   * ISO 639
   * @example 'en'
   */
  language?: string;

  /**
   * ISO 8601; must be at least 5 minutes in the future
   * @example new Date().toISOString()
   */
  scheduled_at?: string;
}

export interface StatusResponse {
  id: string;

  /** ISO 8601 */
  created_at?: string;

  /** ISO 8601 */
  scheduled_at?: string;
}

export interface Media {
  file: File;
  description?: string;

  /** @example '-0.5,0.5' */
  focus?: string;
}

export interface MediaResponse {
  id: string;
}

export async function getInstanceInfo(): Promise<Instance> {
  const res = await fetch(MASTODON_BASE_URL + "/api/v2/instance");
  return await res.json();
}

export async function getScheduledStatuses(): Promise<StatusResponse[]> {
  const res = await fetch(MASTODON_BASE_URL + "/api/v1/scheduled_statuses?limit=40");
  return await res.json();
}

export async function postStatusWithAttachments(
  status: Omit<Status, "media_ids">,
  atts: Media[] = [],
): Promise<StatusResponse> {
  const media_ids: string[] = [];
  for (const att of atts) media_ids.push((await postAttachment(att)).id);
  return await postStatus({ ...status, media_ids });
}

export async function postStatus(status: Status): Promise<StatusResponse> {
  const res = await fetch(MASTODON_BASE_URL + "/api/v1/statuses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(status),
  });
  return await res.json();
}

export async function postAttachment(att: Media): Promise<MediaResponse> {
  const req = new FormData();
  req.set("file", att.file);
  if (att.description) req.set("description", att.description);
  if (att.focus) req.set("focus", att.focus);

  let error: unknown;
  for (let tries = 0; tries < 10; tries++) {
    if (error) console.warn(String(error));
    try {
      const res = await fetch(MASTODON_BASE_URL + "/api/v2/media", {
        method: "POST",
        body: req,
      });

      if (res.status >= 400) throw new Error(await res.text());
      return await res.json();
    } catch (e) {
      error = e;
    }
  }

  throw error;
}
