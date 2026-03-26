import type { BranchData, FunctionData, LcovFile, LineData } from "./types";

function createEmptyFile(): LcovFile {
	return {
		filePath: "",
		lines: [],
		linesFound: 0,
		linesHit: 0,
		branches: [],
		branchesFound: 0,
		branchesHit: 0,
		functions: [],
		functionsFound: 0,
		functionsHit: 0,
	};
}

function finalizeFile(file: LcovFile): LcovFile {
	// Compute LF/LH from DA entries if they were not explicitly provided
	if (file.linesFound === 0 && file.lines.length > 0) {
		file.linesFound = file.lines.length;
	}
	if (file.linesHit === 0 && file.lines.length > 0) {
		file.linesHit = file.lines.filter((l) => l.executionCount > 0).length;
	}
	return file;
}

export function parseLcov(content: string): LcovFile[] {
	const results: LcovFile[] = [];
	const lines = content.replace(/\r\n/g, "\n").split("\n");

	let current: LcovFile | null = null;
	// Map of function name -> FunctionData for merging FN: and FNDA: records
	let fnMap: Map<string, FunctionData> = new Map();

	for (const raw of lines) {
		const line = raw.trim();
		if (line === "" || line.startsWith("TN:")) {
			continue;
		}

		if (line.startsWith("SF:")) {
			current = createEmptyFile();
			fnMap = new Map();
			current.filePath = line.slice(3);
			continue;
		}

		if (current === null) {
			continue;
		}

		if (line === "end_of_record") {
			// Merge fnMap into current.functions
			current.functions = Array.from(fnMap.values());
			results.push(finalizeFile(current));
			current = null;
			fnMap = new Map();
			continue;
		}

		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) {
			continue;
		}

		const prefix = line.slice(0, colonIndex);
		const value = line.slice(colonIndex + 1);

		switch (prefix) {
			case "DA": {
				const parts = value.split(",");
				if (parts.length >= 2) {
					const lineNumber = Number.parseInt(parts[0], 10);
					const executionCount = Number.parseInt(parts[1], 10);
					if (!Number.isNaN(lineNumber) && !Number.isNaN(executionCount)) {
						current.lines.push({
							lineNumber,
							executionCount,
						} satisfies LineData);
					}
				}
				break;
			}
			case "LF": {
				const n = Number.parseInt(value, 10);
				if (!Number.isNaN(n)) current.linesFound = n;
				break;
			}
			case "LH": {
				const n = Number.parseInt(value, 10);
				if (!Number.isNaN(n)) current.linesHit = n;
				break;
			}
			case "BRDA": {
				const parts = value.split(",");
				if (parts.length >= 4) {
					const lineNumber = Number.parseInt(parts[0], 10);
					const blockNumber = Number.parseInt(parts[1], 10);
					const branchNumber = Number.parseInt(parts[2], 10);
					const taken = parts[3] === "-" ? -1 : Number.parseInt(parts[3], 10);
					if (
						!Number.isNaN(lineNumber) &&
						!Number.isNaN(blockNumber) &&
						!Number.isNaN(branchNumber) &&
						!Number.isNaN(taken)
					) {
						current.branches.push({
							lineNumber,
							blockNumber,
							branchNumber,
							taken,
						} satisfies BranchData);
					}
				}
				break;
			}
			case "BRF": {
				const n = Number.parseInt(value, 10);
				if (!Number.isNaN(n)) current.branchesFound = n;
				break;
			}
			case "BRH": {
				const n = Number.parseInt(value, 10);
				if (!Number.isNaN(n)) current.branchesHit = n;
				break;
			}
			case "FN": {
				const parts = value.split(",");
				if (parts.length >= 2) {
					const startLine = Number.parseInt(parts[0], 10);
					const name = parts.slice(1).join(",");
					if (!Number.isNaN(startLine) && name) {
						const existing = fnMap.get(name);
						if (existing) {
							existing.startLine = startLine;
						} else {
							fnMap.set(name, { name, startLine, executionCount: 0 });
						}
					}
				}
				break;
			}
			case "FNDA": {
				const parts = value.split(",");
				if (parts.length >= 2) {
					const executionCount = Number.parseInt(parts[0], 10);
					const name = parts.slice(1).join(",");
					if (!Number.isNaN(executionCount) && name) {
						const existing = fnMap.get(name);
						if (existing) {
							existing.executionCount = executionCount;
						} else {
							fnMap.set(name, { name, startLine: 0, executionCount });
						}
					}
				}
				break;
			}
			case "FNF": {
				const n = Number.parseInt(value, 10);
				if (!Number.isNaN(n)) current.functionsFound = n;
				break;
			}
			case "FNH": {
				const n = Number.parseInt(value, 10);
				if (!Number.isNaN(n)) current.functionsHit = n;
				break;
			}
			default:
				// Unknown prefix — skip gracefully
				break;
		}
	}

	return results;
}
