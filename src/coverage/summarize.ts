import type { LcovFile } from "../lcov/types.js";
import type { CoverageSummary, FileCoverage } from "./types.js";

function computeRate(hit: number, found: number): number {
	if (found === 0) return 100;
	return (hit / found) * 100;
}

function toFileCoverage(file: LcovFile): FileCoverage {
	return {
		filePath: file.filePath,
		lineRate: computeRate(file.linesHit, file.linesFound),
		branchRate: computeRate(file.branchesHit, file.branchesFound),
		functionRate: computeRate(file.functionsHit, file.functionsFound),
		linesFound: file.linesFound,
		linesHit: file.linesHit,
		branchesFound: file.branchesFound,
		branchesHit: file.branchesHit,
		functionsFound: file.functionsFound,
		functionsHit: file.functionsHit,
	};
}

function mergeCoverage(a: FileCoverage, b: FileCoverage): FileCoverage {
	const linesFound = a.linesFound + b.linesFound;
	const linesHit = a.linesHit + b.linesHit;
	const branchesFound = a.branchesFound + b.branchesFound;
	const branchesHit = a.branchesHit + b.branchesHit;
	const functionsFound = a.functionsFound + b.functionsFound;
	const functionsHit = a.functionsHit + b.functionsHit;

	return {
		filePath: a.filePath,
		lineRate: computeRate(linesHit, linesFound),
		branchRate: computeRate(branchesHit, branchesFound),
		functionRate: computeRate(functionsHit, functionsFound),
		linesFound,
		linesHit,
		branchesFound,
		branchesHit,
		functionsFound,
		functionsHit,
	};
}

export function summarizeFiles(files: LcovFile[]): CoverageSummary {
	const fileMap = new Map<string, FileCoverage>();

	for (const file of files) {
		const coverage = toFileCoverage(file);
		const existing = fileMap.get(file.filePath);

		if (existing) {
			fileMap.set(file.filePath, mergeCoverage(existing, coverage));
		} else {
			fileMap.set(file.filePath, coverage);
		}
	}

	let totalLinesFound = 0;
	let totalLinesHit = 0;
	let totalBranchesFound = 0;
	let totalBranchesHit = 0;
	let totalFunctionsFound = 0;
	let totalFunctionsHit = 0;

	for (const coverage of fileMap.values()) {
		totalLinesFound += coverage.linesFound;
		totalLinesHit += coverage.linesHit;
		totalBranchesFound += coverage.branchesFound;
		totalBranchesHit += coverage.branchesHit;
		totalFunctionsFound += coverage.functionsFound;
		totalFunctionsHit += coverage.functionsHit;
	}

	const overall: FileCoverage = {
		filePath: "",
		lineRate: computeRate(totalLinesHit, totalLinesFound),
		branchRate: computeRate(totalBranchesHit, totalBranchesFound),
		functionRate: computeRate(totalFunctionsHit, totalFunctionsFound),
		linesFound: totalLinesFound,
		linesHit: totalLinesHit,
		branchesFound: totalBranchesFound,
		branchesHit: totalBranchesHit,
		functionsFound: totalFunctionsFound,
		functionsHit: totalFunctionsHit,
	};

	return { files: fileMap, overall };
}
