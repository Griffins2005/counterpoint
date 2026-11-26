# Counterpoint

Counterpoint is a DeepSpace app for reading a claim against a small set of sources. A signed-in investigation searches for supporting and challenging material, classifies each retrieved excerpt, and lets you relabel or exclude sources before writing a synthesis from what remains.

The front page is a sample board. It does not search and it does not call a model. Open the desk at `/home` to run a real investigation.

## Local use

```sh
npx deepspace auth login
npx deepspace dev start
```

The dev server prints its URL, normally `http://127.0.0.1:5173/`.

## Checks

```sh
npx tsc --noEmit
npx vitest run
npx vite build
npx deepspace test run all --port 5199
```

`deepspace test run` starts its own server. Pass `--port` when 5173 is already in use. Two-account browser tests need test accounts:

```sh
npx deepspace test accounts create --email counterpoint-a@deepspace.test --name "Counterpoint A" --password-stdin
```

## Limits

Each investigation makes three searches and keeps at most eight sources. Classification and synthesis are each one model call. Daily caps, per UTC day and per signed-in user: 8 investigations, 8 reclassifications, 16 syntheses. Search and the model cannot be called from the browser. See `docs/DECISIONS.md` and `docs/TEST_RESULTS.md`.
