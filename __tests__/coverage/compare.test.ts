import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { compareCoverage, normalizePath } from "../../src/coverage/compare.js";
import type {
	CoverageSummary,
	FileCoverage,
} from "../../src/coverage/types.js";

function makeFileCoverage(
	filePath: string,
	overrides: Partial<FileCoverage> = {},
): FileCoverage {
	return {
		filePath,
		lineRate: 80,
		branchRate: 70,
		functionRate: 90,
		linesFound: 100,
		linesHit: 80,
		branchesFound: 50,
		branchesHit: 35,
		functionsFound: 20,
		functionsHit: 18,
		...overrides,
	};
}

function makeSummary(
	files: FileCoverage[],
	overall?: Partial<FileCoverage>,
): CoverageSummary {
	const fileMap = new Map<string, FileCoverage>();
	for (const f of files) {
		fileMap.set(f.filePath, f);
	}
	return {
		files: fileMap,
		overall: makeFileCoverage("overall", overall),
	};
}

describe("normalizePath", () => {
	let savedWorkspace: string | undefined;

	beforeEach(() => {
		savedWorkspace = process.env.GITHUB_WORKSPACE;
	});

	afterEach(() => {
		if (savedWorkspace !== undefined) {
			process.env.GITHUB_WORKSPACE = savedWorkspace;
		} else {
			process.env.GITHUB_WORKSPACE = undefined;
		}
	});

	test("strips GITHUB_WORKSPACE prefix", () => {
		process.env.GITHUB_WORKSPACE = "/home/runner/work/my-repo";
		expect(normalizePath("/home/runner/work/my-repo/src/index.ts")).toBe(
			"src/index.ts",
		);
	});

	test("strips GITHUB_WORKSPACE with trailing slash", () => {
		process.env.GITHUB_WORKSPACE = "/home/runner/work/my-repo/";
		expect(normalizePath("/home/runner/work/my-repo/src/index.ts")).toBe(
			"src/index.ts",
		);
	});

	test("strips leading ./", () => {
		process.env.GITHUB_WORKSPACE = undefined;
		expect(normalizePath("./src/index.ts")).toBe("src/index.ts");
	});

	test("strips leading /", () => {
		process.env.GITHUB_WORKSPACE = undefined;
		expect(normalizePath("/src/index.ts")).toBe("src/index.ts");
	});

	test("normalizes backslash separators", () => {
		process.env.GITHUB_WORKSPACE = undefined;
		expect(normalizePath("src\\coverage\\compare.ts")).toBe(
			"src/coverage/compare.ts",
		);
	});

	test("handles GITHUB_WORKSPACE with backslashes", () => {
		process.env.GITHUB_WORKSPACE = "C:\\Users\\runner\\work\\repo";
		expect(normalizePath("C:\\Users\\runner\\work\\repo\\src\\index.ts")).toBe(
			"src/index.ts",
		);
	});

	test("does not strip partial prefix match", () => {
		process.env.GITHUB_WORKSPACE = "/home/runner/work/my-repo";
		expect(normalizePath("/home/runner/work/my-repo-other/src/index.ts")).toBe(
			"home/runner/work/my-repo-other/src/index.ts",
		);
	});

	test("returns empty string for exact workspace path", () => {
		process.env.GITHUB_WORKSPACE = "/home/runner/work/my-repo";
		expect(normalizePath("/home/runner/work/my-repo")).toBe("");
	});
});

describe("compareCoverage", () => {
	let savedWorkspace: string | undefined;

	beforeEach(() => {
		savedWorkspace = process.env.GITHUB_WORKSPACE;
		process.env.GITHUB_WORKSPACE = undefined;
	});

	afterEach(() => {
		if (savedWorkspace !== undefined) {
			process.env.GITHUB_WORKSPACE = savedWorkspace;
		} else {
			process.env.GITHUB_WORKSPACE = undefined;
		}
	});

	test("identical coverage produces all unchanged", () => {
		const fileA = makeFileCoverage("src/a.ts");
		const fileB = makeFileCoverage("src/b.ts");

		const head = makeSummary([fileA, fileB]);
		const base = makeSummary([fileA, fileB]);

		const result = compareCoverage(head, base);

		expect(result.files).toHaveLength(2);
		for (const delta of result.files) {
			expect(delta.status).toBe("unchanged");
			expect(delta.lineRateDelta).toBe(0);
			expect(delta.branchRateDelta).toBe(0);
			expect(delta.functionRateDelta).toBe(0);
		}
		expect(result.overallDelta.lineRateDelta).toBe(0);
		expect(result.overallDelta.branchRateDelta).toBe(0);
		expect(result.overallDelta.functionRateDelta).toBe(0);
	});

	test("improved coverage produces positive deltas", () => {
		const headFile = makeFileCoverage("src/a.ts", {
			lineRate: 90,
			branchRate: 85,
			functionRate: 95,
		});
		const baseFile = makeFileCoverage("src/a.ts", {
			lineRate: 80,
			branchRate: 70,
			functionRate: 90,
		});

		const head = makeSummary([headFile], { lineRate: 90 });
		const base = makeSummary([baseFile], { lineRate: 80 });

		const result = compareCoverage(head, base);

		expect(result.files).toHaveLength(1);
		const delta = result.files[0];
		expect(delta.status).toBe("changed");
		expect(delta.lineRateDelta).toBe(10);
		expect(delta.branchRateDelta).toBe(15);
		expect(delta.functionRateDelta).toBe(5);
		expect(result.overallDelta.lineRateDelta).toBe(10);
	});

	test("reduced coverage produces negative deltas", () => {
		const headFile = makeFileCoverage("src/a.ts", {
			lineRate: 60,
			branchRate: 50,
			functionRate: 70,
		});
		const baseFile = makeFileCoverage("src/a.ts", {
			lineRate: 80,
			branchRate: 70,
			functionRate: 90,
		});

		const head = makeSummary([headFile], { lineRate: 60 });
		const base = makeSummary([baseFile], { lineRate: 80 });

		const result = compareCoverage(head, base);

		expect(result.files).toHaveLength(1);
		const delta = result.files[0];
		expect(delta.status).toBe("changed");
		expect(delta.lineRateDelta).toBe(-20);
		expect(delta.branchRateDelta).toBe(-20);
		expect(delta.functionRateDelta).toBe(-20);
		expect(result.overallDelta.lineRateDelta).toBe(-20);
	});

	test("new files are marked as added with null deltas", () => {
		const headFile = makeFileCoverage("src/new.ts");

		const head = makeSummary([headFile]);
		const base = makeSummary([]);

		const result = compareCoverage(head, base);

		expect(result.files).toHaveLength(1);
		const delta = result.files[0];
		expect(delta.status).toBe("added");
		expect(delta.base).toBeNull();
		expect(delta.lineRateDelta).toBeNull();
		expect(delta.branchRateDelta).toBeNull();
		expect(delta.functionRateDelta).toBeNull();
	});

	test("removed files are marked with zero-coverage head and negative deltas", () => {
		const baseFile = makeFileCoverage("src/old.ts", {
			lineRate: 75,
			branchRate: 60,
			functionRate: 85,
		});

		const head = makeSummary([]);
		const base = makeSummary([baseFile]);

		const result = compareCoverage(head, base);

		expect(result.files).toHaveLength(1);
		const delta = result.files[0];
		expect(delta.status).toBe("removed");
		expect(delta.head.lineRate).toBe(0);
		expect(delta.head.branchRate).toBe(0);
		expect(delta.head.functionRate).toBe(0);
		expect(delta.lineRateDelta).toBe(-75);
		expect(delta.branchRateDelta).toBe(-60);
		expect(delta.functionRateDelta).toBe(-85);
	});

	test("null base produces null overall deltas and all files as added", () => {
		const headFile = makeFileCoverage("src/a.ts");

		const head = makeSummary([headFile]);

		const result = compareCoverage(head, null);

		expect(result.baseSummary).toBeNull();
		expect(result.overallDelta.lineRateDelta).toBeNull();
		expect(result.overallDelta.branchRateDelta).toBeNull();
		expect(result.overallDelta.functionRateDelta).toBeNull();

		expect(result.files).toHaveLength(1);
		expect(result.files[0].status).toBe("added");
		expect(result.files[0].lineRateDelta).toBeNull();
	});

	test("path normalization matches files across head and base", () => {
		process.env.GITHUB_WORKSPACE = "/home/runner/work/repo";

		const headFile = makeFileCoverage("/home/runner/work/repo/src/index.ts", {
			lineRate: 90,
		});
		const baseFile = makeFileCoverage("./src/index.ts", { lineRate: 80 });

		const head = makeSummary([headFile]);
		const base = makeSummary([baseFile]);

		const result = compareCoverage(head, base);

		expect(result.files).toHaveLength(1);
		const delta = result.files[0];
		expect(delta.status).toBe("changed");
		expect(delta.lineRateDelta).toBe(10);
		expect(delta.filePath).toBe("src/index.ts");
	});

	test("sort order: changed > added > removed > unchanged", () => {
		const changedHead = makeFileCoverage("src/changed.ts", { lineRate: 90 });
		const changedBase = makeFileCoverage("src/changed.ts", { lineRate: 80 });

		const unchangedFile = makeFileCoverage("src/same.ts");

		const addedFile = makeFileCoverage("src/new.ts");

		const removedFile = makeFileCoverage("src/old.ts", { lineRate: 70 });

		const head = makeSummary([changedHead, unchangedFile, addedFile]);
		const base = makeSummary([changedBase, unchangedFile, removedFile]);

		const result = compareCoverage(head, base);

		expect(result.files).toHaveLength(4);
		expect(result.files[0].status).toBe("changed");
		expect(result.files[0].filePath).toBe("src/changed.ts");
		expect(result.files[1].status).toBe("added");
		expect(result.files[1].filePath).toBe("src/new.ts");
		expect(result.files[2].status).toBe("removed");
		expect(result.files[2].filePath).toBe("src/old.ts");
		expect(result.files[3].status).toBe("unchanged");
		expect(result.files[3].filePath).toBe("src/same.ts");
	});

	test("changed files sort by absolute lineRateDelta descending", () => {
		const smallChangeHead = makeFileCoverage("src/small.ts", {
			lineRate: 82,
		});
		const smallChangeBase = makeFileCoverage("src/small.ts", {
			lineRate: 80,
		});

		const bigDropHead = makeFileCoverage("src/big-drop.ts", {
			lineRate: 50,
		});
		const bigDropBase = makeFileCoverage("src/big-drop.ts", {
			lineRate: 80,
		});

		const mediumGainHead = makeFileCoverage("src/medium.ts", {
			lineRate: 95,
		});
		const mediumGainBase = makeFileCoverage("src/medium.ts", {
			lineRate: 80,
		});

		const head = makeSummary([smallChangeHead, bigDropHead, mediumGainHead]);
		const base = makeSummary([smallChangeBase, bigDropBase, mediumGainBase]);

		const result = compareCoverage(head, base);

		const changedFiles = result.files.filter((f) => f.status === "changed");
		expect(changedFiles).toHaveLength(3);
		// |delta|: big-drop=30, medium=15, small=2
		expect(changedFiles[0].filePath).toBe("src/big-drop.ts");
		expect(changedFiles[1].filePath).toBe("src/medium.ts");
		expect(changedFiles[2].filePath).toBe("src/small.ts");
	});

	test("headSummary and baseSummary are returned in result", () => {
		const head = makeSummary([makeFileCoverage("src/a.ts")]);
		const base = makeSummary([makeFileCoverage("src/a.ts")]);

		const result = compareCoverage(head, base);

		expect(result.headSummary).toBe(head);
		expect(result.baseSummary).toBe(base);
	});
});
