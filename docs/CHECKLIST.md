# Checklist

Status after local tests, one live investigation, and the checks in `TEST_RESULTS.md`. Items are marked only where that run produced evidence. The hidden 217-line expansion was not available as separate checks, so this follows the sections that were specified.

## Platform

- Scaffold, TypeScript, and gitignore for secrets and build output: done.
- CLI authenticated. Integrations `exa/search` and `openai/chat-completion` were invoked and matched the parsers.
- App name and worker name: `counterpoint`.
- Official agent skill: not installed. The project instructions say the installed package and CLI are the interface, and the skill is optional.
- Git history starts with the product commit. An empty deploy before any product code was not done.
- Production deploy: https://counterpoint.app.space is serving the release. `/` and `/api/auth/ok` return 200. Direct search returns 403. A signed-out investigation returns 401. The sample board updates without a paid call.

## Product

- Records: investigations, sources, usage, and locks, with per-user read and no client writes to investigations.
- Auth: signed-out visitors can use the sample. Paid actions return 401 without a bearer token. Two test accounts render as different sessions.
- Search: three bounded queries, HTTP(S) only, HTML stripped from titles and excerpts, deduped to at most eight sources.
- Classification: one chat call, runtime-validated, untrusted source text, discarded invented quotes, links, and citations.
- Board: title, URL, excerpt, reasoning, relabel, restore, exclude.
- Synthesis: included sources only, fingerprint, stale marking, sample reading without a model.
- Reliability: in-flight lock, unique daily slots, partial save still opens the investigation, 429 is a single controlled error with no retry.

## Not done

- The ten-claim evaluation scorecard was not scored. One live claim was run and inspected on the board, not compared line by line with three original articles.
- No automatic retry of provider failures.
- No separate page-contents integration beyond Exa's search extract.
- No background job. No image, payment, speech, or email integration.
- Cross-user denial was tested with two test accounts against one live investigation id. It was not repeated as a raw HTTP call with a forged `createdBy` against production; the action test covers the forged owner field, and the schema marks owner columns user-bound.
