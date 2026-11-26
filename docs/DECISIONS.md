# Decisions

## Search and the model stay behind server actions

Exa and OpenAI are billed to the app owner. The browser proxy returns 403 for both. Anonymous use is not enabled. The action route requires a session, and each step writes a usage row the client cannot delete.

## The daily cap is a unique slot, not a count

Two requests can both see "7 used" and both insert. Each attempt instead creates slot 1, then 2, up to the limit. The unique key is user, UTC day, kind, and slot. A duplicate slot is the next slot, and a full set is the daily limit. A provider failure still consumes the slot, because the call may already have been billed. A rate limit returns a single message and is not retried, so a 429 cannot double the spend.

## Retrieved text is the evidence

The model cannot add a URL or a long quotation that is not in the excerpt. A citation must name a retrieved source id. A bad item becomes inconclusive with a fixed reason, and the invented text is not shown. Unquoted paraphrase can still overreach; the card always shows the retrieved excerpt beside the note.

## Exa text is the page extract

Search requests `contents.text` with a 1400-character cap. That is the source extract. A separate contents endpoint was not added. Items with no usable excerpt are dropped rather than filled in.

## The sample is not a record

The front page is local state with fictional example.com notes. Updating its reading lists the included titles in the browser. It exists so a reviewer can use the board without a session and without a paid call.

## One heading on the front page

The sample claim is an `h2` under the page title. On the desk and the sample route, the claim is the page title.

## Real-time records, no job runner

Label changes and the saved list use the record WebSocket. Investigations run inside the request that started them. A closed browser leaves the lock until it expires (8 minutes) or the action finishes and releases it. A background job was not added; the request already persists sources before classification, and a failed classification leaves the board in `partial`.

## Folder layout

The scaffold's `src/pages`, `src/actions`, and `src/server` layout stays. Evidence logic is split under `src/lib/evidence/` instead of a new `worker/services` tree, because actions are the worker entry the SDK mounts.
