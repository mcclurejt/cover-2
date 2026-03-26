import { describe, expect, test } from "bun:test";
import { summarizeFiles } from "../../src/coverage/summarize.js";
import type { LcovFile } from "../../src/lcov/types.js";

function makeLcovFile(
	overrides: Partial<LcovFile> & { filePath: string },
): LcovFile {
	return {
		lines: [],
		linesFound: 0,
		linesHit: 0,
		branches: [],
		branchesFound: 0,
		branchesHit: 0,
		functions: [],
		functionsFound: 0,
		functionsHit: 0,
		...overrides,
	};
}

describe("summarizeFiles", () => {
	test("summarizes a single file", () => {
		const files: LcovFile[] = [
			makeLcovFile({
				filePath: "src/app.ts",
				linesFound: 10,
				linesHit: 8,
				branchesFound: 4,
				branchesHit: 3,
				functionsFound: 2,
				functionsHit: 2,
			}),
		];

		const result = summarizeFiles(files);

		expect(result.files.size).toBe(1);

		const fileCov = result.files.get("src/app.ts");
		expect(fileCov).toBeDefined();
		expect(fileCov?.lineRate).toBe(80);
		expect(fileCov?.branchRate).toBe(75);
		expect(fileCov?.functionRate).toBe(100);
		expect(fileCov?.linesFound).toBe(10);
		expect(fileCov?.linesHit).toBe(8);

		expect(result.overall.lineRate).toBe(80);
		expect(result.overall.branchRate).toBe(75);
		expect(result.overall.functionRate).toBe(100);
	});

	test("computes overall stats across multiple files", () => {
		const files: LcovFile[] = [
			makeLcovFile({
				filePath: "src/a.ts",
				linesFound: 10,
				linesHit: 8,
				branchesFound: 4,
				branchesHit: 2,
				functionsFound: 3,
				functionsHit: 3,
			}),
			makeLcovFile({
				filePath: "src/b.ts",
				linesFound: 20,
				linesHit: 10,
				branchesFound: 6,
				branchesHit: 6,
				functionsFound: 5,
				functionsHit: 1,
			}),
		];

		const result = summarizeFiles(files);

		expect(result.files.size).toBe(2);

		// overall: 18/30 lines, 8/10 branches, 4/8 functions
		expect(result.overall.linesFound).toBe(30);
		expect(result.overall.linesHit).toBe(18);
		expect(result.overall.lineRate).toBe(60);

		expect(result.overall.branchesFound).toBe(10);
		expect(result.overall.branchesHit).toBe(8);
		expect(result.overall.branchRate).toBe(80);

		expect(result.overall.functionsFound).toBe(8);
		expect(result.overall.functionsHit).toBe(4);
		expect(result.overall.functionRate).toBe(50);
	});

	test("merges duplicate file entries from parallel test shards", () => {
		const files: LcovFile[] = [
			makeLcovFile({
				filePath: "src/shared.ts",
				linesFound: 10,
				linesHit: 5,
				branchesFound: 2,
				branchesHit: 1,
				functionsFound: 3,
				functionsHit: 2,
			}),
			makeLcovFile({
				filePath: "src/shared.ts",
				linesFound: 10,
				linesHit: 7,
				branchesFound: 2,
				branchesHit: 2,
				functionsFound: 3,
				functionsHit: 3,
			}),
		];

		const result = summarizeFiles(files);

		expect(result.files.size).toBe(1);

		const merged = result.files.get("src/shared.ts");
		expect(merged).toBeDefined();
		expect(merged?.linesFound).toBe(20);
		expect(merged?.linesHit).toBe(12);
		expect(merged?.lineRate).toBe(60);
		expect(merged?.branchesFound).toBe(4);
		expect(merged?.branchesHit).toBe(3);
		expect(merged?.branchRate).toBe(75);
		expect(merged?.functionsFound).toBe(6);
		expect(merged?.functionsHit).toBe(5);
		expect(merged?.functionRate).toBeCloseTo(83.333, 2);
	});

	test("handles file with zero lines found (division by zero)", () => {
		const files: LcovFile[] = [
			makeLcovFile({
				filePath: "src/empty.ts",
				linesFound: 0,
				linesHit: 0,
				branchesFound: 0,
				branchesHit: 0,
				functionsFound: 0,
				functionsHit: 0,
			}),
		];

		const result = summarizeFiles(files);

		const fileCov = result.files.get("src/empty.ts");
		expect(fileCov).toBeDefined();
		expect(fileCov?.lineRate).toBe(100);
		expect(fileCov?.branchRate).toBe(100);
		expect(fileCov?.functionRate).toBe(100);

		expect(result.overall.lineRate).toBe(100);
		expect(result.overall.branchRate).toBe(100);
		expect(result.overall.functionRate).toBe(100);
	});

	test("handles empty input", () => {
		const result = summarizeFiles([]);

		expect(result.files.size).toBe(0);
		expect(result.overall.linesFound).toBe(0);
		expect(result.overall.linesHit).toBe(0);
		expect(result.overall.lineRate).toBe(100);
		expect(result.overall.branchRate).toBe(100);
		expect(result.overall.functionRate).toBe(100);
		expect(result.overall.filePath).toBe("");
	});

	test("mixed zero and non-zero files compute correct overall", () => {
		const files: LcovFile[] = [
			makeLcovFile({
				filePath: "src/empty.ts",
				linesFound: 0,
				linesHit: 0,
			}),
			makeLcovFile({
				filePath: "src/real.ts",
				linesFound: 50,
				linesHit: 25,
				branchesFound: 10,
				branchesHit: 5,
				functionsFound: 4,
				functionsHit: 4,
			}),
		];

		const result = summarizeFiles(files);

		expect(result.files.size).toBe(2);

		// Overall should reflect the non-zero file's counts
		expect(result.overall.linesFound).toBe(50);
		expect(result.overall.linesHit).toBe(25);
		expect(result.overall.lineRate).toBe(50);
		expect(result.overall.branchRate).toBe(50);
		expect(result.overall.functionRate).toBe(100);
	});
});
