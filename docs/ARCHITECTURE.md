# Architecture

Counterpoint stays inside the DeepSpace scaffold. The browser does not talk to Exa or OpenAI. A signed-in server action does.

## Request path

1. `/home` submits a claim through `POST /api/actions/investigateClaim` with the caller's session token.
2. The action route rejects a missing bearer token. The action itself ignores any owner id in the body and uses the authenticated user.
3. A lock row stops a second run of the same claim. A usage row with a unique slot enforces the daily cap.
4. Three Exa searches run: the claim, a supporting phrasing, and a challenging phrasing. Each asks for four results and a short text extract.
5. Results are validated, non-HTTP URLs and empty excerpts are dropped, and duplicates are collapsed. At most eight sources are stored, round-robin across the three searches.
6. One chat completion classifies those sources. The reply is accepted only as Chat Completions `choices[0].message.content` (a string or text parts). Quotes, URLs, and `[sN]` citations that are not in the retrieved set are discarded. The stored excerpt stays the retrieved text.
7. Sources and the investigation are records. Clients may change `stance` and `excluded` on their own sources. Titles, URLs, excerpts, and the model label are immutable from the client.
8. Synthesis loads the caller's investigation, omits excluded sources, and saves one validated reading plus a fingerprint of the included set. If the board changes afterward, the panel marks that reading out of date.

Records sync through the app WebSocket, so a label change is a record write rather than another model call.

## Where the code lives

- `src/lib/evidence/` validates text, search results, classifications, and synthesis input. It does not import the worker SDK.
- `src/actions/investigate.ts` is the only place that calls search and the model.
- `src/schemas/` defines investigations, sources, usage, and locks.
- `src/server/http-routes.ts` refuses `/api/integrations/exa/*` and `/api/integrations/openai/*`.
- `src/components/evidence/` is the board. `src/pages/index.tsx` is the static sample. `src/pages/(app)/` is the signed-in desk.
