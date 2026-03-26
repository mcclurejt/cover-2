import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLcov } from "../../src/lcov/parse";

const fixturesDir = join(import.meta.dir, "..", "fixtures");

function readFixture(name: string): string {
	return readFileSync(join(fixturesDir, name), "utf-8");
}

describe("parseLcov", () => {
	test("parses minimal single-file LCOV with DA/LF/LH", () => {
		const content = readFixture("simple.lcov");
		const result = parseLcov(content);

		expect(result).toHaveLength(1);

		const file = result[0];
		expect(file.filePath).toBe("src/index.ts");
		expect(file.linesFound).toBe(4);
		expect(file.linesHit).toBe(3);
		expect(file.lines).toEqual([
			{ lineNumber: 1, executionCount: 1 },
			{ lineNumber: 2, executionCount: 1 },
			{ lineNumber: 3, executionCount: 0 },
			{ lineNumber: 5, executionCount: 1 },
		]);
		expect(file.branches).toEqual([]);
		expect(file.branchesFound).toBe(0);
		expect(file.branchesHit).toBe(0);
		expect(file.functions).toEqual([]);
		expect(file.functionsFound).toBe(0);
		expect(file.functionsHit).toBe(0);
	});

	test("parses multi-file LCOV", () => {
		const content = readFixture("multi-file.lcov");
		const result = parseLcov(content);

		expect(result).toHaveLength(3);
		expect(result[0].filePath).toBe("src/utils.ts");
		expect(result[1].filePath).toBe("src/main.ts");
		expect(result[2].filePath).toBe("src/helpers.ts");
	});

	test("parses branch data (BRDA/BRF/BRH)", () => {
		const content = readFixture("multi-file.lcov");
		const result = parseLcov(content);

		const utils = result[0];
		expect(utils.branchesFound).toBe(2);
		expect(utils.branchesHit).toBe(2);
		expect(utils.branches).toEqual([
			{ lineNumber: 2, blockNumber: 0, branchNumber: 0, taken: 8 },
			{ lineNumber: 2, blockNumber: 0, branchNumber: 1, taken: 2 },
		]);

		const helpers = result[2];
		expect(helpers.branchesFound).toBe(2);
		expect(helpers.branchesHit).toBe(0);
		expect(helpers.branches).toEqual([
			{ lineNumber: 1, blockNumber: 0, branchNumber: 0, taken: -1 },
			{ lineNumber: 1, blockNumber: 0, branchNumber: 1, taken: -1 },
		]);
	});

	test("parses function data (FN/FNDA/FNF/FNH)", () => {
		const content = readFixture("multi-file.lcov");
		const result = parseLcov(content);

		const utils = result[0];
		expect(utils.functionsFound).toBe(2);
		expect(utils.functionsHit).toBe(2);
		expect(utils.functions).toHaveLength(2);
		expect(utils.functions).toContainEqual({
			name: "add",
			startLine: 1,
			executionCount: 10,
		});
		expect(utils.functions).toContainEqual({
			name: "subtract",
			startLine: 5,
			executionCount: 3,
		});

		const helpers = result[2];
		expect(helpers.functionsFound).toBe(1);
		expect(helpers.functionsHit).toBe(0);
		expect(helpers.functions).toEqual([
			{ name: "format", startLine: 1, executionCount: 0 },
		]);
	});

	test("computes LF/LH from DA entries when missing", () => {
		const content = [
			"SF:src/computed.ts",
			"DA:1,1",
			"DA:2,0",
			"DA:3,1",
			"DA:4,1",
			"end_of_record",
		].join("\n");

		const result = parseLcov(content);
		expect(result).toHaveLength(1);
		expect(result[0].linesFound).toBe(4);
		expect(result[0].linesHit).toBe(3);
	});

	test("uses explicit LF/LH over computed values", () => {
		const content = [
			"SF:src/explicit.ts",
			"DA:1,1",
			"DA:2,1",
			"LF:10",
			"LH:5",
			"end_of_record",
		].join("\n");

		const result = parseLcov(content);
		expect(result).toHaveLength(1);
		expect(result[0].linesFound).toBe(10);
		expect(result[0].linesHit).toBe(5);
	});

	test("returns empty array for empty input", () => {
		expect(parseLcov("")).toEqual([]);
	});

	test("returns empty array for whitespace-only input", () => {
		expect(parseLcov("  \n  \n  ")).toEqual([]);
	});

	test("skips malformed lines gracefully", () => {
		const content = [
			"SF:src/malformed.ts",
			"DA:1,1",
			"GARBAGE_LINE",
			"DA:not_a_number,abc",
			"DA:2,1",
			"BRDA:too,few",
			"FN:not_a_number,badFunc",
			"UNKNOWN_PREFIX:some_value",
			"end_of_record",
		].join("\n");

		const result = parseLcov(content);
		expect(result).toHaveLength(1);
		expect(result[0].filePath).toBe("src/malformed.ts");
		expect(result[0].lines).toEqual([
			{ lineNumber: 1, executionCount: 1 },
			{ lineNumber: 2, executionCount: 1 },
		]);
		expect(result[0].functions).toEqual([]);
	});

	test("handles CRLF line endings", () => {
		const content =
			"SF:src/crlf.ts\r\nDA:1,5\r\nDA:2,0\r\nLF:2\r\nLH:1\r\nend_of_record\r\n";

		const result = parseLcov(content);
		expect(result).toHaveLength(1);
		expect(result[0].filePath).toBe("src/crlf.ts");
		expect(result[0].linesFound).toBe(2);
		expect(result[0].linesHit).toBe(1);
		expect(result[0].lines).toEqual([
			{ lineNumber: 1, executionCount: 5 },
			{ lineNumber: 2, executionCount: 0 },
		]);
	});

	test("ignores TN: lines", () => {
		const content = [
			"TN:test_name",
			"SF:src/tn.ts",
			"DA:1,1",
			"LF:1",
			"LH:1",
			"end_of_record",
		].join("\n");

		const result = parseLcov(content);
		expect(result).toHaveLength(1);
		expect(result[0].filePath).toBe("src/tn.ts");
	});

	test("handles FN and FNDA appearing in any order", () => {
		const content = [
			"SF:src/fn-order.ts",
			"FNDA:7,bar",
			"FN:10,bar",
			"FN:1,foo",
			"FNDA:3,foo",
			"FNF:2",
			"FNH:2",
			"DA:1,3",
			"DA:10,7",
			"LF:2",
			"LH:2",
			"end_of_record",
		].join("\n");

		const result = parseLcov(content);
		expect(result).toHaveLength(1);
		expect(result[0].functions).toContainEqual({
			name: "bar",
			startLine: 10,
			executionCount: 7,
		});
		expect(result[0].functions).toContainEqual({
			name: "foo",
			startLine: 1,
			executionCount: 3,
		});
	});

	test("handles function names containing commas", () => {
		const content = [
			"SF:src/comma.ts",
			"FN:1,operator,int",
			"FNDA:2,operator,int",
			"FNF:1",
			"FNH:1",
			"DA:1,2",
			"LF:1",
			"LH:1",
			"end_of_record",
		].join("\n");

		const result = parseLcov(content);
		expect(result).toHaveLength(1);
		expect(result[0].functions).toEqual([
			{ name: "operator,int", startLine: 1, executionCount: 2 },
		]);
	});

	test("ignores data lines before first SF:", () => {
		const content = [
			"DA:1,1",
			"LF:1",
			"SF:src/real.ts",
			"DA:5,2",
			"LF:1",
			"LH:1",
			"end_of_record",
		].join("\n");

		const result = parseLcov(content);
		expect(result).toHaveLength(1);
		expect(result[0].filePath).toBe("src/real.ts");
		expect(result[0].lines).toEqual([{ lineNumber: 5, executionCount: 2 }]);
	});
});
