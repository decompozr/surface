# Product vision

Surface gives humans and agents a shared, extensible interactive environment for representing, manipulating, and simulating systems.

## Long-term vision

Projects need ways to make their systems, data, and ideas understandable and actionable. A person might adjust a design parameter, inspect an architecture graph, compare scenarios, or explore a simulation. An agent needs the structured meaning of that interaction so it can continue working and return an updated result.

Surface provides the runtime foundation for that exchange. A project creates an interactive representation, mounts it, and makes it available to people or agents. Interaction returns structured input to the responsible project or agent, which interprets it and updates the experience. Web pages and components are the first delivery form; the product's scope is the shared interactive environment.

Surface has value independently of DecompozR. DecompozR may produce experiences, consume their events, or coordinate capabilities, just as another project or agent can. Surface must operate without DecompozR-specific concepts or services.

The long-term direction includes experiences composed from Web, Graph, CAD, Simulation, Data, or other capabilities. Native representations and structured agent interfaces are possible future delivery forms. These are extension directions, not implemented features or requirements for v0. Domain computation belongs to the relevant capability or project.

## Architecture boundaries

The conceptual architecture has three layers:

| Layer | Responsibility | Examples |
| --- | --- | --- |
| Experiences | Project-owned compositions that give an interaction its purpose and meaning | Architecture explorer, camera-mount designer, deployment selector |
| Capabilities | Rendering, domain computation, or integration used by an experience | Web rendering, graph operations, CAD geometry, physics simulation |
| Surface Core | Common runtime and interaction mechanisms | Identity, mounting, state coordination, event/action routing, resource ownership, access scope, lifecycle |

This separation guides implementation. It does not introduce a public plugin API, require new packages, or establish a universal experience schema. A capability protocol should emerge from concrete integrations. The current Svelte runtime is the first implementation path; moving runtime code into clearer modules can proceed without building a general plugin platform first.

### Projects own content and domain meaning

Projects retain their source files, definitions, dependency declarations, and authoritative domain data. A capability or project decides what a parameter means, which operations are valid, and how domain results are computed. Surface Core should not acquire CAD geometry rules, physics models, financial formulas, or DecompozR orchestration logic.

An experience can use a browser page without making “page” the universal product abstraction. Existing artifact IDs, manifests, and commands remain valid implementation contracts; this conceptual model does not rename or migrate them.

### State and actions have explicit owners

Shared interaction does not make Surface the authority for every project's state. Distinguish project domain data, temporary view state, and Surface's durable runtime and interaction records. Each experience defines whether a change is a local preview, a proposed value, or an applied domain change, and where the authoritative value is stored.

For example, dragging a camera-angle control can update a preview. Submitting the angle can ask an agent to revise the design. The experience defines those semantics; the transport must not treat a preview change as an instruction to apply it. An event reports an interaction or outcome; an action requests work under an explicit contract. Receiving either does not grant additional authority.

State, Actions, Events, Resources, Permissions, and Metadata are useful responsibility areas. They are not an adopted generic object schema, durable state engine, or complete permissions framework. Public contracts should be introduced only as their behavior and ownership become concrete.

### Interaction preserves identity and observable outcomes

CLI and MCP share operation semantics; skills teach their use while executable behavior lives in the implementation. Agent adapters route an interaction to its exact registered conversation; renderers do not choose a replacement session. The current implementation can steer an active Codex turn or continue an idle conversation through its supported adapter without requiring a waiting tool call. Other providers require their own verified adapters.

Saving a response, obtaining an adapter acknowledgement, and observing completed work are separate outcomes. Surface makes failures and uncertain delivery visible. The agent can publish a result or edit project source, and the experience can display that change without implying that every accepted submission has completed.

Likewise, a process starting, a runtime becoming ready, and a person successfully using an experience are distinct observations. Readiness and diagnostics must identify the current runtime instance so a stale preview cannot be mistaken for a new result.

### Runtime ownership stays bounded

Surface manages the resources and lifecycle needed to run its mounted experiences. Project dependencies remain separate from application dependencies. Unmounting and uninstalling preserve project source and data; durable interaction records have their own retention and recovery requirements.

The initial runtime executes trusted local code. A shared origin/compiler and scoped access checks do not establish a security sandbox. Extensibility does not itself promise execution isolation, arbitrary frontend compatibility, transparent state preservation, or unlimited uptime.

## v0 commitment

Deliver one useful loop with a bounded local Web implementation:

```text
Project creates interactive source
  -> Surface registers, mounts, and runs it
  -> Human opens the browser and interacts
  -> Structured input reaches the bound project/agent conversation
  -> The project or agent updates the result or interface
```

An agent can use this loop without DecompozR. For example, it creates a deployment selector in an ordinary project, mounts it, and receives the submitted strategy and regions in the same conversation. It then interprets those values and publishes a result or updates the interface. What “Apply” authorizes is part of that experience's contract.

The v0 implementation target is:

- Bun + TypeScript, one local service and application HTTP listener, a built SvelteKit management shell, and one live Vite/Svelte compiler.
- Project-owned Svelte component sources and scoped dependencies, explicit project identity, mounting, browser access, and readiness/error reporting. Mounted components render on the client; arbitrary mounted SvelteKit applications and mounted SSR are outside this contract.
- Shared CLI/MCP operations, structured interaction requests/responses/results, and delivery to an exact existing agent session through the supported adapter.
- Source iteration with scoped diagnostics and eligible HMR state preservation. Full refresh or compiler recreation can lose temporary view state.
- A supported installation/lifecycle workflow that separates releases, durable service state, and project content, with observable failures and data-preserving recovery.

This is a delivery target, not a claim that v0 is complete. The seven readiness experiments and [Milestone 1 shared project operations](implementation/01-project-core.md) establish parts of the loop. Supported packaging/lifecycle, runtime consolidation, management UI write flows, schema transitions, and resource policies remain implementation work. The [readiness review](server-readiness.md) records evidence and exit criteria.

### Deferred scope

v0 does not require a general capability registry or plugin marketplace, native renderers, a universal domain state/action schema, built-in CAD or simulation engines, or additional frontend frameworks. Projects can build useful visualizations with their supported dependencies without implying that Surface already offers those capabilities as platform services.

Public hosting, multi-user collaboration, remote access, untrusted code execution, arbitrary application hosting, and general agent orchestration are also outside v0. Future capabilities should address concrete user needs and validate their own contracts; they should not expand Core with domain-specific behavior.

## Delivery priority and success

The next implementation milestone is supported installation and lifecycle for this local Web loop. It must preserve the architecture boundaries above without making a generic capability platform a prerequisite. Follow the [implementation sequence](server-readiness.md#implementation-sequence-and-exit-criteria); introduce new experiments only for specific unanswered decisions.

Success means that a project can create an experience, a person can understand and manipulate it, the responsible project or agent receives meaningful structured input, and the resulting change is observable. The project retains its source and domain data so another session or agent can continue the work. Rendering a page alone does not complete that loop.

See [architecture](architecture.md) for the current topology and historical hypotheses, and [agent interaction](agent-interaction.md) for the implemented return path and its limits.
