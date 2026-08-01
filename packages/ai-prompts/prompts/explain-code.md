---
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
createdAt: '2026-08-01'
updatedAt: '2026-08-01'
---

Explain the following {{language}} code:

```{{language}}
{{code}}
```

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
{{/if}}
