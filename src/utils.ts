/**
 * Format a coverage percentage for display.
 */
export function formatPercent(rate: number, decimals = 2): string {
	if (rate < 0) {
		return "0.00%";
	}
	if (rate > 100) {
		return "100.00%";
	}
	return `${rate.toFixed(decimals)}%`;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

/**
 * Calculate the weighted average of rates.
 */
export function weightedAverage(
	items: Array<{ rate: number; weight: number }>,
): number {
	const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
	if (totalWeight === 0) return 0;
	const weightedSum = items.reduce(
		(sum, item) => sum + item.rate * item.weight,
		0,
	);
	return weightedSum / totalWeight;
}
