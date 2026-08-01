---
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
createdAt: '2026-08-01'
updatedAt: '2026-08-01'
---

Analyze the performance of the following {{language}} code:

```{{language}}
{{code}}
```

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

Prioritized list of optimizations by impact.
