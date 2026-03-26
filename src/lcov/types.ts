export interface LineData {
	lineNumber: number;
	executionCount: number;
}

export interface BranchData {
	lineNumber: number;
	blockNumber: number;
	branchNumber: number;
	/** Number of times taken. -1 means never executed. */
	taken: number;
}

export interface FunctionData {
	name: string;
	startLine: number;
	executionCount: number;
}

export interface LcovFile {
	filePath: string;
	lines: LineData[];
	linesFound: number;
	linesHit: number;
	branches: BranchData[];
	branchesFound: number;
	branchesHit: number;
	functions: FunctionData[];
	functionsFound: number;
	functionsHit: number;
}
