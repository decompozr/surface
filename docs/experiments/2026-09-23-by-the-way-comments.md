# By-the-way comment delivery

## User-selected behavior

The user prefers Steer as a conversational “by the way”: receive input during ongoing work, briefly acknowledge it, keep the original objective and decide whether to continue, address the new input immediately or defer it. Queue remains an alternative. The adopted bounded contract is in [agent interaction](../requirements/agent-interaction.md#mounted-page-contextual-comments-september-24-adoption). It does not authorize arbitrary scheduling, new agents or unrelated edits.

## Implementation

The live comments footer displays the default By the way preference and After the current task alternative while there are unsent comments. The batch freezes its handling preference and inspected recipient status/turn. Active recipients use Steer or Queue; idle/not-loaded recipients use Start. Existing Core/adapter checks reject changed status/turns. Only a positively identified preflight rejection restores an unsent draft. Other failures retain the same batch for GET-only inspection; neither refresh, SSE reconnection nor reload resends.

The delivered user-preference data requests acknowledgement and processing order without replacing the original objective. An exact JSON callback supports an authenticated `acknowledged` stage and optional next action, followed by a `completed` result. Legacy result messages remain ordinary replies. Delivered/Queued labels represent transport acceptance only; they never claim the model has acknowledged or finished. This requests model behavior rather than guaranteeing immediate provider execution.

## Verification and limits

- TypeScript and Svelte checks pass.
- Comment/service/adapter tests exercise explicit Steer, Queue receipt identity, changed-turn preflight rejection, duplicate protection, unknown delivery, retained PNG context and separate acknowledgement/completion publication.
- The full-loop browser harness uses real HTTP, persistence, callback CLI and SSE with a fake provider socket. Desktop Chromium selects default Steer; mobile WebKit selects Queue. Both change the observed turn before the first click, retain the unsent draft, explicitly refresh/send, drop the POST response after acceptance, inspect by GET, display acknowledgement followed by completion, disconnect/reconnect and reload with one provider delivery.
- The first browser attempt failed because a status locator also matched a slider output. Scoping it to the comment review region corrected the verifier; that attempt is not passing evidence.
- Screenshots and traces are retained under ignored `.decompozr/surface/comments-by-the-way/`. This does not establish real-model acknowledgement timing or physical-phone acceptance. No fixture input reached a real conversation.

Other Surface and design-system author tasks were inspected as idle before edits; their original worktrees and private preview were preserved.

## Superseding user feedback

The user subsequently rejected the phrase as product policy, mandatory acknowledgement/completion pairs and repeated prompt instructions. The [current contract](../requirements/agent-interaction.md#typed-comments-and-concise-replies) uses minimal typed events and skill-owned replies. Earlier observations above remain historical.
