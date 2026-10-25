# Next steps

Chat with the agents is real: private chat and broadcast answer through the configured AI provider
(`src/main/engine/chat.ts`, `src/main/engine/pipeline/agentChat.ts`). Every agent has persistent memory
(`src/main/engine/memory.ts`). The office has three rooms (Brain, Office work, Personal work), and room agents
(`src/main/engine/roomAgents.ts`) feed the Inbox on a schedule or on demand. Chief (`pipeline/chief.ts`)
routes requests to them. A missing provider or a failed call is an error for that agent, never a fake reply.

## Not verified yet
- **Everything that needs a real provider.** Only the UI, the camera, the drawer and memory file persistence
  have been run. Run `npm run dev`, add a key in Settings, then:
  - In Agents, press Run now on Meeting Scribe; expect a note in the Inbox tagged Office, ingested by the brain agents.
  - Turn on a schedule in Settings > Agents and check it fires (daily runs once per local day after the set time).
  - Ask Chief "ask the scribe to summarise my week", "note: buy milk" and "digest".
  - Chat with an agent, restart, and check the history and memory are still there.
  - Use a wrong key and expect a clear error banner.
- **Engine tests** (`node scripts/engine-test/run.mjs`) were not run after the room/agent/memory work. Some already
  expected exactly six broadcast recipients and an older `ChatService` signature; the background memory call may
  also use up the fake server's scripted replies.
- **Windows installer** and the preview mock (`scripts/ui-preview/mockApi.ts`, still canned chat text).

## Known limits
- Room agents do not walk to Pip in the 3D office yet, and have no per-room key-light shadows beyond the shared one.
- Graph nodes are not coloured by room (the room filter works).
- Placeholder portraits and colours for Chief and the four room agents.
- The dividing walls between rooms hide part of the view from some camera angles.
- The chat transcript file grows without limit (only loading is capped at 200 messages).
- If the knowledge folder changes while a reply is in flight, that reply is shown but not saved.
- Chief's room-agent runs have no timeout and run one after another before it replies.
- There is no "run now with instruction" box in the Agents view; instructions only come through Chief.
- A broadcast waits for the slowest agent (up to the 60 s timeout) before the dialog shows results.

## Later, only if wanted
1. Real connectors for the room agents (email, watched folders, RSS), instead of LLM-written notes only.
2. Per-room AI provider or model, and run cost limits.
3. Show each agent's broadcast result as it arrives instead of all at once.

## Checks
`npm run typecheck`, `npx electron-vite build`, `node scripts/engine-test/run.mjs`,
`xvfb-run -a -s "-screen 0 1700x1200x24" node scripts/ui-e2e.mjs` (needs the build; run one at a time).
