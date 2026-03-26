import { describe, expect, it, mock } from "bun:test";
import { fetchBaseline, saveBaseline } from "../../src/github/baseline.js";

function createMockOctokit({
	getContentResult = null,
	getContentError = null,
	getBranchError = null,
}: {
	getContentResult?: { content: string; sha: string; type: string } | null;
	getContentError?: { status: number } | null;
	getBranchError?: { status: number } | null;
} = {}) {
	const createOrUpdateFileContents = mock(() => Promise.resolve());
	const getContent = mock(() => {
		if (getContentError) return Promise.reject(getContentError);
		if (getContentResult) return Promise.resolve({ data: getContentResult });
		return Promise.reject({ status: 404 });
	});
	const getBranch = mock(() => {
		if (getBranchError) return Promise.reject(getBranchError);
		return Promise.resolve({ data: { name: "coverage-baseline" } });
	});
	const get = mock(() => Promise.resolve({ data: { default_branch: "main" } }));
	const getRef = mock(() =>
		Promise.resolve({ data: { object: { sha: "main-sha" } } }),
	);
	const createRef = mock(() => Promise.resolve());

	return {
		rest: {
			repos: {
				createOrUpdateFileContents,
				getContent,
				getBranch,
				get,
			},
			git: {
				getRef,
				createRef,
			},
		},
		_mocks: {
			createOrUpdateFileContents,
			getContent,
			getBranch,
			get,
			getRef,
			createRef,
		},
	} as unknown as ReturnType<typeof createMockOctokit> & {
		_mocks: Record<string, ReturnType<typeof mock>>;
	};
}

describe("fetchBaseline", () => {
	it("returns LCOV content when baseline exists", async () => {
		const content = "SF:src/index.ts\nend_of_record\n";
		const octokit = createMockOctokit({
			getContentResult: {
				content: Buffer.from(content).toString("base64"),
				sha: "abc123",
				type: "file",
			},
		});

		const result = await fetchBaseline(
			octokit as Parameters<typeof fetchBaseline>[0],
			"owner",
			"repo",
			"coverage-baseline",
		);
		expect(result).toBe(content);
	});

	it("returns null when branch does not exist", async () => {
		const octokit = createMockOctokit({
			getContentError: { status: 404 },
		});

		const result = await fetchBaseline(
			octokit as Parameters<typeof fetchBaseline>[0],
			"owner",
			"repo",
			"coverage-baseline",
		);
		expect(result).toBeNull();
	});

	it("returns null when file does not exist", async () => {
		const octokit = createMockOctokit({
			getContentError: { status: 404 },
		});

		const result = await fetchBaseline(
			octokit as Parameters<typeof fetchBaseline>[0],
			"owner",
			"repo",
			"coverage-baseline",
		);
		expect(result).toBeNull();
	});

	it("throws on non-404 errors", async () => {
		const octokit = createMockOctokit({
			getContentError: { status: 500 },
		});

		expect(
			fetchBaseline(
				octokit as Parameters<typeof fetchBaseline>[0],
				"owner",
				"repo",
				"coverage-baseline",
			),
		).rejects.toEqual({ status: 500 });
	});
});

describe("saveBaseline", () => {
	it("updates existing file when baseline branch and file exist", async () => {
		const octokit = createMockOctokit({
			getContentResult: {
				content: Buffer.from("old content").toString("base64"),
				sha: "old-sha",
				type: "file",
			},
		});

		await saveBaseline(
			octokit as Parameters<typeof saveBaseline>[0],
			"owner",
			"repo",
			"coverage-baseline",
			"new content",
		);

		expect(octokit._mocks.createOrUpdateFileContents).toHaveBeenCalledTimes(1);
		const call = (
			octokit._mocks.createOrUpdateFileContents as ReturnType<typeof mock>
		).mock.calls[0] as unknown[];
		const args = call[0] as Record<string, unknown>;
		expect(args.sha).toBe("old-sha");
		expect(args.branch).toBe("coverage-baseline");
	});

	it("creates branch and file when branch does not exist", async () => {
		const octokit = createMockOctokit({
			getContentError: { status: 404 },
			getBranchError: { status: 404 },
		});

		await saveBaseline(
			octokit as Parameters<typeof saveBaseline>[0],
			"owner",
			"repo",
			"coverage-baseline",
			"new content",
		);

		// Should get default branch info and create ref
		expect(octokit._mocks.get).toHaveBeenCalledTimes(1);
		expect(octokit._mocks.getRef).toHaveBeenCalledTimes(1);
		expect(octokit._mocks.createRef).toHaveBeenCalledTimes(1);
		expect(octokit._mocks.createOrUpdateFileContents).toHaveBeenCalledTimes(1);
	});

	it("creates file on existing branch when file does not exist", async () => {
		const octokit = createMockOctokit({
			getContentError: { status: 404 },
		});

		await saveBaseline(
			octokit as Parameters<typeof saveBaseline>[0],
			"owner",
			"repo",
			"coverage-baseline",
			"new content",
		);

		// Branch exists, so no branch creation
		expect(octokit._mocks.createRef).not.toHaveBeenCalled();
		expect(octokit._mocks.createOrUpdateFileContents).toHaveBeenCalledTimes(1);
	});
});
