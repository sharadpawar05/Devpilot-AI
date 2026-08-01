---
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
createdAt: '2026-08-01'
updatedAt: '2026-08-01'
---

Generate tests for the following {{language}} code:

```{{language}}
{{code}}
```

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

What is covered and what might need additional testing.
