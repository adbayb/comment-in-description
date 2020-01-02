import * as core from "@actions/core";
import * as github from "@actions/github";

const DELIMETER = "<span class='actions/comment-in-description' hidden />";

const getActionDescription = (label: string, message: string) => {
	return `\n\n## ${label}\n\n${message}\n\n${DELIMETER}`;
};

const getEditedDescription = (prDescription?: string) => {
	const label = core.getInput("label");
	const message = core.getInput("message");
	const body = getActionDescription(label, message);

	// @section: empty description
	if (!prDescription) {
		return body;
	}

	const shouldBeEdited = new RegExp(`^## ${label}$`, "m").test(prDescription);

	if (!shouldBeEdited) {
		// @section: not existing item in prDescription: we append it to the end of body
		// @note: first remove last body linebreaks:
		prDescription = prDescription.replace(/\n+$/, "");

		return `${prDescription}${body}`;
	}

	// @section: edit existing section comment
	return prDescription.replace(
		new RegExp(`(?:^|\n+)## ${label}.*?${DELIMETER}`, "s"),
		body
	);
};

try {
	const {
		context,
		context: { payload }
	} = github;

	if (
		context.eventName !== "pull_request" ||
		payload.pull_request === undefined
	) {
		throw new Error("This action should only be run in PR context");
	}

	const token = core.getInput("token");
	const client = new github.GitHub(token);

	const { pull_request, repository } = payload;

	async function editPullRequest() {
		const pullParams = {
			owner: repository!.owner.login,
			pull_number: pull_request.number,
			repo: repository!.name
		};

		// @note: It seems that there are access concurrency issues when dealing with
		// multiple same chained action (the next action didn't get PR updates from the previous one)
		// Always fetching fresh pull request data (instead of accesing it via payload.pull_request.body)
		// before updating seems to solve the issue:
		const res = await client.pulls.get(pullParams);

		await client.pulls.update({
			...pullParams,
			body: getEditedDescription(res.data.body)
		});
	}

	editPullRequest();
} catch (error) {
	core.setFailed(error.message);
}
