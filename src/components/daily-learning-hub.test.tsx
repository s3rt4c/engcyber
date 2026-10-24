import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it, vi } from "vitest";
import { DailyLearningHubContent } from "@/components/daily-learning-hub";
import { buildDailyHub, loadLocalLearningData } from "@/client/local-learning-loaders";
import { createReadOnlyHomeReaders } from "@/client/home-learning-readers";
import { trainingFixture } from "@/test/daily-training-fixtures";

const now = "2026-10-24T12:00:00.000Z";
describe("M18 Home presentation", () => {
  it("renders three semantic queue links with their reasons before the preserved detailed sections", async () => {
    const fixture = await trainingFixture(now);
    const hub = buildDailyHub(await loadLocalLearningData(createReadOnlyHomeReaders(fixture.storage)), { now, timeZone: "UTC" });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const $ = load(renderToStaticMarkup(<DailyLearningHubContent hub={hub} />));
      const section = $('section[aria-labelledby="training-heading"]');
      expect(section.find("h2").text()).toBe("Today's training");
      expect(section.find("ol > li")).toHaveLength(3);
      expect(section.find("a").map((_, node) => $(node).attr("href")).get()).toEqual(hub.trainingQueue.map((item) => item.href));
      for (const item of hub.trainingQueue) {
        const link = section.find(`a[href="${item.href}"]`);
        expect(link.text()).toContain(item.title); expect(link.text()).toContain(item.reason);
        expect(link.attr("tabindex")).toBeUndefined(); expect(link.attr("class")).toContain("focus-visible");
      }
      const headings = $("h2").map((_, node) => $(node).text()).get();
      expect(headings).toEqual(["Today's training", "Continue", "Continue IELTS Practice", "Review", "Vocabulary", "Focus", "Recent lessons", "Discover", "IELTS Practice"]);
      expect($("section[aria-label=Focus]").text()).toContain(hub.focus[0].message);
      expect(errors).not.toHaveBeenCalled();
    } finally { errors.mockRestore(); }
  });
  it("shows a calm empty state with no fabricated queue action and keeps access-all navigation", async () => {
    const hub = buildDailyHub(await loadLocalLearningData(createReadOnlyHomeReaders(null)), { now, timeZone: "UTC" });
    const $ = load(renderToStaticMarkup(<DailyLearningHubContent hub={hub} />));
    expect($("#training-heading").text()).toBe("Today's training");
    const section = $('section[aria-labelledby="training-heading"]');
    expect(section.text()).toContain("You're caught up on saved practice. Choose something new below.");
    expect(section.find("a")).toHaveLength(0);
    expect($('a[href="/discover"]').length).toBeGreaterThan(0);
    expect($('a[href="/review"]').length).toBeGreaterThan(0);
  });
  it("keeps the loading state distinct from an empty queue", () => {
    const $ = load(renderToStaticMarkup(<DailyLearningHubContent hub={null} />));
    expect($("main").text()).toContain("Loading your browser-local learning activity");
    expect($("#training-heading")).toHaveLength(0);
  });
});
