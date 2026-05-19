# AGENTS.md

## Communication

When reporting results to the user, use plain, clear English or Chinese according to context. Avoid unnecessary jargon and implementation-heavy wording in final responses.

Before reporting back, verify the work when possible. For visual or web changes, run the app and check the relevant pages or endpoints. For scripts or deployment work, run the relevant commands and inspect the result.

## Testing Preference

For visual or browser-based verification, prefer using [@Computer Use](plugin://computer-use@openai-bundled) to open the app, inspect pages, and click through flows instead of Playwright.

Use Playwright only when an automated browser script is specifically needed and Computer Use is not practical for the check.

## Subagent Preference

When using [@Computer Use](plugin://computer-use@openai-bundled), first spawn a `gpt-5.4` subagent with `low` reasoning effort to help in parallel.

If there are multiple independent tasks during Computer Use work, split them across different subagents with clear scopes.

When exploring the project structure, code paths, or file layout, use subagents to help with discovery.

For structure or codebase exploration tasks, prefer `gpt-5.4-mini` subagents with `medium` reasoning effort.

## Tencent Cloud Deployment

Do not use `npm run deploy:tencent` or `scripts/deploy-tencent-cloud.sh`.

Deploy to Tencent Cloud manually with explicit steps:

1. Run local checks needed for the release, such as lint, typecheck, tests, build, and browser tests when practical.
2. Create a deploy archive from the root Next.js app files only.
3. Upload the archive to the Tencent Cloud server with `scp`.
4. SSH into the server and extract into `/home/ubuntu/the-unique-hope`, preserving server-only files such as `.env` and `.env.local`.
5. Run `npm ci` on the server.
6. Run database schema updates only when intentionally required.
7. Run `npm run build` on the server.
8. Restart `the-unique-hope.service`.
9. Verify `http://127.0.0.1:3000/api/health` on the server and `https://uniquehopeclub.com/api/health` publicly.

Default production target:

- Host: `175.24.177.186`
- User: `ubuntu`
- Deploy path: `/home/ubuntu/the-unique-hope`
- Service: `the-unique-hope.service`
- SSH key: `key/Mar18th.pem`
