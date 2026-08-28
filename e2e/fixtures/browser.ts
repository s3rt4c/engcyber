import { expect, test as base } from "@playwright/test";

const defaultBaseURL = "http://127.0.0.1:3100";

export const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    const allowedOrigin = new URL(baseURL ?? defaultBaseURL).origin;
    const externalRequests: string[] = [];
    await context.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if ((requestUrl.protocol === "http:" || requestUrl.protocol === "https:") && requestUrl.origin !== allowedOrigin) {
        externalRequests.push(requestUrl.toString());
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    await provide(context);
    expect(externalRequests, `Unexpected external browser requests: ${externalRequests.join(", ")}`).toEqual([]);
  },
  page: async ({ page }, provide) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await provide(page);
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  },
});

export { expect } from "@playwright/test";
