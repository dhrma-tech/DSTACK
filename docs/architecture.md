# DStack Architecture

DStack is a CLI-native workflow orchestration system. The Phase 1 implementation is a TypeScript monorepo with shared contracts, a core runtime, and a `ds` CLI package.

The runtime path is:

`CLI -> ConfigManager -> SkillRegistry -> SkillExecutor -> PromptTemplateEngine -> ModelRouter -> ToolExecutor -> ArtifactStore`

All artifacts, logs, memory, browser screenshots, and checkpoints are stored under `.dstack/`.
