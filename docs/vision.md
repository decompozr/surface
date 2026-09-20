# Product vision

Artifact aims to let agents in any project create local interactive interfaces on demand, using MCP or CLI with skills to create, run, and mount pages and components so users can observe, interact, and guide iteration directly.

## Why this project

Text, code, and static screenshots do not always communicate an idea fully. Interactive pages let users change parameters, compare options, and inspect state, and can become lasting tools within a project.

The opportunity is to turn recurring work around service startup, dependency management, preview discovery, and error feedback into reliable capabilities that agents can reuse.

The project's value depends on a smooth feedback loop: an agent creates real source files, Artifact runs them, the user understands and validates the result through a page, and the agent makes further changes based on feedback.

## Main use cases

- Build an interactive feature prototype in an existing code repository.
- Create parameter controls, comparison pages, or data visualizations in a design or research project.
- Preview a component independently using sample data, props, and interaction states.
- Provide consistent startup, status queries, and preview discovery for an existing frontend project.
- Preview multiple projects without requiring them to share a framework or dependency versions.

## Core concepts

A **project** is an explicitly registered scope of local source files. It may be an existing frontend application or a separate workspace for pages inside a repository that otherwise has no frontend.

A **page** is a browser-accessible entry point that combines components, data, and interactions.

A **component** is reusable source code interpreted by its framework. A component preview needs a host page to supply props, styles, and the necessary context; it does not assume a Svelte component can be used directly as a React component.

**Mounting** brings a registered project and its runtime entry point under Artifact's management, associating project identity, runtime status, and a preview URL. Mounting alone does not mean copying an entire repository, automatically installing dependencies, or changing an existing application's configuration.

A **skill** describes how an agent discovers a project, selects an entry point, creates or modifies source files, runs a preview, and handles errors. CLI and MCP provide the executable capabilities; a skill should not be the only place where business rules are defined.

## Design principles

### Projects own their artifacts

Pages, components, configuration, and dependency declarations stay within the user's project. Artifact's runtime state can be reconstructed; continued use of the source files should not depend on a particular session or agent.

### Users choose the framework

Prioritize a good Svelte experience and use plain HTML/JS to validate the basic path. The framework adapter mechanism should allow gradual expansion, with actual runtime evidence for each framework's supported scope.

### Dependencies have clear ownership

Different projects may use different versions of the same package. Manage Artifact's own dependencies separately from mounted projects' dependencies, avoiding global installations that conceal missing project dependencies.

### Access methods share semantics

MCP and CLI should return consistent identity, status, preview URLs, and error information for the same project. Agents can work through either interface, and users can inspect and operate projects directly.

### Users can tell what actually happened

A process starting, a service becoming ready, a page becoming accessible, and an interaction passing inspection are distinct outcomes. Preview URLs should be associated with a specific project and current runtime instance. Failures should provide clear diagnostics so a page from an older instance is not mistaken for a new result.

### Local execution has explicit boundaries

The first phase targets local projects trusted by the user. Separate project dependencies and processes help manage execution, but do not constitute a security sandbox. Project registration, source access scope, and service lifecycles must be explicit. Supporting untrusted code would require a separately designed execution environment.

## First-phase scope

Validate the local service, project registration and mounting, page and component previews, project dependencies, feedback from source changes, and a minimal workflow connecting CLI and MCP.

Public hosting, collaboration between multiple users, production deployment, mixing components across frameworks, and untrusted code execution are outside the first experiment. Routing, server-side rendering, and specialized build systems implied by the goal of supporting any framework will be validated separately.

## A successful experience

After a user requests an interactive interface in an existing project, an agent can create a page, return a working preview, and continue making changes based on feedback. The user can inspect the source files, restart the preview, or hand the files to another agent to continue the work.

See the [experiment roadmap](exploration.md) for specific experiments and acceptance criteria.
