import type { GitHub } from "@actions/github/lib/utils.js";

type Octokit = InstanceType<typeof GitHub>;

const BASELINE_FILE = "baseline.lcov";

/**
 * Save LCOV content to a dedicated orphan branch.
 * Creates the branch if it doesn't exist, or updates the file if it does.
 */
export async function saveBaseline(
	octokit: Octokit,
	owner: string,
	repo: string,
	branch: string,
	lcovContent: string,
): Promise<void> {
	const contentBase64 = Buffer.from(lcovContent).toString("base64");
	const existingSha = await getFileSha(octokit, owner, repo, branch);

	if (existingSha) {
		await octokit.rest.repos.createOrUpdateFileContents({
			owner,
			repo,
			path: BASELINE_FILE,
			message: "chore: update coverage baseline",
			content: contentBase64,
			sha: existingSha,
			branch,
		});
	} else {
		await ensureBranch(octokit, owner, repo, branch);
		await octokit.rest.repos.createOrUpdateFileContents({
			owner,
			repo,
			path: BASELINE_FILE,
			message: "chore: update coverage baseline",
			content: contentBase64,
			branch,
		});
	}
}

/**
 * Fetch the baseline LCOV content from a dedicated branch.
 * Returns null if the branch or file doesn't exist.
 */
export async function fetchBaseline(
	octokit: Octokit,
	owner: string,
	repo: string,
	branch: string,
): Promise<string | null> {
	try {
		const { data } = await octokit.rest.repos.getContent({
			owner,
			repo,
			path: BASELINE_FILE,
			ref: branch,
		});

		if ("content" in data && data.type === "file") {
			return Buffer.from(data.content, "base64").toString("utf-8");
		}
		return null;
	} catch (error: unknown) {
		if (isNotFoundError(error)) {
			return null;
		}
		throw error;
	}
}

async function getFileSha(
	octokit: Octokit,
	owner: string,
	repo: string,
	branch: string,
): Promise<string | null> {
	try {
		const { data } = await octokit.rest.repos.getContent({
			owner,
			repo,
			path: BASELINE_FILE,
			ref: branch,
		});
		if ("sha" in data) {
			return data.sha;
		}
		return null;
	} catch (error: unknown) {
		if (isNotFoundError(error)) {
			return null;
		}
		throw error;
	}
}

/**
 * Ensure the baseline branch exists. Creates an orphan branch with an
 * empty initial commit if it doesn't exist.
 */
async function ensureBranch(
	octokit: Octokit,
	owner: string,
	repo: string,
	branch: string,
): Promise<void> {
	try {
		await octokit.rest.repos.getBranch({ owner, repo, branch });
	} catch (error: unknown) {
		if (!isNotFoundError(error)) {
			throw error;
		}

		// Create orphan branch via the Git Data API:
		// 1. Create an empty tree
		const { data: tree } = await octokit.rest.git.createTree({
			owner,
			repo,
			tree: [],
		});

		// 2. Create a commit with no parents (orphan)
		const { data: commit } = await octokit.rest.git.createCommit({
			owner,
			repo,
			message: "chore: initialize coverage baseline branch",
			tree: tree.sha,
			parents: [],
		});

		// 3. Create the ref
		await octokit.rest.git.createRef({
			owner,
			repo,
			ref: `refs/heads/${branch}`,
			sha: commit.sha,
		});
	}
}

function isNotFoundError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		(error as { status: number }).status === 404
	);
}
