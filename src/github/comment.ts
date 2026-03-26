import type { GitHub } from "@actions/github/lib/utils.js";

type Octokit = InstanceType<typeof GitHub>;

const MARKER_PREFIX = "<!-- coverage-report:";

function getMarker(header: string): string {
	return `${MARKER_PREFIX}${header} -->`;
}

export function markerFor(header: string): string {
	return getMarker(header);
}

export async function findComment(
	octokit: Octokit,
	owner: string,
	repo: string,
	prNumber: number,
	header: string,
): Promise<{ id: number; body: string } | null> {
	const marker = getMarker(header);

	for await (const response of octokit.paginate.iterator(
		octokit.rest.issues.listComments,
		{ owner, repo, issue_number: prNumber, per_page: 100 },
	)) {
		for (const comment of response.data) {
			if (comment.body?.includes(marker)) {
				return { id: comment.id, body: comment.body };
			}
		}
	}

	return null;
}

export async function upsertComment(
	octokit: Octokit,
	owner: string,
	repo: string,
	prNumber: number,
	body: string,
	header: string,
): Promise<number> {
	const existing = await findComment(octokit, owner, repo, prNumber, header);

	if (existing) {
		const { data } = await octokit.rest.issues.updateComment({
			owner,
			repo,
			comment_id: existing.id,
			body,
		});
		return data.id;
	}

	const { data } = await octokit.rest.issues.createComment({
		owner,
		repo,
		issue_number: prNumber,
		body,
	});
	return data.id;
}
