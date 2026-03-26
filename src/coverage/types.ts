export interface FileCoverage {
	filePath: string;
	lineRate: number; // 0-100 percentage
	branchRate: number; // 0-100 percentage
	functionRate: number; // 0-100 percentage
	linesFound: number;
	linesHit: number;
	branchesFound: number;
	branchesHit: number;
	functionsFound: number;
	functionsHit: number;
}

export interface CoverageSummary {
	files: Map<string, FileCoverage>;
	overall: FileCoverage;
}

export interface FileDelta {
	filePath: string;
	head: FileCoverage;
	base: FileCoverage | null;
	lineRateDelta: number | null;
	branchRateDelta: number | null;
	functionRateDelta: number | null;
	status: "added" | "removed" | "changed" | "unchanged";
}

export interface CoverageComparison {
	files: FileDelta[];
	overallDelta: {
		lineRateDelta: number | null;
		branchRateDelta: number | null;
		functionRateDelta: number | null;
	};
	headSummary: CoverageSummary;
	baseSummary: CoverageSummary | null;
}
