# Observation index

Observations record what was measured, reported or found to fail. They do not independently adopt behavior. Each row below points to provenance and limits; [findings](findings.md#september-23-synthesis-and-disposition) records source dispositions. This documentation task adds source inspection and documentation checks, not new runtime telemetry, browser captures or user acceptance.

| Kind | Observation and provenance | Limit / disposition |
| --- | --- | --- |
| Telemetry | [Lifecycle resources, September 21](../experiments/2026-09-21-lifecycle-resources.md): 30 cycles over 180.115 seconds; repeated-source resources stabilized, distinct-source compiler metadata retained | Historical bounded measurement, not a supported uptime budget. [R-07](../requirements/runtime.md) / [E-04](../evaluations/runtime-eval.md#e-04-dependencies-diagnostics-and-hmr). |
| Telemetry | [Installed lifecycle](../experiments/2026-09-21-installation.md) and [public verification](../architecture/workspace-service.md#historical-verification-before-compatibility-removal): owned host cleanup and persistence at recorded revisions | Separate source snapshots/environments; not fresh evidence for current WIP. [E-02](../evaluations/runtime-eval.md#e-02-installation-and-lifecycle). |
| Reported user feedback | [Task user outcome](../experiments/docs-takeover/task.md#user-outcome): missing UI design docs and request for concrete contracts | Reported requirement for this task, not an observed UI usability failure. Incorporated into [design](../design/README.md); [independent review passed](../experiments/2026-09-23-docs-takeover.md). |
| Reported user direction | [Imported reflection](2026-09-23-reflection-input.md): experiments should feed back into source docs; desire for repository-based continuation | Earlier interpretation retained with its baseline and scope. Incorporated in [source workflow](../source-workflow.md); general autonomy remains proposed. |
| Reported feedback from absent WIP | Earlier reflection reports screenshots/comments interactions in another worktree | Comments source and referenced September 23 records are absent here. Not independently inspected, not current implementation evidence. No comments requirements adopted. |
| Incident | [Findings: callback reachability](findings.md#delivery-completion-and-user-acceptance-need-separate-evidence): initial live recipient could receive input but could not reach the result API | Historical environment mismatch; delivery does not establish callback capability and Surface does not change agent permissions. |
| Incident | [Dependency run](../experiments/2026-09-21-dependencies.md): browser execution failed despite compilation readiness | Historical fix/evidence strengthens direct-browser E-04; no arbitrary dependency compatibility claim. |
| Incident | [Resource run](../experiments/2026-09-21-lifecycle-resources.md): failure path retained active watchers/access; corrected within that experiment | Historical correction, no indefinite resource guarantee. |
| Source observation | [UI audit](../experiments/docs-takeover/ui-source-audit.md), independently checked by Phase B against source | Navigation/recipient behavior exists; gaps are [D-04/D-09](../design/interactions.md) and [D-08](../design/accessibility.md). Source inspection is not rendered proof. |
| Documentation verification | [Successor completion](../experiments/docs-takeover/completion.md) | Actual link/anchor/traceability and diff checks only; coordinator review is separate. |

## Retention and missing evidence

The [prior findings input](2026-09-23-reflection-input.md) and [full prior autonomy input](2026-09-23-autonomy-input.md) are dated, provisional interpretations based on `a97e34f`. Preserve them even where current main supersedes them. Missing-record names are retained as literal provenance descriptions, not fabricated links or new experiment reports.

Detailed screenshots, receipts and session endpoints may exist only in ignored local evidence directories named by the original experiments. Their existence is not freshly verified here and they are not portable public proof. New observations should state date, source revision/environment, fixture/live/user origin, expected versus actual outcome, failure/uncertainty and linked disposition. Do not relabel fixture input as user feedback.
