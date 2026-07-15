# AI 无限画布自由创作平台 - Agent Startup Protocol

This file is the repository-level startup protocol for AI IDE agents.

Keep this file short. Do not duplicate project architecture, product decisions, implementation plans, or development rules that already live in the Obsidian knowledge base.

---

## 1. Required First Step

Before making any non-trivial code change, the agent must:

1. Understand the user's current request.
2. Use the `obsidian-vault` skill to read the project knowledge base.
3. Start from the project index and agent entry documents.
4. Let the knowledge base decide which related documents are relevant.

Project knowledge base path:

```txt
E:\个人知识库\AI无限画布自由创作平台
```

Required entry files:

```txt
AI无限画布自由创作平台 Index.md
Agent 阅读指南.md
```

The `obsidian-vault` skill may have a different default vault path. For this repository, always use the path above.

---

## 2. Source Of Truth

The Obsidian knowledge base is the source of truth for:

- project architecture
- product scope
- implementation stages
- node protocol rules
- workflow model rules
- capability routing rules
- development record requirements
- current progress and next steps

This file only defines repository startup behavior and constraints that must exist before the knowledge base can be used correctly.

If this file conflicts with the Obsidian knowledge base, prefer the knowledge base unless the conflict is about the local repository path, tool usage, or package manager.

---

## 3. Repository-Local Constraints

Use these local constraints while working in this repository:

- Use Bun for package management and scripts.
- Use `bun install`, `bun add`, and `bun run`.
- Do not add `package-lock.json`.
- Do not use npm as the routine package manager.
- Preserve user changes in the working tree.
- Do not revert unrelated files.
- After testing or temporary verification, clean up disposable test files, temp scripts, generated junk files, and other non-deliverable artifacts created during the task. Do not leave unnecessary test outputs in the repository.

Common validation commands:

```txt
bun run typecheck
bun run build
```

Run the validation commands that match the scope of the change.

---

## 4. Obsidian Write-Back

For meaningful development tasks, update the Obsidian records required by the knowledge base.

Typical write-back targets include:

```txt
开发记录/
开发记录索引.md
工程化落地进度台账.md
```

Do not invent a separate record system inside the code repository.

---

## 5. Agent Reminder

Do not work from source code alone.

Use this file to locate and enter the knowledge base. Use the knowledge base to understand the project.
