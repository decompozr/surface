# Product vision

Surface helps people and agents make ideas tangible, clarify intent through interaction, and learn from observations and experiments.

Surface gives humans and agents a shared, extensible interactive environment for representing, manipulating, and simulating systems.

## Long-term vision

Projects need ways to make their systems, data, and ideas understandable and actionable. A person might adjust a design parameter, inspect an architecture graph, compare scenarios, or explore a simulation. An agent needs the structured meaning of that interaction so it can continue working and return an updated result.

Surface provides the runtime foundation for that exchange. A project creates an interactive representation, mounts it, and makes it available to people or agents. Interaction returns structured input to the responsible project or agent, which interprets it and updates the experience. Web pages and components are the first delivery form; the product's scope is the shared interactive environment.

Surface has value independently of DecompozR. DecompozR may produce experiences, consume their events, or coordinate capabilities, just as another project or agent can. Surface must operate without DecompozR-specific concepts or services.

The long-term direction includes experiences composed from Web, Graph, CAD, Simulation, Data, or other capabilities. Native representations and structured agent interfaces are possible future delivery forms. These are extension directions, not implemented features or requirements for v0. Domain computation belongs to the relevant capability or project.

## User value loop

The experience starts with an idea, a question, or a desired outcome:

```text
Express an idea
  -> Make it tangible
  -> Explore together
  -> Observe and clarify
  -> Refine the idea
  -> Begin the next exploration
```

Visual representations and interactivity help people express preferences, reveal constraints, compare alternatives, and examine assumptions. For example, “make this architecture simpler” might become a dependency diagram that a person can inspect and adjust. Comparing alternatives can reveal that the concern is how many systems a change touches. A small experiment can then produce observations that inform the next decision.

Creating pages, registering projects, and mounting folders provide the implementation mechanisms for this loop. The user value is a clearer understanding of intent, possibilities, and consequences. Clarifying intent is one important use of the shared environment; editing, operating systems, and presenting results remain part of the broader vision.

### Interpretation and evidence have explicit owners

Projects define the meaning of their representations and interactions. People and agents interpret observations, confirm intent, and decide what to do next. Surface Core provides the runtime and exchange mechanisms; it does not independently infer intent, validate hypotheses, or adopt requirements.

An interaction is an observation, not automatically confirmed intent. A previewed change is not automatically an instruction to apply it. An experiment result is evidence to interpret, not automatically a requirement or proof of a hypothesis. Experiences should make these distinctions visible and preserve the context needed to review how an observation informed a decision. Confirmation and authority follow the experience's explicit contract.

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

This is a delivery target, not a claim that v0 is complete. Shared project operations, supported installation/distribution, the workspace lifecycle, route navigation and recipient controls now have bounded implementation contracts. Management UI write flows, broader schema transitions, compiler/resource policies and integrated first-user acceptance remain open. See [current runtime requirements](../requirements/runtime.md) and [evaluation gaps](../evaluations/README.md); the [readiness review](../experiments/first-server-readiness.md) preserves earlier milestone evidence.

### Deferred scope

v0 does not require a general capability registry or plugin marketplace, native renderers, a universal domain state/action schema, built-in CAD or simulation engines, or additional frontend frameworks. Projects can build useful visualizations with their supported dependencies without implying that Surface already offers those capabilities as platform services.

Public hosting, multi-user collaboration, untrusted code execution, arbitrary application hosting, and general agent orchestration remain outside the current contract. Source setup supports bounded private Tailscale browser access; remote CLI management and automatic agent connectivity are not implied. Future capabilities should address concrete user needs and validate their own contracts; they should not expand Core with domain-specific behavior.

## Delivery priority and success

Installation and lifecycle are implemented for the bounded loop. Continue from a named unresolved requirement and its [evaluation gate](../evaluations/README.md), preserving the architecture boundaries above. The [historical implementation sequence](../experiments/first-server-readiness.md#implementation-sequence-and-exit-criteria) is evidence of earlier priorities, not a fresh instruction to repeat completed work.

Success means that a project can create an experience, a person can understand and manipulate it, the responsible project or agent receives meaningful structured input, and the resulting change is observable. The project retains its source and domain data so another session or agent can continue the work. Rendering a page alone does not complete that loop. For an exploration experience, success also means that observations help people and agents clarify a question, confirm intent, or choose a next experiment, while keeping observations, interpretations, and adopted decisions distinguishable.

See [current architecture](../architecture/components.md) and the separate [historical hypotheses](../experiments/architecture-exploration.md), and [agent interaction](../requirements/agent-interaction.md) for the implemented return path and its limits.
