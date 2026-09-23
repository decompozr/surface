# UI-CONTINUATION-02: keyboard bypass

Status: complete / independent review passed with one verifier correction, September 23, 2026. See [review.md](review.md) for the final disposition and remaining limits.
Baseline: origin/main 6dd908303bf83f5108caa96660e8ee70363771a5.

## Objective and authority

Implement the missing skip-to-content affordance identified by D-08 in ../../design/accessibility.md, then evaluate whether a fresh agent can finish verification from repository records alone. User authorized a small UI improvement, a planned midway interruption, fresh continuation, actual browser acceptance, and evidence-to-source updates. Work only in this worktree. Do not deploy, alter installed services, submit to live conversations, merge, or push. No additional agents. Discussion may be Chinese; records are English.

## Acceptance

- A keyboard user encounters an accessible skip link before repeated shell navigation. It becomes visibly discoverable on focus and transfers focus to the existing named Page content region without reloading the page or dropping URL request/token context.
- Destination is correct on home and a nested mounted route, with no duplicate IDs or focus hidden beneath a mobile drawer.
- Verify keyboard behavior at desktop and 390px mobile; include 320px reflow and an open-drawer case. Existing navigation/collapse/Escape and contained wide content behavior must still pass.
- Use disposable browser fixture projects/adapters only, built from this worktree. Capture actual rendered screenshots and inspect them; do not claim assistive-technology or physical-device acceptance.
- Run relevant type/Svelte checks and browser verifier(s); report actual failures and remaining gaps. Update D-08/E-12, findings and project-continuation progress with bounded evidence. Do not claim full E-12 or project autonomy.

## Two phases

Phase A: reconstruct scope, choose the smallest behavior, implement the UI and a focused browser regression verifier. Stop before running the browser acceptance. Record exact changed files, decisions, commands already run, environment/dependencies/processes, pending effects, acceptance remaining, failures and next action in checkpoint.md. Finish your turn at this planned boundary; do not mark the task complete.

Phase B: receive only the repository task/checkpoint pointer, write intake.md before edits, inspect WIP and reconstruct the work. Finish checks and browser acceptance, fix issues, record evidence and limits, update source docs and completion.md. Independent coordinator review follows. A planned checkpoint is not crash recovery. Preserve records of failed attempts.
