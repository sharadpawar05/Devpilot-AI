---
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
createdAt: '2026-08-01'
updatedAt: '2026-08-01'
---

Generate a README for the following project:

**Project name**: {{project_name}}
**Language/Stack**: {{language}}

```{{language}}
{{code}}
```

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
- Prerequisites listed upfront
