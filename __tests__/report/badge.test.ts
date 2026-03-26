import { describe, expect, it } from "bun:test";
import { badgeColor, badgeUrl } from "../../src/report/badge.js";

const thresholds = { lower: 60, upper: 80 };

describe("badgeColor", () => {
	it("returns brightgreen when at or above upper threshold", () => {
		expect(badgeColor(80, thresholds)).toBe("brightgreen");
		expect(badgeColor(100, thresholds)).toBe("brightgreen");
	});

	it("returns yellow when between thresholds", () => {
		expect(badgeColor(60, thresholds)).toBe("yellow");
		expect(badgeColor(79.9, thresholds)).toBe("yellow");
	});

	it("returns red when below lower threshold", () => {
		expect(badgeColor(59.9, thresholds)).toBe("red");
		expect(badgeColor(0, thresholds)).toBe("red");
	});
});

describe("badgeUrl", () => {
	it("returns a shields.io URL with encoded rate and color", () => {
		const url = badgeUrl(82.5, thresholds);
		expect(url).toContain("https://img.shields.io/badge/");
		expect(url).toContain("coverage");
		expect(url).toContain("82.5%25");
		expect(url).toContain("brightgreen");
	});

	it("uses red color for low coverage", () => {
		const url = badgeUrl(30, thresholds);
		expect(url).toContain("red");
	});

	it("uses yellow color for mid coverage", () => {
		const url = badgeUrl(70, thresholds);
		expect(url).toContain("yellow");
	});
});
