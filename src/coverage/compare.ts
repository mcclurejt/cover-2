import type {
	CoverageComparison,
	CoverageSummary,
	FileCoverage,
	FileDelta,
} from "./types.js";

/**
 * Normalize a file path for consistent comparison:
 * - Strip GITHUB_WORKSPACE prefix if present
 * - Strip leading "./" or "/"
 * - Normalize path separators to "/"
 */
export function normalizePath(filePath: string): string {
	let normalized = filePath.replace(/\\/g, "/");

	const workspace = process.env.GITHUB_WORKSPACE;
	if (workspace) {
		const normalizedWorkspace = workspace
			.replace(/\\/g, "/")
			.replace(/\/$/, "");
		if (normalized.startsWith(`${normalizedWorkspace}/`)) {
			normalized = normalized.slice(normalizedWorkspace.length + 1);
		} else if (normalized === normalizedWorkspace) {
			normalized = "";
		}
	}

	normalized = normalized.replace(/^\.\//, "");
	normalized = normalized.replace(/^\//, "");

	return normalized;
}

function buildNormalizedMap(
	files: Map<string, FileCoverage>,
): Map<string, FileCoverage> {
	const normalized = new Map<string, FileCoverage>();
	for (const [, coverage] of files) {
		const key = normalizePath(coverage.filePath);
		normalized.set(key, coverage);
	}
	return normalized;
}

function makeZeroCoverage(filePath: string): FileCoverage {
	return {
		filePath,
		lineRate: 0,
		branchRate: 0,
		functionRate: 0,
		linesFound: 0,
		linesHit: 0,
		branchesFound: 0,
		branchesHit: 0,
		functionsFound: 0,
		functionsHit: 0,
	};
}

function ratesEqual(a: FileCoverage, b: FileCoverage): boolean {
	return (
		a.lineRate === b.lineRate &&
		a.branchRate === b.branchRate &&
		a.functionRate === b.functionRate
	);
}

const STATUS_ORDER: Record<FileDelta["status"], number> = {
	changed: 0,
	added: 1,
	removed: 2,
	unchanged: 3,
};

/**
 * Compare head coverage against an optional base coverage to produce
 * a structured comparison with per-file deltas and overall deltas.
 */
export function compareCoverage(
	head: CoverageSummary,
	base: CoverageSummary | null,
): CoverageComparison {
	const headMap = buildNormalizedMap(head.files);
	const baseMap = base ? buildNormalizedMap(base.files) : null;

	const deltas: FileDelta[] = [];

	// Process files present in head
	for (const [normalizedPath, headCov] of headMap) {
		const baseCov = baseMap?.get(normalizedPath) ?? null;

		if (baseCov === null) {
			if (baseMap === null) {
				// No base at all -- treat as added with null deltas
				deltas.push({
					filePath: normalizedPath,
					head: headCov,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				});
			} else {
				// Base exists but this file is new
				deltas.push({
					filePath: normalizedPath,
					head: headCov,
					base: null,
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
					status: "added",
				});
			}
		} else if (ratesEqual(headCov, baseCov)) {
			deltas.push({
				filePath: normalizedPath,
				head: headCov,
				base: baseCov,
				lineRateDelta: 0,
				branchRateDelta: 0,
				functionRateDelta: 0,
				status: "unchanged",
			});
		} else {
			deltas.push({
				filePath: normalizedPath,
				head: headCov,
				base: baseCov,
				lineRateDelta: headCov.lineRate - baseCov.lineRate,
				branchRateDelta: headCov.branchRate - baseCov.branchRate,
				functionRateDelta: headCov.functionRate - baseCov.functionRate,
				status: "changed",
			});
		}
	}

	// Process files present in base but not in head (removed)
	if (baseMap) {
		for (const [normalizedPath, baseCov] of baseMap) {
			if (!headMap.has(normalizedPath)) {
				const zeroCov = makeZeroCoverage(normalizedPath);
				deltas.push({
					filePath: normalizedPath,
					head: zeroCov,
					base: baseCov,
					lineRateDelta: -baseCov.lineRate,
					branchRateDelta: -baseCov.branchRate,
					functionRateDelta: -baseCov.functionRate,
					status: "removed",
				});
			}
		}
	}

	// Sort: changed first (by |lineRateDelta| desc), then added, removed, unchanged
	deltas.sort((a, b) => {
		const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
		if (statusDiff !== 0) return statusDiff;

		if (a.status === "changed" && b.status === "changed") {
			return Math.abs(b.lineRateDelta ?? 0) - Math.abs(a.lineRateDelta ?? 0);
		}

		return a.filePath.localeCompare(b.filePath);
	});

	// Compute overall delta
	const overallDelta: CoverageComparison["overallDelta"] =
		base !== null
			? {
					lineRateDelta: head.overall.lineRate - base.overall.lineRate,
					branchRateDelta: head.overall.branchRate - base.overall.branchRate,
					functionRateDelta:
						head.overall.functionRate - base.overall.functionRate,
				}
			: {
					lineRateDelta: null,
					branchRateDelta: null,
					functionRateDelta: null,
				};

	return {
		files: deltas,
		overallDelta,
		headSummary: head,
		baseSummary: base,
	};
}
