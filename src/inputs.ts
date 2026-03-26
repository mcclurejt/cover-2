import * as core from "@actions/core";
import type { Thresholds } from "./report/badge.js";

export interface ActionInputs {
	headLcovFile: string;
	baseLcovFile: string;
	githubToken: string;
	thresholds: Thresholds;
	failBelowThreshold: boolean;
	showBadge: boolean;
	showBranchCoverage: boolean;
	showFunctionCoverage: boolean;
	showUnchangedFiles: boolean;
	commentHeader: string;
	saveBaseline: string;
	baselineFrom: string;
	workingDirectory: string;
}

export function parseInputs(): ActionInputs {
	const headLcovFile = core.getInput("head-lcov-file", { required: true });
	const baseLcovFile = core.getInput("base-lcov-file");
	const githubToken = core.getInput("github-token", { required: true });
	const failBelowThreshold = core.getBooleanInput("fail-below-threshold");
	const showBadge = core.getBooleanInput("show-badge");
	const showBranchCoverage = core.getBooleanInput("show-branch-coverage");
	const showFunctionCoverage = core.getBooleanInput("show-function-coverage");
	const showUnchangedFiles = core.getBooleanInput("show-unchanged-files");
	const commentHeader = core.getInput("comment-header");
	const saveBaseline = core.getInput("save-baseline");
	const baselineFrom = core.getInput("baseline-from");
	const workingDirectory = core.getInput("working-directory");

	const thresholdsStr = core.getInput("thresholds");
	const thresholds = parseThresholds(thresholdsStr);

	return {
		headLcovFile,
		baseLcovFile,
		githubToken,
		thresholds,
		failBelowThreshold,
		showBadge,
		showBranchCoverage,
		showFunctionCoverage,
		showUnchangedFiles,
		commentHeader,
		saveBaseline,
		baselineFrom,
		workingDirectory,
	};
}

function parseThresholds(value: string): Thresholds {
	const parts = value.trim().split(/\s+/);
	if (parts.length !== 2) {
		throw new Error(
			`Invalid thresholds "${value}": expected two space-separated numbers (e.g., "60 80")`,
		);
	}

	const lower = Number(parts[0]);
	const upper = Number(parts[1]);

	if (Number.isNaN(lower) || Number.isNaN(upper)) {
		throw new Error(`Invalid thresholds "${value}": values must be numbers`);
	}

	if (lower < 0 || lower > 100 || upper < 0 || upper > 100) {
		throw new Error(
			`Invalid thresholds "${value}": values must be between 0 and 100`,
		);
	}

	if (lower > upper) {
		throw new Error(
			`Invalid thresholds "${value}": lower (${lower}) must not exceed upper (${upper})`,
		);
	}

	return { lower, upper };
}
