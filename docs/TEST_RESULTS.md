# Test Results

## Environment

- Commit: `e75ed5f` for the app. This file's deploy note is updated after that release.
- Release: `rel_01M8CEXQXMWWTCT87SFYQZ2JY8`
- DeepSpace SDK version: 0.44.2
- Node.js version: v26.3.0
- Test date: 2026-11-26
- Deployment URL: https://counterpoint.app.space
- Search integration: `exa/search`
- LLM integration: `openai/chat-completion`, model `gpt-6-luna`

## Automated results

- Unit tests passed: 30 (`npx vitest run`, 4 files)
- Unit tests failed: 0
- Playwright passed: 15
  - `deepspace test run all --port 5199`: 12 passed, 3 skipped (no test accounts yet)
  - After two `@deepspace.test` accounts existed, `deepspace test run e2e --port 5201 --grep "each browser renders|API status page"`: 3 passed
- Playwright failed: 0
- Skipped tests: the 3 account tests were skipped only in the first run. They passed in the second. They are not counted as passed twice.
- Typecheck: `npx tsc --noEmit` passed
- Production build: `npx vite build` passed, including prerender of `/`

The 30 unit tests include evidence validation, dedupe, synthesis input, ownership, the daily slot cap, duplicate in-flight claims, rate-limit handling, a partial source save, and parsers checked against the live Exa and chat response shapes (extra provider fields, string `message.content`).

Playwright covers the static landing, signed-out desk, sample board edits with no paid calls, 401 on `POST /api/actions/investigateClaim`, 403 on direct Exa and OpenAI proxy calls, two distinct signed-in sessions, and the API status page.

## Real integration verification

- Search: `deepspace integrations invoke exa/search` returned one result. Title, URL, date, author, id, and text were present. The parser accepts that body, including the extra `image` and cost fields. A full desk run stored 8 sources.
- Classification: the same desk run finished with status detail "Sources classified." A direct chat invoke returned `choices[0].message.content` as the string `ok`, which `readChatContent` accepts.
- Synthesis: "Write synthesis from included sources" on that investigation returned a reading in about 6.8 seconds. The visible panel did not contain an `http` URL.
- Authentication: two test accounts each showed their own email in the account menu.
- Persistence: the investigation was still on the desk when a second browser session opened it.
- Authorization: the other test account, opening that investigation URL, saw "That investigation is not on this desk."

Live desk timing for "Regular physical activity improves cardiovascular health.": the board opened 10.7 seconds after submit. That includes three searches and classification. Synthesis was a later 6.8 second call. Initial page load was not timed separately from the Playwright suite.

These live calls were made on the local dev server and the integration CLI.

Production smoke against https://counterpoint.app.space: `/` returned 200 in 0.3 seconds, `/api/auth/ok` returned 200, a direct Exa call returned 403, and a signed-out investigate call returned 401. The sample board hydrated, an exclude updated the reading, and that interaction made no paid request. The document itself arrived in about half a second; the first click has to wait until that script has hydrated.

## AI evaluation

- Claims evaluated through the full desk: 1 of 10 (`Regular physical activity improves cardiovascular health.`)
- Sources manually inspected against the original articles: 0. The board showed 8 retrieved cards and a grounded-looking synthesis; the articles were not opened and compared.
- Citation validation results: the automated checks reject unknown `[sN]` ids, foreign URLs, and long quotations that are not in the excerpt. The live synthesis panel did not display an `http` URL.
- Identified quality issues: not scored. The ten-claim scorecard is incomplete. A full score would need the remaining nine claims and a manual read of the sources.

## Performance

- Investigation execution time: 10.7 seconds to the saved board, one measured run
- Search execution time: not measured apart from that run
- Classification execution time: not measured apart from that run
- Synthesis execution time: 6.8 seconds, one measured run

## Known limitations

- Chat output has no published schema. Only string content, or an array of text parts, is accepted. The live call returned a string.
- Paraphrase that does not quote or cite can still overstate a source. The excerpt on the card is the retrieved text.
- The daily cap can still be consumed by a provider error. Rate limits are not retried.
- A crashed action holds its lock for up to 8 minutes.
- Reclassify replaces manual labels.
- The investigation page resolves the row from the latest 100 records for that user.
- Sample sources are fictional notes on example.com.
- The ten-claim evaluation is not complete.

## Manual verification by applicant

- Not separately signed. The agent ran the checks above.

## Release blockers

- No critical or high-severity failure turned up in the checks above.
- The ten-claim evaluation scorecard is incomplete. That is unfinished review, not a fabricated citation.
