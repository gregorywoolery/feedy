import { execFileSync } from "node:child_process";

// Report filenames only: a failed check must never print the credential itself.
const patterns = [
  "-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
  "gh[pousr]_[A-Za-z0-9]{30,}",
  "github_pat_[A-Za-z0-9_]{30,}",
  "AKIA[A-Z0-9]{16}",
  "sk_live_[A-Za-z0-9]{16,}",
  "sb_secret_[A-Za-z0-9_-]{16,}",
  "(/Users|/home)/[A-Za-z0-9._-]+/",
].join("|");
const commits = execFileSync("git", ["rev-list", "--all"], { encoding: "utf8" })
  .trim()
  .split("\n");
let failed = false;
for (const commit of commits) {
  try {
    const matches = execFileSync(
      "git",
      ["grep", "-I", "-l", "-E", "-e", patterns, commit, "--"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (matches.trim()) {
      console.error(matches.trim());
      failed = true;
    }
  } catch (error) {
    if (error.status !== 1) throw error;
  }
}
if (failed) {
  console.error(
    "Possible credential or personal path found in Git history. Inspect privately before publication.",
  );
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${commits.length} reachable commits for common credentials and personal paths.`,
  );
}
