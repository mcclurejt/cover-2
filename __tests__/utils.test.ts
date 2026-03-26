import { describe, expect, it } from "bun:test";
import { formatPercent } from "../src/utils.js";

describe("formatPercent", () => {
	it("formats a normal percentage", () => {
		expect(formatPercent(85.5)).toBe("85.50%");
	});

	it("clamps negative values to 0", () => {
		expect(formatPercent(-5)).toBe("0.00%");
	});

	it("clamps values over 100", () => {
		expect(formatPercent(105)).toBe("100.00%");
	});

	it("supports custom decimal places", () => {
		expect(formatPercent(75.123, 1)).toBe("75.1%");
	});
});
