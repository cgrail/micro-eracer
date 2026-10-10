---
name: todo
description: Work the next item(s) off todo.md in this repo, one item at a time, checked headlessly, with one commit per finished item. Use when asked to "work on the todos", "do the next todo" or "keep going through todo.md", or when handed a todo item by name.
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

## The list

!`cat todo.md`

`todo.md` at the repo root is the backlog. `[ ]` is open and `[x]` is done. Done items stay in the file as a record; they are not deleted.

Arguments, if any, name which item(s) to take (a number, a keyword, "all"). With no arguments, take the **topmost `[ ]` item** and keep going down the list until the context or usage limit stops you. If a later item is a prerequisite for an earlier one, do it first and say so in its commit body.

## One item = one commit

Do **not** batch items. For each item, in order:

1. **Read the item as a bug report, not a spec.** Most entries are one line of the user's shorthand ("when I was first I always ran out of battery"). Find the actual code before deciding what the fix is: the symptom is usually a small piece of a shared code path. For balance complaints, the stats `npm test` logs are the place to start.
2. **Locate it.** [CLAUDE.md](../../../CLAUDE.md) maps the three folders. A change usually touches more than one layer, so follow a feature through every layer it touches:
   - **Simulation:** `shared/src/race.ts`, `combat.ts`, `car.ts`, `track.ts`.
   - **Sync:** the schema and `sync()` in `server/src/RaceRoom.ts`, plus a message handler if the browser sends something new.
   - **Browser:** the state sync and `onEvent` in `client/src/game.ts`, models in `scene.ts`, sound in `audio.ts`, the HUD in `index.html`, `style.css` and `hud.ts`, and controls in `input.ts` (keys, and the touch pad and action button).
3. **Implement.** Match the surrounding code's idiom: terse, data-driven, comments only for the why, glossary terms from [CONTEXT.md](../../../CONTEXT.md).
4. **Check the constraints in CLAUDE.md** that the change touches. The ones that bite most often:
   - **Ownership:** each browser drives only its own E-Car. Anything the server does to a Player's E-Car goes out as a `RaceEvent` (applied by that browser) or a `spawn` bump (a jump), never by moving its body on the server.
   - **`shared/` runs in Node:** no DOM or browser APIs in it, and no networking.
   - **Never trust the browser:** new messages are validated on the server, as `isPose` does.
   - **Everything stays procedural:** no image, model, audio or font files (the CC0 voice clips are the one exception), and no third-party requests.
   - **Mobile:** touch has one action button, no brake, and a Back button only while stuck; a new action fits into the action button, not a new one. Check phone width and safe areas. Every extra mesh or material costs draw calls twice, because of `OutlineEffect`.
   - **Per-Seat state** lives on the `Seat` or in `views[seat]`, never in globals.
   - **File size:** files stay under about 300 lines. If a change makes an oversized file (`game.ts`, `scene.ts`, `audio.ts`, `race.ts`) grow, split it along a real seam as part of the item.
   - **Saved data:** stored `localStorage` values (`name`, `body`, `muted`, `steer`) keep loading.
5. **Verify what can be verified from here.**
   ```bash
   npm run typecheck   # tsc --noEmit over client, server and shared
   npm test            # Track checks, a headless Race per Track, Stranded/Recharge, Shield; logs balance stats
   npm run build       # Vite bundles cleanly (the chunk-size warning is known)
   ```
   When the item adds a mechanic or changes one, **extend `shared/src/race.test.ts`** with a check that would fail without it. For balance changes, compare the logged stats before and after. If a check needs a running server, start your own on another port (`PORT=2600`) and never stop the user's `npm run dev`. **Never** launch Chrome or a headless browser. The user does all in-browser testing; how it *looks*, *sounds* and *feels* is theirs to judge.
6. **Docs, only if something significant changed.**
   - A new subsystem, a changed invariant, or a rule a future edit could break: the matching section of [CLAUDE.md](../../../CLAUDE.md).
   - A player-visible feature, control or setting: [README.md](../../../README.md).
   - A new or changed game concept: its entry in [CONTEXT.md](../../../CONTEXT.md), as a glossary entry only.
   - A bug fix that changes no rule: none of them.
7. **Tick the item** in `todo.md`: `[ ]` → `[x]`. If the work revealed a follow-up the user should decide on, append it as a new `[ ]` line rather than doing it silently.
8. **Commit everything for that item together:** code, test additions, `todo.md` and docs. Use the repo's message style: an imperative subject of about 60 characters with no scope prefix ("Add soundtrack and systemd deployment"). Add a body only when the *why* isn't obvious from the subject. **Do not push:** a push to `main` goes live on the server within 5 minutes.

## Reporting

After each commit, tell the user in two or three lines:
- what the item turned out to be
- what changed
- **what to check by hand**: the in-browser checks you couldn't run, meaning how it looks, sounds and plays, on desktop and on a phone

Then start the next item without asking. Stop only when the list is empty, when an item needs a decision only the user can make, or when you run out of room.
