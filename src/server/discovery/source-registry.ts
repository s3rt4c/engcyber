import "server-only";

import type { ContentType, FeedItem } from "@/domain/models";

type Category = FeedItem["primaryCategory"];

export type CuratedSource = {
  readonly id: string;
  readonly displayName: string;
  readonly category: Category;
  readonly feedType: "rss" | "atom";
  readonly feedUrl: string;
  readonly siteUrl: string;
  readonly publisher: string;
  readonly description: string;
  readonly expectedLanguage: "en";
  readonly priority: number;
  readonly contentKind: ContentType;
};

export const curatedSources: readonly CuratedSource[] = [
  { id: "cisa-advisories", displayName: "CISA Cybersecurity Advisories", category: "cybersecurity_news", feedType: "rss", feedUrl: "https://www.cisa.gov/cybersecurity-advisories/all.xml", siteUrl: "https://www.cisa.gov/cybersecurity-advisories", publisher: "CISA", description: "Official cybersecurity advisories.", expectedLanguage: "en", priority: 10, contentKind: "article" },
  { id: "hugging-face-blog", displayName: "Hugging Face Blog", category: "artificial_intelligence", feedType: "rss", feedUrl: "https://huggingface.co/blog/feed.xml", siteUrl: "https://huggingface.co/blog", publisher: "Hugging Face", description: "AI research and product updates.", expectedLanguage: "en", priority: 20, contentKind: "article" },
  { id: "sans-isc-handlers-diary", displayName: "SANS ISC Handler's Diary", category: "cybersecurity_news", feedType: "rss", feedUrl: "https://isc.sans.edu/rssfeed.xml", siteUrl: "https://isc.sans.edu/", publisher: "SANS Internet Storm Center", description: "Title-oriented security diary metadata.", expectedLanguage: "en", priority: 30, contentKind: "article" },
  { id: "google-cloud-threat-intelligence", displayName: "Google Cloud Threat Intelligence", category: "cybersecurity_news", feedType: "rss", feedUrl: "https://feeds.feedburner.com/threatintelligence/pvexyqv7v0v", siteUrl: "https://cloud.google.com/blog/topics/threat-intelligence", publisher: "Google Cloud", description: "Threat intelligence research and guidance.", expectedLanguage: "en", priority: 40, contentKind: "article" },
];
