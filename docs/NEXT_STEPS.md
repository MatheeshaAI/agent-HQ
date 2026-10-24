# Next steps

Chat with the agents is now real: private chat and broadcast answer through the configured AI provider
(`src/main/engine/chat.ts`, `src/main/engine/pipeline/agentChat.ts`). Agents answer in character from their
role and live status (Muse and Nova also see the wiki page list). Chat is read-only and history is in memory.
A missing provider or a failed call is an error for that agent, never a fake reply.

## Not verified yet
- **Real provider calls.** Only `scripts/fake-claude.mjs` has answered so far. Run `npm run dev`, add a key
  (or pick the Claude Code CLI) in Settings, add a note or two, then:
  - ask Muse "What's in the wiki?" and Pip "What are you doing?";
  - broadcast "Status check" and expect six separate replies;
  - use a wrong key and expect a clear per-agent error.
  Fix anything that reads badly (prompts live in `agentChat.ts`).
- **Windows.**
- **Screenshots** of the agent drawer and the broadcast results.
- **Speaking cue with long real delays.** It follows the renderer's pending state, but was only run with 300 ms fake replies.

## Known limits
- A broadcast waits for the slowest agent (up to the 60 s timeout) before the dialog shows results.
- The preview mock (`scripts/ui-preview/mockApi.ts`) still returns canned chat text.

## Later, only if wanted
1. Let chat trigger actions (e.g. "Pip, file this note"). Needs a design: which actions, and a confirmation step.
2. Keep chat history across restarts (per room, in the knowledge folder).
3. Show each agent's broadcast result as it arrives instead of all at once.

## Checks
`npm run typecheck`, `npx electron-vite build`, `node scripts/engine-test/run.mjs`,
`xvfb-run -a -s "-screen 0 1700x1200x24" node scripts/ui-e2e.mjs` (needs the build; run one at a time).
