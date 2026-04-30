# DStack Benchmarking

Benchmark suites live in `.dstack/benchmarks/{suite}.yaml`.

```yaml
name: default
description: Smoke test prompts
model: gemini-2.0-flash-001
prompts:
  - id: clarity
    prompt: Summarize the project goal clearly.
    criteria:
      - clarity
    expectedOutputContains:
      - project
    scoringRubric: Clear project summary
```

Run a single-model benchmark:

```bash
ds /benchmark --suite default --provider=fake
```

Compare models:

```bash
ds /benchmark-models --suite default --models gemini-2.5-pro,gemini-2.0-flash --provider=fake
```

Offline mode uses deterministic fake-provider responses so benchmark wiring can be tested without API keys or live quota.
