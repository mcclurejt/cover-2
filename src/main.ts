import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as core from "@actions/core";
import * as github from "@actions/github";
import * as glob from "@actions/glob";
import { compareCoverage } from "./coverage/compare.js";
import { summarizeFiles } from "./coverage/summarize.js";
import { upsertComment } from "./github/comment.js";
import { parseInputs } from "./inputs.js";
import { parseLcov } from "./lcov/parse.js";
import { generateReport } from "./report/markdown.js";

async function resolveAndReadLcov(
	pattern: string,
	workingDirectory: string,
): Promise<string> {
	const fullPattern = resolve(workingDirectory, pattern);
	const globber = await glob.create(fullPattern);
	const files = await globber.glob();

	if (files.length === 0) {
		throw new Error(`No files matched pattern: ${pattern}`);
	}

	const contents: string[] = [];
	for (const file of files) {
		core.info(`Reading LCOV file: ${file}`);
		contents.push(await readFile(file, "utf-8"));
	}
	return contents.join("\n");
}

export async function run(): Promise<void> {
	try {
		const inputs = parseInputs();

		// Parse head coverage
		const headContent = await resolveAndReadLcov(
			inputs.headLcovFile,
			inputs.workingDirectory,
		);
		const headFiles = parseLcov(headContent);
		const headSummary = summarizeFiles(headFiles);

		// Parse base coverage (optional)
		let baseSummary = null;
		if (inputs.baseLcovFile) {
			const baseContent = await resolveAndReadLcov(
				inputs.baseLcovFile,
				inputs.workingDirectory,
			);
			const baseFiles = parseLcov(baseContent);
			baseSummary = summarizeFiles(baseFiles);
		}

		// Compare
		const comparison = compareCoverage(headSummary, baseSummary);

		// Generate report
		const report = generateReport(comparison, {
			header: inputs.commentHeader,
			thresholds: inputs.thresholds,
			showBadge: inputs.showBadge,
			showBranchCoverage: inputs.showBranchCoverage,
			showFunctionCoverage: inputs.showFunctionCoverage,
			showUnchangedFiles: inputs.showUnchangedFiles,
		});

		// Set outputs
		core.setOutput("total-line-rate", headSummary.overall.lineRate.toFixed(2));
		core.setOutput(
			"total-branch-rate",
			headSummary.overall.branchRate.toFixed(2),
		);
		if (comparison.overallDelta.lineRateDelta !== null) {
			core.setOutput(
				"total-line-rate-delta",
				comparison.overallDelta.lineRateDelta.toFixed(2),
			);
		}
		core.setOutput("report", report);

		// Post PR comment
		const prNumber = github.context.payload.pull_request?.number;
		if (prNumber) {
			const octokit = github.getOctokit(inputs.githubToken);
			const { owner, repo } = github.context.repo;
			const commentId = await upsertComment(
				octokit,
				owner,
				repo,
				prNumber,
				report,
				inputs.commentHeader,
			);
			core.setOutput("comment-id", commentId.toString());
			core.info(`Coverage comment posted (ID: ${commentId})`);
		} else {
			core.info(
				"Not a pull request event — skipping comment. Report is available in outputs.",
			);
		}

		// Log summary
		core.info(
			`Coverage: ${headSummary.overall.lineRate.toFixed(2)}% lines, ${headSummary.overall.branchRate.toFixed(2)}% branches`,
		);

		// Fail if below threshold
		if (inputs.failBelowThreshold) {
			if (headSummary.overall.lineRate < inputs.thresholds.lower) {
				core.setFailed(
					`Line coverage ${headSummary.overall.lineRate.toFixed(2)}% is below the minimum threshold of ${inputs.thresholds.lower}%`,
				);
			}
		}
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
		} else {
			core.setFailed("An unexpected error occurred");
		}
	}
}
