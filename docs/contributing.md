# Contributing

Use `pnpm install`, `pnpm build`, and `pnpm test`.

Tests use `FakeProvider`; they must not call the live Gemini API. New skills should add a manifest, prompt, handler, and integration coverage.
