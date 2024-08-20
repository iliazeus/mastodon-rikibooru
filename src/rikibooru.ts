import assert from "node:assert/strict";
import { env } from "node:process";
import { basename } from "node:path/posix";

const { MASTODON_BASE_URL, MASTODON_USERNAME, OWNER_EMAIL } = env;
assert(MASTODON_BASE_URL);
assert(MASTODON_USERNAME);
assert(OWNER_EMAIL);

const USER_AGENT = `mastodon-rikibooru/0.1 (${MASTODON_BASE_URL}/@${MASTODON_USERNAME}; ${OWNER_EMAIL})`;

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
  const response = await fetch("https://api.rikibooru.com/metadata", {
    headers: { "User-Agent": USER_AGENT },
  });
  if (response.status !== 200) throw new Error(await response.text());
  return (await response.json()) as any;
}

export async function getImageInfo(id: number): Promise<ImageInfo> {
  const response = await fetch("https://api.rikibooru.com/getRandomArt=" + id, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (response.status !== 200) throw new Error(await response.text());
  const [info] = (await response.json()) as any;
  return info;
}

export async function queryImages(query: string): Promise<ImageQueryResult> {
  const response = await fetch("https://api.rikibooru.com/query=" + query, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (response.status !== 200) throw new Error(await response.text());
  return await response.json();
}

export async function getImagesFromVkPost(linkToPost: string): Promise<ImageInfo[]> {
  const postId = linkToPost.slice("https://vk.com/".length);
  const response = await fetch("https://api.rikibooru.com/post=" + postId, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (response.status !== 200) throw new Error(await response.text());
  return await response.json();
}

export async function getImage(info: ImageInfo): Promise<File> {
  const response = await fetch(info.linktopic, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (response.status !== 200) throw new Error(await response.text());

  const blob = await response.blob();
  const url = new URL(info.linktopic);
  const extension = basename(url.pathname).split(".").at(-1);

  return new File([blob], `${info.vk_id}.${extension}`, { type: blob.type });
}
