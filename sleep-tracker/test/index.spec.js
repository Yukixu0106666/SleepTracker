import {
    createExecutionContext,
    env,
    SELF,
    waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker, { executeTool } from "../src";

describe("recommendation worker", () => {
	it("serves the SleepTracker landing page at the root URL", async () => {
		const response = await SELF.fetch("http://example.com/");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		const page = await response.text();
		expect(page).toContain("SleepTracker");
		expect(page).toContain('href="/status"');
		expect(page).toContain("people with insomnia symptoms");
		expect(page).toContain("Support, not a diagnosis.");
	});

	it("serves a human-readable service status page", async () => {
		const response = await SELF.fetch("http://example.com/status");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(await response.text()).toContain("All systems operational");
	});

	it("returns a healthy status (unit style)", async () => {
		const request = new Request("http://example.com/health");
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok" });
	});

	it("returns a healthy status (integration style)", async () => {
		const response = await SELF.fetch("http://example.com/health");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok" });
	});

	it("limits sleep history to the requested recent sessions", () => {
		const result = executeTool("get_sleep_history", '{"days":2}', {
			recentSessions: [
				{ start: "2026-08-01T22:00:00Z", duration: 6 },
				{ start: "2026-08-02T22:30:00Z", duration: 7 },
				{ start: "2026-08-03T23:00:00Z", duration: 8 },
			],
		});
		expect(result.sessions).toEqual([
			{ start: "2026-08-02T22:30:00Z", duration: 7 },
			{ start: "2026-08-03T23:00:00Z", duration: 8 },
		]);
	});

	it("calculates average stats from request-scoped sessions", () => {
		const result = executeTool("get_average_stats", "{}", {
			recentSessions: [
				{ start: "2026-08-01T22:00:00Z", duration: 6 },
				{ start: "2026-08-02T23:00:00Z", duration: 8 },
			],
		});
		expect(result).toEqual({ sessionCount: 2, averageDurationHours: 7, averageBedtimeUtc: "22:30" });
	});

	it("returns a static sleep tip without external storage", () => {
		const result = executeTool("search_sleep_tips", '{"topic":"caffeine"}', {});
		expect(result).toEqual({
			topic: "caffeine",
			tip: "If you use caffeine, keep it earlier in the day and switch to water or decaf later on.",
		});
	});
});
