# Product vision

Surface aims to let agents in any project create local interactive interfaces on demand through MCP or CLI with skills, and receive user responses in their existing sessions so users can observe, interact, and guide iteration directly.

## Why this project

Text, code, and static screenshots do not always communicate an idea fully. Interactive pages let users change parameters, compare options, and inspect state, and can become lasting tools within a project.

The opportunity is to turn recurring work around service startup, dependency management, preview discovery, and error feedback into reliable capabilities that agents can reuse.

The project's value depends on a smooth feedback loop: an agent creates real source files, Surface runs them, the user understands and validates the result through a page, and page responses reach the originating agent session so it can continue working. The interface becomes a shared workspace for interaction with the agent.

## Main use cases

- Build an interactive feature prototype in an existing code repository.
- Create parameter controls, comparison pages, or data visualizations in a design or research project.
- Preview a component independently using sample data, props, and interaction states.
- Provide consistent startup, status queries, and preview discovery for an existing frontend project.
- Preview multiple projects without requiring them to share a framework or dependency versions.
- Select an option, submit a form, or confirm parameters in a page and send that input directly to the agent session that created the interaction.

## Core concepts

A **project** is an explicitly registered scope of local source files. It may be an existing frontend application or a separate workspace for pages inside a repository that otherwise has no frontend.

A **page** is a browser-accessible entry point that combines components, data, and interactions.

A **component** is reusable source code interpreted by its framework. A component preview needs a host page to supply props, styles, and the necessary context; it does not assume a Svelte component can be used directly as a React component.

**Mounting** brings a registered project and its runtime entry point under Surface's management, associating project identity, runtime status, and a preview URL. Mounting alone does not mean copying an entire repository, automatically installing dependencies, or changing an existing application's configuration.

A **skill** describes how an agent discovers a project, selects an entry point, creates or modifies source files, runs a preview, and handles errors. CLI and MCP provide the executable capabilities; a skill should not be the only place where business rules are defined.

An **agent session binding** records which existing conversation owns an interaction and how Surface can reach its execution environment. The agent introduces itself by registering its project, session identity, and supported delivery mechanism.

An **interaction request** associates a page action with the input the agent is asking for. A response carries structured user data and is routed through that request to the bound session.

## Design principles

### Projects own their artifacts

Pages, components, configuration, and dependency declarations stay within the user's project. Surface's runtime state can be reconstructed; continued use of the source files should not depend on a particular session or agent.

### Users choose the framework

Prioritize a good Svelte experience and use plain HTML/JS to validate the basic path. The framework adapter mechanism should allow gradual expansion, with actual runtime evidence for each framework's supported scope.

### Dependencies have clear ownership

Different projects may use different versions of the same package. Manage Surface's own dependencies separately from mounted projects' dependencies, avoiding global installations that conceal missing project dependencies.

### Access methods share semantics

MCP and CLI should return consistent identity, status, preview URLs, and error information for the same project. Agents can work through either interface, and users can inspect and operate projects directly.

### Users can tell what actually happened

A process starting, a service becoming ready, a page becoming accessible, and an interaction passing inspection are distinct outcomes. Preview URLs should be associated with a specific project and current runtime instance. Failures should provide clear diagnostics so a page from an older instance is not mistaken for a new result.

The same distinction applies to responses: saving a button submission, having the agent runtime accept it, and observing the agent act on it are separate outcomes.

### Page responses continue the existing conversation

The preferred interaction is to send input directly into the registered agent session. The agent should not need to keep a waiting tool call open. An adapter steers an active turn or starts a new turn in the same conversation when supported by that runtime. Delivery failures must remain visible; they must not silently create a replacement conversation.

### Local execution has explicit boundaries

The first phase targets local projects trusted by the user. Separate project dependencies and processes help manage execution, but do not constitute a security sandbox. Project registration, source access scope, and service lifecycles must be explicit. Supporting untrusted code would require a separately designed execution environment.

## First-phase scope

Validate the local service, project registration and mounting, page and component previews, project dependencies, feedback from source changes, and a minimal workflow connecting CLI and MCP. Include an early two-way experiment that sends a page response to a registered agent session and observes the agent update the page.

Public hosting, collaboration between multiple users, production deployment, mixing components across frameworks, and untrusted code execution are outside the first experiment. Routing, server-side rendering, and specialized build systems implied by the goal of supporting any framework will be validated separately.

## A successful experience

After a user requests an interactive interface in an existing project, an agent can create a page and return a working preview. The user selects an option or adjusts parameters and submits them; the response reaches the same agent conversation, and the agent updates the page accordingly. The user can inspect the source files, restart the preview, or hand the files to another agent to continue the work.

See [agent interaction](agent-interaction.md) for the proposed return path and the [experiment roadmap](exploration.md) for specific experiments and acceptance criteria.
