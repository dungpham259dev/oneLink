import { test, expect } from "@playwright/test";

// Requires a seeded link with slug "e2e-demo" whose iosUrl points to a known URL,
// and its config present in Upstash. Set BASE_URL in playwright.config.ts.
test("iOS user-agent redirects to iOS store", async ({ request }) => {
  const res = await request.get("/r/e2e-demo", {
    headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(302);
  expect(res.headers()["location"]).toContain("apps.apple.com");
});

test("unknown slug returns 404", async ({ request }) => {
  const res = await request.get("/r/nope-nope", { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});
