import "server-only";

export const darknetDiariesPodcastSource = {
  id: "darknet-diaries",
  displayName: "Darknet Diaries",
  publisher: "Darknet Diaries",
  feedUrl: "https://podcast.darknetdiaries.com/",
  websiteHost: "darknetdiaries.com",
  episodePath: /^\/episode\/[1-9]\d*\/$/,
  transcriptPath: /^\/transcript\/[1-9]\d*\/$/,
} as const;

export const podcastSources = [darknetDiariesPodcastSource] as const;
