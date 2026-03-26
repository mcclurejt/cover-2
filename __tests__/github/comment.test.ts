import { describe, expect, it, mock } from "bun:test";
import {
	findComment,
	markerFor,
	upsertComment,
} from "../../src/github/comment.js";

function createMockOctokit(comments: Array<{ id: number; body: string }>) {
	const listComments = mock(() => {});
	const createComment = mock(() => Promise.resolve({ data: { id: 999 } }));
	const updateComment = mock(() =>
		Promise.resolve({ data: { id: comments[0]?.id ?? 999 } }),
	);

	return {
		paginate: {
			iterator: (_method: unknown, _params: unknown) => {
				return (async function* () {
					yield { data: comments };
				})();
			},
		},
		rest: {
			issues: {
				listComments,
				createComment,
				updateComment,
			},
		},
	} as unknown as Parameters<typeof findComment>[0];
}

describe("markerFor", () => {
	it("returns the expected marker string", () => {
		expect(markerFor("coverage")).toBe("<!-- coverage-report:coverage -->");
		expect(markerFor("unit-tests")).toBe("<!-- coverage-report:unit-tests -->");
	});
});

describe("findComment", () => {
	it("returns matching comment", async () => {
		const octokit = createMockOctokit([
			{ id: 1, body: "unrelated comment" },
			{ id: 2, body: "<!-- coverage-report:coverage -->\n## Coverage Report" },
		]);
		const result = await findComment(octokit, "owner", "repo", 1, "coverage");
		expect(result).not.toBeNull();
		expect(result?.id).toBe(2);
	});

	it("returns null when no matching comment", async () => {
		const octokit = createMockOctokit([
			{ id: 1, body: "just a regular comment" },
		]);
		const result = await findComment(octokit, "owner", "repo", 1, "coverage");
		expect(result).toBeNull();
	});

	it("returns null for empty comment list", async () => {
		const octokit = createMockOctokit([]);
		const result = await findComment(octokit, "owner", "repo", 1, "coverage");
		expect(result).toBeNull();
	});

	it("distinguishes between different headers", async () => {
		const octokit = createMockOctokit([
			{ id: 1, body: "<!-- coverage-report:unit -->\n## Unit" },
		]);
		const result = await findComment(
			octokit,
			"owner",
			"repo",
			1,
			"integration",
		);
		expect(result).toBeNull();
	});
});

describe("upsertComment", () => {
	it("creates new comment when none exists", async () => {
		const octokit = createMockOctokit([]);
		const id = await upsertComment(
			octokit,
			"owner",
			"repo",
			1,
			"body",
			"coverage",
		);
		expect(id).toBe(999);
		expect(octokit.rest.issues.createComment).toHaveBeenCalledTimes(1);
	});

	it("updates existing comment", async () => {
		const octokit = createMockOctokit([
			{ id: 42, body: "<!-- coverage-report:coverage -->\nold report" },
		]);
		const id = await upsertComment(
			octokit,
			"owner",
			"repo",
			1,
			"new body",
			"coverage",
		);
		expect(id).toBe(42);
		expect(octokit.rest.issues.updateComment).toHaveBeenCalledTimes(1);
	});
});
