import { Octokit, App } from "octokit";

const octokit = new Octokit({
  auth: process.env.PAT,
});

const postData = async () => {
  let usersWhoPushed = new Map();
  const listOfUsers = process.env.USERS;
  const discordUsernames = process.env.DISCORDUSERS.toString()
    .trim()
    .split(",");

  try {
    const response = listOfUsers;
    let users = response.toString().trim().split(",");
    for (let i = 0; i < users.length; i++) {
      let user = users[i];
      const result = await octokit.request("GET /users/{owner}/events/public", {
        owner: user,
      });
      let response = result.data;
      let lastGitPush = response.filter(
        (event) =>
          event["type"] === "PushEvent" &&
          new Date(event["created_at"]).setHours(0, 0, 0, 0) ===
            new Date().setHours(0, 0, 0, 0)
      )[0];
      if (lastGitPush != undefined) {
        let lastGitPushDate = new Date(lastGitPush["created_at"]);
        lastGitPushDate = lastGitPushDate.toLocaleString("en-au", {
          timeZone: "Australia/Brisbane",
        });
        const repoName = lastGitPush["repo"].name.split("/")[1];
        const lastGitMessageRequest = await octokit.request(
          "GET /repos/{owner}/{repo}/commits",
          {
            owner: user,
            repo: repoName,
          }
        );
        const lastGitMessageResponse = lastGitMessageRequest.data.filter(
          (event) =>
            new Date(event["commit"]["author"]["date"]).setHours(0, 0, 0, 0) ===
            new Date().setHours(0, 0, 0, 0)
        )[0];
        const lastGitMessage = lastGitMessageResponse["commit"]["message"];
        usersWhoPushed = usersWhoPushed.set(
          `${lastGitPush["actor"].login}`,
          `${lastGitPush["repo"].name} | ${lastGitPushDate} | ${discordUsernames[i]} | ${lastGitMessage}`
        );
      }
    }
    console.log(usersWhoPushed);
  } catch (error) {
    console.error("Error:", error);
  }

  try {
    if (usersWhoPushed.size === 0) {
      const response = await fetch(process.env.WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "@everyone No one committed today! What's going on??",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);
    } else if (usersWhoPushed.size >= 1) {
      let validStrings = [];
      usersWhoPushed.forEach((value, key) => {
        const discordUsername = value.split("|")[2].trim();
        const githubRepo = value.split("|")[0].trim();
        const date = value.split("|")[1].split(",")[0].trim();
        const time = value.split("|")[1].split(",")[1].trim();
        const lastGitCommitMessage = value.split("|")[3].trim();
        validStrings.push(
          `${discordUsername} has done a commit today! \n🔗  https://github.com/${githubRepo} \n💬  Last Commit: ${lastGitCommitMessage} \n📅  on ${date} at ${time}`
        );
      });
      const userWhoDidntPushDiscord = validStrings.includes(discordUsernames[0])
        ? discordUsernames[0]
        : discordUsernames[1];
      const userWhoDidntPushGithub = usersWhoPushed.has(
        listOfUsers.toString().trim().split(",")[0]
      )
        ? listOfUsers.toString().trim().split(",")[0]
        : listOfUsers.toString().trim().split(",")[1];
      const response = await fetch(process.env.WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `@everyone \n\n${validStrings
            .map((value) => `${value}\n\n`)
            .join("")}\n\n ${userWhoDidntPushDiscord} shame on you! That's $5`,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);
    }
  } catch (error) {
    console.error("Error:", error);
  }
};

postData();
