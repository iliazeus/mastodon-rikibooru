import "dotenv/config";

import assert from "node:assert/strict";
import { env } from "node:process";
import { basename } from "node:path/posix";

const { MASTODON_BASE_URL, MASTODON_USERNAME } = env;
assert(MASTODON_BASE_URL);
assert(MASTODON_USERNAME);

const USER_AGENT = `mastodon-rikibooru/0.1 (+${MASTODON_BASE_URL}/${MASTODON_USERNAME})`;

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

export async function getMetadata(): Promise<Metadata> {
  const response = await fetch("https://rikibooru.host/rikibooru/metadata", {
    headers: { "User-Agent": USER_AGENT },
  });
  if (response.status !== 200) throw new Error(await response.text());
  return (await response.json()) as any;
}

export async function getImageInfo(id: number): Promise<ImageInfo> {
  const response = await fetch("https://rikibooru.host/rikibooru/getRandomArt=" + id, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (response.status !== 200) throw new Error(await response.text());
  const [info] = (await response.json()) as any;
  return info;
}

export async function getImage(info: ImageInfo): Promise<File> {
  const response = await fetch(info.linktopic, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (response.status !== 200) throw new Error(await response.text());

  const blob = await response.blob();
  const url = new URL(info.linktopic);
  const filename = basename(url.pathname);

  return new File([blob], filename, { type: blob.type });
}
