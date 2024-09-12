import assert from "node:assert/strict";
import { env } from "node:process";
import { basename } from "node:path/posix";

const { MASTODON_BASE_URL, MASTODON_USERNAME, OWNER_EMAIL } = env;
assert(MASTODON_BASE_URL);
assert(MASTODON_USERNAME);
assert(OWNER_EMAIL);

async function fetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
  init.headers = new Headers(init.headers);
  init.headers.set(
    "User-Agent",
    `mastodon-rikibooru/0.1 (${MASTODON_BASE_URL}/@${MASTODON_USERNAME}; ${OWNER_EMAIL})`,
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

export type Metadata = [
  header: MetadataHeaderItem,
  characters: MetadataTagsItem,
  types: MetadataTagsItem,
  cws: MetadataTagsItem,
  themes: MetadataTagsItem,
  crossovers: MetadataTagsItem,
];

export interface MetadataHeaderItem {
  /**
   * it should've been `date`, not `data`
   * @example '3/23/2024'
   */
  data: string;

  /** @example '100%' */
  finished_percentage: string;

  sum_count: number;

  /** @example '23.03.2024, 19:43:33' */
  last_modified: string;
}

export interface MetadataTagsItem {
  tags: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  tag: string;
  qty: number;

  /** @example '#4dd2ff' */
  color: string;
}

export interface ImageInfo {
  vk_id: number;
  linktopic: string;
  linktopost: string;
  tags: string[];
  parent_id: unknown;
}

export interface ImageQueryResult {
  photos: ImageQueryResultItem[];
}

export interface ImageQueryResultItem {
  vk_id: number;
  linktopic: string;
  linktopost: string;
  parent_id: unknown;
}

export async function getMetadata(): Promise<Metadata> {
  const response = await fetch("https://api.rikibooru.com/metadata");
  return await response.json();
}

export async function getImageInfo(id: number): Promise<ImageInfo> {
  const response = await fetch("https://api.rikibooru.com/getRandomArt=" + id);
  const [info] = await response.json();
  return info;
}

export async function queryImages(query: string): Promise<ImageQueryResult> {
  const response = await fetch("https://api.rikibooru.com/query=" + query);
  return await response.json();
}

export async function getImagesFromVkPost(linkToPost: string): Promise<ImageInfo[]> {
  const postId = linkToPost.slice("https://vk.com/".length);
  const response = await fetch("https://api.rikibooru.com/post=" + postId);
  return await response.json();
}

export async function getImage(info: ImageInfo): Promise<File> {
  const response = await fetch(info.linktopic);

  const blob = await response.blob();
  const url = new URL(info.linktopic);
  const extension = basename(url.pathname).split(".").at(-1);

  return new File([blob], `${info.vk_id}.${extension}`, { type: blob.type });
}
