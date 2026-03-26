import type { CoverageComparison, FileDelta } from "../coverage/types.js";
import { type Thresholds, badgeUrl } from "./badge.js";

export interface ReportOptions {
	header: string;
	thresholds: Thresholds;
	showBadge: boolean;
	showBranchCoverage: boolean;
	showFunctionCoverage: boolean;
	showUnchangedFiles: boolean;
}

const MAX_COMMENT_LENGTH = 65000;

function healthIcon(rate: number, thresholds: Thresholds): string {
	if (rate >= thresholds.upper) return ":white_check_mark:";
	if (rate >= thresholds.lower) return ":warning:";
	return ":x:";
}

function formatRate(rate: number): string {
	return `${rate.toFixed(2)}%`;
}

function formatDelta(
	delta: number | null,
	status: FileDelta["status"],
): string {
	if (status === "added") return "*new*";
	if (status === "removed") return "*removed*";
	if (delta === null) return "";
	const sign = delta > 0 ? "+" : "";
	return `${sign}${delta.toFixed(2)}%`;
}

function overallLine(
	comparison: CoverageComparison,
	showBranch: boolean,
	showFunction: boolean,
): string {
	const head = comparison.headSummary.overall;
	const delta = comparison.overallDelta;

	let line = `**Overall:** ${formatRate(head.lineRate)} lines`;
	if (delta.lineRateDelta !== null) {
		const sign = delta.lineRateDelta > 0 ? "+" : "";
		line += ` (${sign}${delta.lineRateDelta.toFixed(2)}%)`;
	}

	if (showBranch) {
		line += `, ${formatRate(head.branchRate)} branches`;
		if (delta.branchRateDelta !== null) {
			const sign = delta.branchRateDelta > 0 ? "+" : "";
			line += ` (${sign}${delta.branchRateDelta.toFixed(2)}%)`;
		}
	}

	if (showFunction) {
		line += `, ${formatRate(head.functionRate)} functions`;
		if (delta.functionRateDelta !== null) {
			const sign = delta.functionRateDelta > 0 ? "+" : "";
			line += ` (${sign}${delta.functionRateDelta.toFixed(2)}%)`;
		}
	}

	return line;
}

function buildHeader(
	showBranch: boolean,
	showFunction: boolean,
	hasDelta: boolean,
): string {
	const cols = ["Status", "File", "Lines"];
	if (showBranch) cols.push("Branches");
	if (showFunction) cols.push("Functions");
	if (hasDelta) cols.push("Delta");

	const header = `| ${cols.join(" | ")} |`;
	const separator = `|${cols.map(() => "---").join("|")}|`;
	return `${header}\n${separator}`;
}

function buildRow(
	file: FileDelta,
	thresholds: Thresholds,
	showBranch: boolean,
	showFunction: boolean,
	hasDelta: boolean,
): string {
	const icon = healthIcon(file.head.lineRate, thresholds);
	const cols = [icon, `\`${file.filePath}\``, formatRate(file.head.lineRate)];
	if (showBranch) cols.push(formatRate(file.head.branchRate));
	if (showFunction) cols.push(formatRate(file.head.functionRate));
	if (hasDelta) cols.push(formatDelta(file.lineRateDelta, file.status));
	return `| ${cols.join(" | ")} |`;
}

export function generateReport(
	comparison: CoverageComparison,
	options: ReportOptions,
): string {
	const hasDelta = comparison.baseSummary !== null;
	const parts: string[] = [];

	// Hidden marker for comment identification
	parts.push(`<!-- coverage-report:${options.header} -->`);
	parts.push("## Coverage Report");
	parts.push("");

	// Badge
	if (options.showBadge) {
		const url = badgeUrl(
			comparison.headSummary.overall.lineRate,
			options.thresholds,
		);
		parts.push(`![Coverage](${url})`);
		parts.push("");
	}

	// Overall summary
	parts.push(
		overallLine(
			comparison,
			options.showBranchCoverage,
			options.showFunctionCoverage,
		),
	);
	parts.push("");

	// Split files into changed/added/removed vs unchanged
	const changedFiles = comparison.files.filter((f) => f.status !== "unchanged");
	const unchangedFiles = comparison.files.filter(
		(f) => f.status === "unchanged",
	);

	// Main table with changed files
	if (changedFiles.length > 0) {
		const tableHeader = buildHeader(
			options.showBranchCoverage,
			options.showFunctionCoverage,
			hasDelta,
		);
		parts.push(tableHeader);

		for (const file of changedFiles) {
			parts.push(
				buildRow(
					file,
					options.thresholds,
					options.showBranchCoverage,
					options.showFunctionCoverage,
					hasDelta,
				),
			);
		}
		parts.push("");
	} else if (unchangedFiles.length === 0) {
		parts.push("No coverage data found.");
		parts.push("");
	}

	// Unchanged files in collapsible section
	if (unchangedFiles.length > 0) {
		if (options.showUnchangedFiles) {
			// Show them in the same table format
			if (changedFiles.length === 0) {
				// No changed files, so we need the header
				const tableHeader = buildHeader(
					options.showBranchCoverage,
					options.showFunctionCoverage,
					hasDelta,
				);
				parts.push(tableHeader);
			}

			for (const file of unchangedFiles) {
				parts.push(
					buildRow(
						file,
						options.thresholds,
						options.showBranchCoverage,
						options.showFunctionCoverage,
						hasDelta,
					),
				);
			}
			parts.push("");
		} else {
			const noun = unchangedFiles.length === 1 ? "file" : "files";
			parts.push(
				`<details>\n<summary>${unchangedFiles.length} unchanged ${noun}</summary>`,
			);
			parts.push("");

			const tableHeader = buildHeader(
				options.showBranchCoverage,
				options.showFunctionCoverage,
				hasDelta,
			);
			parts.push(tableHeader);

			for (const file of unchangedFiles) {
				parts.push(
					buildRow(
						file,
						options.thresholds,
						options.showBranchCoverage,
						options.showFunctionCoverage,
						hasDelta,
					),
				);
			}
			parts.push("");
			parts.push("</details>");
		}
	}

	let report = parts.join("\n");

	// Truncate if needed
	if (report.length > MAX_COMMENT_LENGTH) {
		const truncationNotice =
			"\n\n> **Note:** Report truncated due to comment size limits.\n";
		report = `${report.slice(0, MAX_COMMENT_LENGTH - truncationNotice.length)}${truncationNotice}`;
	}

	return report;
}
