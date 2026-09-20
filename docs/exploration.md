# Experiment roadmap

The goal is to progressively validate whether agents in any project can create and run interactive interfaces. Record actual results at each step before expanding the scope. None of the following experiments has been run yet.

## Experiment 1: A complete loop for one project

Prepare a Svelte + TypeScript page and an interactive component in a local project. Use a minimal CLI to register the project, start it, and return a preview. Change the source and observe the browser update, then stop the runtime and restart it from the preserved source files.

Acceptance criteria:

- The user can open the returned URL and interact with the component.
- The page imports a local component and an explicitly declared third-party dependency.
- After a component changes, the browser reflects the current source; record the update mechanism and observed result.
- Compilation errors can be located, and the preview recovers after they are fixed.
- TypeScript type-checking results are recorded separately from development server startup results.
- Stopping releases managed processes and ports while preserving source files and the lockfile.
- A new session can restart the preview using project files, without depending on the original agent's conversation context.

Use this experiment to decide whether a minimal management service is necessary, whether the state model is sufficient, and whether the CLI operations have the right scope.

## Experiment 2: Two projects with different dependencies

Mount plain HTML/JS and Svelte/TS workspaces simultaneously, using different versions of the same package.

Acceptance criteria:

- Each preview uses its own declared dependency version.
- Stopping, modifying, or introducing a build error in one project does not prevent the other from running.
- Status and logs are clearly attributable to a project and runtime instance.
- Repeated mounting, occupied ports, and service restarts produce understandable outcomes without leaving unmanaged processes behind.

Use this experiment to validate project boundaries and assess the benefits and costs of one runtime process per project.

## Experiment 3: MCP and CLI interoperability

Expose minimal MCP access to the core operations used in the first two experiments, and write a skill based on the actual workflow.

Acceptance criteria:

- An agent can discover registered projects and start a preview.
- A runtime created through the CLI can be queried and stopped through MCP, and vice versa.
- Both interfaces return consistent project identities, runtime status, and diagnostics.
- After the agent follows the skill to create or modify a component, the user can validate the result in a browser.

## Experiment 4: Extend framework coverage

Choose an additional framework or an existing SvelteKit application and test whether the adapter protocol can handle its development server, routing, asset paths, and hot updates.

The acceptance criterion is a clear support matrix and documented failure conditions. Record any required specialized integration honestly; opening a single page does not establish support for an entire framework's capabilities.

## Evidence to retain for each experiment

Record the code revision, project configuration, startup procedure, expected and actual results, the user's browser inspection, and unresolved issues. Distinguish source creation, process readiness, page accessibility, and successful interaction checks.

## Open questions

- Should the first version focus on newly created small interfaces, or also cover existing frontend applications?
- How should multiple pages and components within one project be discovered and organized?
- Do preview URLs need to remain stable across runs? When is a shared proxy entry point worthwhile?
- Should projects start on demand, remain running in the background, or shut down when idle?
- How should permission to install dependencies, write files, and execute scripts be expressed in different agent environments?
- Do user inputs and results produced in a page need to be sent back to the agent? If so, through what explicit event interface?
- What evidence establishes support for a framework rather than just one example built with it?

Prioritize experiment 1. Update the architecture proposal as boundaries become clearer, while retaining the vision's long-term goals.
