import type { LoadedPrompt } from './loader';
import { parseMarkdownPrompt } from './loader';

const CODE_REVIEW = `---
id: prompt_code_review
name: Code Review
category: code_review
description: Comprehensive code review with actionable feedback on correctness, performance, security, and maintainability
tags: [code-review, quality, best-practices]
version: 1
author: devpilot
temperature: 0.2
maxTokens: 4096
variables:
  - name: language
    description: Programming language of the code
    required: true
    type: string
  - name: code
    description: The source code to review
    required: true
    type: string
  - name: reviewType
    description: Type of review to perform
    required: true
    type: string
  - name: context
    description: Additional context about the code
    required: false
    type: string
systemPrompt: |
  You are an expert code reviewer with deep knowledge of software engineering best practices.
  Review code for correctness, performance, security, and maintainability.
  Provide specific, actionable feedback with code examples where appropriate.
  Rate each issue by severity: Critical, Major, Minor, or Suggestion.
  Always explain WHY something is an issue and HOW to fix it.
  Always respond in Markdown format with clearly defined sections.
createdAt: "2026-08-01"
updatedAt: "2026-08-01"
---

Review the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#if context}}
Context: {{context}}
{{/if}}

Review Type: {{reviewType}}

Please provide a thorough review in the following structure:

# Executive Summary

A concise summary of the code quality and your overall assessment.

# Overall Score

Return a score out of 10 (e.g., **8.6 / 10**) with a brief justification.

# Strengths

Bullet list of what the code does well.

# Issues Found

For each issue, provide:
- **Severity**: Critical / Major / Minor / Suggestion
- **Location**: Line or function name
- **Description**: What the issue is
- **Recommendation**: How to fix it

# Performance Analysis

Identify performance bottlenecks, inefficiencies, and optimization opportunities.

# Security Analysis

Identify security vulnerabilities, injection risks, and data exposure concerns.

# Maintainability

Assess code readability, modularity, testability, and documentation.

# Clean Code Review

Evaluate naming conventions, code duplication, single responsibility, and adherence to clean code principles.

# Suggested Refactored Code

Provide a refactored version of the code addressing the key issues found. Use a markdown code block.

# Final Recommendations

Prioritized list of the most important improvements to make.`;

const DEBUG_CODE = `---
id: prompt_debug_code
name: Debug Code
category: debugging
description: Systematic debugging assistance to identify root causes and provide fixes
tags: [debugging, errors, troubleshooting]
version: 1
author: devpilot
temperature: 0.2
maxTokens: 4096
systemPrompt: |
  You are an expert debugger with deep knowledge of software errors and troubleshooting.
  Analyze the provided code and error systematically.
  Identify the root cause before suggesting fixes.
  Consider edge cases and potential side effects of any fix.
  Provide step-by-step debugging guidance when the root cause is unclear.
createdAt: "2026-08-01"
updatedAt: "2026-08-01"
---

Help me debug the following issue:

**Language**: {{language}}
**Error/Problem**: {{error}}

\`\`\`{{language}}
{{code}}
\`\`\`

{{#if steps_to_reproduce}}
Steps to reproduce:
{{steps_to_reproduce}}
{{/if}}

{{#if environment}}
Environment: {{environment}}
{{/if}}

Please provide:

## Root Cause Analysis
Explain what is causing this issue and why.

## Affected Code
Point to the specific lines or functions involved.

## Proposed Fix
Provide the corrected code with explanation.

## Prevention
How to prevent this type of issue in the future.

## Testing
How to verify the fix works correctly.`;

const EXPLAIN_CODE = `---
id: prompt_explain_code
name: Explain Code
category: explanation
description: Clear, detailed explanation of code functionality, patterns, and design decisions
tags: [explanation, learning, documentation]
version: 1
author: devpilot
temperature: 0.3
maxTokens: 4096
systemPrompt: |
  You are a skilled technical educator who explains code clearly and thoroughly.
  Adapt your explanation depth to the audience level provided.
  Use analogies and examples to make complex concepts accessible.
  Highlight key patterns, design decisions, and potential gotchas.
createdAt: "2026-08-01"
updatedAt: "2026-08-01"
---

Explain the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#if audience}}
Audience level: {{audience}}
{{/if}}

{{#if focus_areas}}
Focus on: {{focus_areas}}
{{/if}}

Please provide:

## Overview
What does this code do? What problem does it solve?

## How It Works
Step-by-step walkthrough of the logic.

## Key Concepts
Important patterns, data structures, or algorithms used.

## Design Decisions
Why was this approach chosen? What are the trade-offs?

{{#if audience}}
## {{audience}}-Friendly Summary
A simplified explanation appropriate for the stated audience level.
{{/if}}`;

const GENERATE_TESTS = `---
id: prompt_generate_tests
name: Generate Tests
category: testing
description: Generate comprehensive test cases including unit, integration, and edge case tests
tags: [testing, unit-tests, tdd, quality]
version: 1
author: devpilot
temperature: 0.2
maxTokens: 4096
systemPrompt: |
  You are an expert test engineer who writes thorough, maintainable tests.
  Generate tests that cover happy paths, edge cases, and error scenarios.
  Follow the testing conventions of the specified framework.
  Each test should be independent, readable, and have clear assertions.
  Use descriptive test names that explain the expected behavior.
createdAt: "2026-08-01"
updatedAt: "2026-08-01"
---

Generate tests for the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

**Testing framework**: {{framework}}
**Test type**: {{test_type}}

{{#if additional_context}}
Additional context: {{additional_context}}
{{/if}}

Please provide:

## Test Plan
Outline the test scenarios to cover.

## Test Code
Write the complete test code using {{framework}} conventions.

Include tests for:
- Happy path / expected behavior
- Edge cases (empty input, null, boundary values)
- Error handling / invalid input
- {{#if integration}}Integration scenarios{{/if}}

## Coverage Notes
What is covered and what might need additional testing.`;

const README_GENERATOR = `---
id: prompt_readme_generator
name: README Generator
category: documentation
description: Generate comprehensive README documentation from code analysis
tags: [documentation, readme, onboarding]
version: 1
author: devpilot
temperature: 0.3
maxTokens: 4096
systemPrompt: |
  You are a technical writer who creates clear, comprehensive documentation.
  Generate README content that helps developers understand, install, and use the project.
  Include practical examples and clear instructions.
  Follow README best practices: badges, clear sections, code examples, contributing guide.
createdAt: "2026-08-01"
updatedAt: "2026-08-01"
---

Generate a README for the following project:

**Project name**: {{project_name}}
**Language/Stack**: {{language}}

\`\`\`{{language}}
{{code}}
\`\`\`

{{#if description}}
Project description: {{description}}
{{/if}}

{{#if features}}
Key features: {{features}}
{{/if}}

Please generate a complete README with:

## Structure
1. Project title and badges
2. One-paragraph description
3. Features list
4. Installation instructions
5. Usage examples
6. Configuration (if applicable)
7. API reference (if applicable)
8. Contributing guidelines
9. License

## Requirements
- Clear, copy-pasteable commands
- Working code examples
- Prerequisites listed upfront`;

const SECURITY_REVIEW = `---
id: prompt_security_review
name: Security Review
category: security
description: Security-focused code review identifying vulnerabilities and recommending mitigations
tags: [security, vulnerabilities, owasp, hardening]
version: 1
author: devpilot
temperature: 0.1
maxTokens: 4096
systemPrompt: |
  You are a security expert specializing in application security and secure coding practices.
  Review code for security vulnerabilities following OWASP Top 10 and industry standards.
  Identify both obvious and subtle security issues.
  Provide specific remediation steps, not just warnings.
  Consider the full attack surface including input validation, authentication, authorization, and data exposure.
createdAt: "2026-08-01"
updatedAt: "2026-08-01"
---

Perform a security review of the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#if context}}
Application context: {{context}}
{{/if}}

{{#if threat_model}}
Known threat model: {{threat_model}}
{{/if}}

Please provide:

## Security Assessment
Overall security posture and risk level.

## Vulnerabilities Found
For each vulnerability:
- **Severity**: Critical / High / Medium / Low
- **Category**: (e.g., Injection, XSS, CSRF, Auth Bypass, Data Exposure)
- **CWE**: Relevant CWE ID if applicable
- **Location**: Specific code location
- **Description**: What the vulnerability is
- **Exploit Scenario**: How it could be exploited
- **Remediation**: Specific fix with code example

## Security Best Practices
Recommendations for the identified technology stack.

## Compliance Notes
Relevant compliance considerations (GDPR, SOC2, etc.).`;

const PERFORMANCE_REVIEW = `---
id: prompt_performance_review
name: Performance Review
category: performance
description: Performance analysis identifying bottlenecks, optimization opportunities, and efficiency improvements
tags: [performance, optimization, profiling, efficiency]
version: 1
author: devpilot
temperature: 0.2
maxTokens: 4096
systemPrompt: |
  You are a performance engineering expert who identifies bottlenecks and optimization opportunities.
  Analyze code for time complexity, space complexity, I/O efficiency, and memory usage.
  Consider both micro-optimizations and architectural performance improvements.
  Quantify impact where possible and prioritize by ROI.
  Balance performance gains against code readability and maintainability.
createdAt: "2026-08-01"
updatedAt: "2026-08-01"
---

Analyze the performance of the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

{{#if context}}
Context: {{context}}
{{/if}}

{{#if scale}}
Expected scale: {{scale}}
{{/if}}

{{#if metrics}}
Current performance metrics: {{metrics}}
{{/if}}

Please provide:

## Performance Analysis
Overview of performance characteristics.

## Bottlenecks Identified
For each bottleneck:
- **Impact**: High / Medium / Low
- **Location**: Specific code location
- **Issue**: What makes it slow
- **Current Complexity**: Time/space complexity
- **Optimized Approach**: How to improve it
- **Expected Improvement**: Estimated gain

## Algorithmic Improvements
Better algorithms or data structures to use.

## I/O & Memory
Database queries, network calls, memory allocation patterns.

## Recommendations
Prioritized list of optimizations by impact.`;

const ARCHITECTURE_REVIEW = `---
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
createdAt: "2026-08-01"
updatedAt: "2026-08-01"
---

Review the architecture of the following {{language}} codebase:

\`\`\`{{language}}
{{code}}
\`\`\`

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
Prioritized architectural improvements with implementation guidance.`;

const markdownSources: Record<string, string> = {
  'code-review': CODE_REVIEW,
  'debug-code': DEBUG_CODE,
  'explain-code': EXPLAIN_CODE,
  'generate-tests': GENERATE_TESTS,
  'readme-generator': README_GENERATOR,
  'security-review': SECURITY_REVIEW,
  'performance-review': PERFORMANCE_REVIEW,
  'architecture-review': ARCHITECTURE_REVIEW,
};

export function loadMarkdownPrompts(): LoadedPrompt[] {
  return Object.values(markdownSources).map(parseMarkdownPrompt);
}

export function getMarkdownPrompt(id: string): LoadedPrompt | undefined {
  const source = markdownSources[id];
  if (!source) return undefined;
  return parseMarkdownPrompt(source);
}

export const MARKDOWN_PROMPT_IDS = Object.keys(markdownSources);
