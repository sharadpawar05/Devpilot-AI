---
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
createdAt: '2026-08-01'
updatedAt: '2026-08-01'
---

Help me debug the following issue:

**Language**: {{language}}
**Error/Problem**: {{error}}

```{{language}}
{{code}}
```

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

How to verify the fix works correctly.
