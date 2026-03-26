export interface Thresholds {
	lower: number;
	upper: number;
}

export function badgeColor(rate: number, thresholds: Thresholds): string {
	if (rate >= thresholds.upper) return "brightgreen";
	if (rate >= thresholds.lower) return "yellow";
	return "red";
}

export function badgeUrl(rate: number, thresholds: Thresholds): string {
	const color = badgeColor(rate, thresholds);
	const label = encodeURIComponent("coverage");
	const value = encodeURIComponent(`${rate.toFixed(1)}%`);
	return `https://img.shields.io/badge/${label}-${value}-${color}`;
}
