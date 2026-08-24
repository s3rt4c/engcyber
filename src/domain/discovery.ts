import type { ContentCategoryId } from "@/domain/learning";
import type { FeedItem } from "@/domain/models";

export type SourceHealthReason = "timeout" | "invalid_xml" | "invalid_content_type" | "response_too_large" | "redirect_error" | "network_error";
export type DiscoverSourceHealth = { readonly sourceId: string; readonly sourceName: string; readonly state: "available" | "temporarily_unavailable"; readonly reason?: SourceHealthReason; };
export type DiscoverResult = { readonly items: readonly FeedItem[]; readonly sources: readonly DiscoverSourceHealth[]; };

export type DiscoverFilters = {
  readonly category: ContentCategoryId | "all";
  readonly sourceId: string | "all";
  readonly sort: "newest" | "oldest";
};

function compareItems(left: FeedItem, right: FeedItem, sort: DiscoverFilters["sort"]): number {
  const leftTime = left.publishedAt?.getTime();
  const rightTime = right.publishedAt?.getTime();
  if (leftTime !== undefined && rightTime !== undefined && leftTime !== rightTime) return sort === "newest" ? rightTime - leftTime : leftTime - rightTime;
  if (leftTime !== undefined && rightTime === undefined) return -1;
  if (leftTime === undefined && rightTime !== undefined) return 1;
  return left.id.localeCompare(right.id);
}

export function filterDiscoverItems(items: readonly FeedItem[], filters: DiscoverFilters): FeedItem[] {
  return items
    .filter((item) => (filters.category === "all" || item.primaryCategory === filters.category) && (filters.sourceId === "all" || item.sourceId === filters.sourceId))
    .sort((left, right) => compareItems(left, right, filters.sort));
}
