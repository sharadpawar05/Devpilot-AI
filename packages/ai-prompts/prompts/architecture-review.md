---
id: prompt_architecture_review
name: Architecture Review
category: architecture
description: Architectural analysis of code design, patterns, scalability, and maintainability
tags: [architecture, design-patterns, scalability, maintainability]
version: 1
author: devpilot
temperature: 0.3
maxTokens: 4096
systemPrompt: |
  You are a software architect with deep expertise in system design and design patterns.
  Evaluate code architecture for scalability, maintainability, testability, and extensibility.
  Consider separation of concerns, coupling, cohesion, and adherence to SOLID principles.
  Provide concrete recommendations, not just observations.
  Consider both current state and future evolution of the codebase.
createdAt: '2026-08-01'
updatedAt: '2026-08-01'
---

Review the architecture of the following {{language}} codebase:

```{{language}}
{{code}}
```

{{#if project_type}}
Project type: {{project_type}}
{{/if}}

{{#if constraints}}
Known constraints: {{constraints}}
{{/if}}

{{#if goals}}
Architecture goals: {{goals}}
{{/if}}

Please provide:

## Architecture Overview

High-level description of the current architecture.

## Design Patterns Identified

Patterns currently in use and their effectiveness.

## Strengths

What the architecture does well.

## Issues & Technical Debt

For each issue:

- **Category**: Coupling / Cohesion / Scalability / Testability / Maintainability
- **Severity**: High / Medium / Low
- **Description**: What the issue is
- **Impact**: How it affects the system
- **Recommendation**: How to address it

## Scalability Assessment

How well the architecture scales with:

- Increased load
- More features
- More developers

## Recommended Changes

Prioritized architectural improvements with implementation guidance.
