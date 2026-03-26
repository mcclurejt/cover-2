import { describe, expect, it } from "bun:test";
import type {
	CoverageComparison,
	CoverageSummary,
	FileDelta,
} from "../../src/coverage/types.js";
import {
	type ReportOptions,
	generateReport,
} from "../../src/report/markdown.js";

function makeCoverage(
	overrides: Partial<FileDelta["head"]> = {},
): FileDelta["head"] {
	return {
		filePath: "src/index.ts",
		lineRate: 80,
		branchRate: 70,
		functionRate: 90,
		linesFound: 100,
		linesHit: 80,
		branchesFound: 10,
		branchesHit: 7,
		functionsFound: 5,
		functionsHit: 4,
		...overrides,
	};
}

function makeSummary(files: FileDelta["head"][]): CoverageSummary {
	const map = new Map<string, FileDelta["head"]>();
	for (const f of files) {
		map.set(f.filePath, f);
	}
	const totalLF = files.reduce((s, f) => s + f.linesFound, 0);
	const totalLH = files.reduce((s, f) => s + f.linesHit, 0);
	const totalBF = files.reduce((s, f) => s + f.branchesFound, 0);
	const totalBH = files.reduce((s, f) => s + f.branchesHit, 0);
	const totalFF = files.reduce((s, f) => s + f.functionsFound, 0);
	const totalFH = files.reduce((s, f) => s + f.functionsHit, 0);
	return {
		files: map,
		overall: {
			filePath: "",
			lineRate: totalLF > 0 ? (totalLH / totalLF) * 100 : 100,
			branchRate: totalBF > 0 ? (totalBH / totalBF) * 100 : 100,
			functionRate: totalFF > 0 ? (totalFH / totalFF) * 100 : 100,
			linesFound: totalLF,
			linesHit: totalLH,
			branchesFound: totalBF,
			branchesHit: totalBH,
			functionsFound: totalFF,
			functionsHit: totalFH,
		},
	};
}

const defaultOptions: ReportOptions = {
	header: "coverage",
	thresholds: { lower: 60, upper: 80 },
	showBadge: true,
	showBranchCoverage: true,
	showFunctionCoverage: false,
	showUnchangedFiles: false,
};

describe("generateReport", () => {
	it("includes the hidden marker", () => {
		const head = makeCoverage();
		const comparison: CoverageComparison = {
			files: [
				{
					filePath: "src/index.ts",
					head,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				},
			],
			overallDelta: {
				lineRateDelta: null,
				branchRateDelta: null,
				functionRateDelta: null,
			},
			headSummary: makeSummary([head]),
			baseSummary: null,
		};
		const report = generateReport(comparison, defaultOptions);
		expect(report).toContain("<!-- coverage-report:coverage -->");
	});

	it("includes badge when enabled", () => {
		const head = makeCoverage();
		const comparison: CoverageComparison = {
			files: [
				{
					filePath: "src/index.ts",
					head,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				},
			],
			overallDelta: {
				lineRateDelta: null,
				branchRateDelta: null,
				functionRateDelta: null,
			},
			headSummary: makeSummary([head]),
			baseSummary: null,
		};
		const report = generateReport(comparison, defaultOptions);
		expect(report).toContain("![Coverage](https://img.shields.io/badge/");
	});

	it("omits badge when disabled", () => {
		const head = makeCoverage();
		const comparison: CoverageComparison = {
			files: [
				{
					filePath: "src/index.ts",
					head,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				},
			],
			overallDelta: {
				lineRateDelta: null,
				branchRateDelta: null,
				functionRateDelta: null,
			},
			headSummary: makeSummary([head]),
			baseSummary: null,
		};
		const report = generateReport(comparison, {
			...defaultOptions,
			showBadge: false,
		});
		expect(report).not.toContain("![Coverage]");
	});

	it("shows delta column when base is provided", () => {
		const head = makeCoverage({ filePath: "src/a.ts", lineRate: 85 });
		const base = makeCoverage({ filePath: "src/a.ts", lineRate: 80 });
		const comparison: CoverageComparison = {
			files: [
				{
					filePath: "src/a.ts",
					head,
					base,
					lineRateDelta: 5,
					branchRateDelta: 0,
					functionRateDelta: 0,
					status: "changed",
				},
			],
			overallDelta: {
				lineRateDelta: 5,
				branchRateDelta: 0,
				functionRateDelta: 0,
			},
			headSummary: makeSummary([head]),
			baseSummary: makeSummary([base]),
		};
		const report = generateReport(comparison, defaultOptions);
		expect(report).toContain("| Delta |");
		expect(report).toContain("+5.00%");
	});

	it("omits delta column when no base", () => {
		const head = makeCoverage();
		const comparison: CoverageComparison = {
			files: [
				{
					filePath: "src/index.ts",
					head,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				},
			],
			overallDelta: {
				lineRateDelta: null,
				branchRateDelta: null,
				functionRateDelta: null,
			},
			headSummary: makeSummary([head]),
			baseSummary: null,
		};
		const report = generateReport(comparison, defaultOptions);
		expect(report).not.toContain("| Delta |");
	});

	it("shows new files with *new* delta", () => {
		const head = makeCoverage({ filePath: "src/new.ts" });
		const base = makeCoverage({ filePath: "src/old.ts" });
		const comparison: CoverageComparison = {
			files: [
				{
					filePath: "src/new.ts",
					head,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				},
			],
			overallDelta: {
				lineRateDelta: 5,
				branchRateDelta: 0,
				functionRateDelta: 0,
			},
			headSummary: makeSummary([head]),
			baseSummary: makeSummary([base]),
		};
		const report = generateReport(comparison, defaultOptions);
		expect(report).toContain("*new*");
	});

	it("hides branch coverage when disabled", () => {
		const head = makeCoverage();
		const comparison: CoverageComparison = {
			files: [
				{
					filePath: "src/index.ts",
					head,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				},
			],
			overallDelta: {
				lineRateDelta: null,
				branchRateDelta: null,
				functionRateDelta: null,
			},
			headSummary: makeSummary([head]),
			baseSummary: null,
		};
		const report = generateReport(comparison, {
			...defaultOptions,
			showBranchCoverage: false,
		});
		expect(report).not.toContain("Branches");
	});

	it("shows function coverage when enabled", () => {
		const head = makeCoverage();
		const comparison: CoverageComparison = {
			files: [
				{
					filePath: "src/index.ts",
					head,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				},
			],
			overallDelta: {
				lineRateDelta: null,
				branchRateDelta: null,
				functionRateDelta: null,
			},
			headSummary: makeSummary([head]),
			baseSummary: null,
		};
		const report = generateReport(comparison, {
			...defaultOptions,
			showFunctionCoverage: true,
		});
		expect(report).toContain("Functions");
	});

	it("puts unchanged files in collapsible section by default", () => {
		const head = makeCoverage({ filePath: "src/stable.ts" });
		const base = makeCoverage({ filePath: "src/stable.ts" });
		const comparison: CoverageComparison = {
			files: [
				{
					filePath: "src/stable.ts",
					head,
					base,
					lineRateDelta: 0,
					branchRateDelta: 0,
					functionRateDelta: 0,
					status: "unchanged",
				},
			],
			overallDelta: {
				lineRateDelta: 0,
				branchRateDelta: 0,
				functionRateDelta: 0,
			},
			headSummary: makeSummary([head]),
			baseSummary: makeSummary([base]),
		};
		const report = generateReport(comparison, defaultOptions);
		expect(report).toContain("<details>");
		expect(report).toContain("1 unchanged file");
	});

	it("shows unchanged files inline when option enabled", () => {
		const head = makeCoverage({ filePath: "src/stable.ts" });
		const base = makeCoverage({ filePath: "src/stable.ts" });
		const comparison: CoverageComparison = {
			files: [
				{
					filePath: "src/stable.ts",
					head,
					base,
					lineRateDelta: 0,
					branchRateDelta: 0,
					functionRateDelta: 0,
					status: "unchanged",
				},
			],
			overallDelta: {
				lineRateDelta: 0,
				branchRateDelta: 0,
				functionRateDelta: 0,
			},
			headSummary: makeSummary([head]),
			baseSummary: makeSummary([base]),
		};
		const report = generateReport(comparison, {
			...defaultOptions,
			showUnchangedFiles: true,
		});
		expect(report).not.toContain("<details>");
		expect(report).toContain("`src/stable.ts`");
	});

	it("shows correct health icons", () => {
		const good = makeCoverage({ filePath: "src/good.ts", lineRate: 90 });
		const mid = makeCoverage({ filePath: "src/mid.ts", lineRate: 70 });
		const bad = makeCoverage({ filePath: "src/bad.ts", lineRate: 40 });
		const comparison: CoverageComparison = {
			files: [
				{
					filePath: "src/good.ts",
					head: good,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				},
				{
					filePath: "src/mid.ts",
					head: mid,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				},
				{
					filePath: "src/bad.ts",
					head: bad,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				},
			],
			overallDelta: {
				lineRateDelta: null,
				branchRateDelta: null,
				functionRateDelta: null,
			},
			headSummary: makeSummary([good, mid, bad]),
			baseSummary: null,
		};
		const report = generateReport(comparison, defaultOptions);
		expect(report).toContain(":white_check_mark:");
		expect(report).toContain(":warning:");
		expect(report).toContain(":x:");
	});

	it("handles empty coverage", () => {
		const comparison: CoverageComparison = {
			files: [],
			overallDelta: {
				lineRateDelta: null,
				branchRateDelta: null,
				functionRateDelta: null,
			},
			headSummary: {
				files: new Map(),
				overall: {
					filePath: "",
					lineRate: 100,
					branchRate: 100,
					functionRate: 100,
					linesFound: 0,
					linesHit: 0,
					branchesFound: 0,
					branchesHit: 0,
					functionsFound: 0,
					functionsHit: 0,
				},
			},
			baseSummary: null,
		};
		const report = generateReport(comparison, defaultOptions);
		expect(report).toContain("No coverage data found.");
	});
});
