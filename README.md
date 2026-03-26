# cover-2

A GitHub Action that parses LCOV coverage files and posts a coverage report as a PR comment, with per-file **deltas** showing how coverage changed between the base and head branches.

![Coverage](https://img.shields.io/badge/coverage-99.2%25-brightgreen)

## Features

- **LCOV input** — works with any test framework that produces LCOV files (Jest, Vitest, c8, nyc, llvm-cov, gcov, etc.)
- **Coverage deltas** — shows per-file coverage change between base and head branches
- **PR comments** — creates or updates a single comment per PR (no duplicate spam)
- **Health indicators** — configurable thresholds with :white_check_mark: :warning: :x: icons
- **Shields.io badge** — optional coverage badge in the comment
- **Glob support** — match multiple coverage files (e.g. monorepo with `packages/*/coverage/lcov.info`)
- **Multiple instances** — use `comment-header` to post separate comments for unit tests, integration tests, etc.
- **Baseline storage** — automatically save and retrieve coverage baselines via a dedicated git branch — no checkout dance required

## Quick Start

```yaml
name: Coverage
on:
  pull_request:

permissions:
  pull-requests: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test -- --coverage
      - uses: mcclurejt/cover-2@v1
        with:
          head-lcov-file: coverage/lcov.info
```

## Usage with Deltas (Recommended)

The easiest way to get coverage deltas is with **baseline storage**. The action saves a coverage snapshot to a dedicated branch on every push to main, then automatically fetches it for comparison on PRs.

```yaml
name: Coverage
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: write
  pull-requests: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test -- --coverage

      # On PRs: post comment with delta from baseline
      - if: github.event_name == 'pull_request'
        uses: mcclurejt/cover-2@v1
        with:
          head-lcov-file: coverage/lcov.info
          baseline-from: coverage-baseline

      # On push to main: update the baseline
      - if: github.event_name == 'push'
        uses: mcclurejt/cover-2@v1
        with:
          head-lcov-file: coverage/lcov.info
          save-baseline: coverage-baseline
```

This creates an orphan branch called `coverage-baseline` that stores the LCOV file. No checkout dance, no re-running tests against the base branch.

### Manual Deltas

You can also provide base/head LCOV files directly if you prefer:

```yaml
- uses: mcclurejt/cover-2@v1
  with:
    head-lcov-file: head.lcov
    base-lcov-file: base.lcov
```

### Example Output

**Without base (head only):**

| Status | File | Lines | Branches |
|---|---|---|---|
| :white_check_mark: | `src/main.ts` | 95.00% | 80.00% |
| :warning: | `src/parser.ts` | 65.00% | 55.00% |
| :x: | `src/new.ts` | 45.00% | 30.00% |

**With base (deltas enabled):**

| Status | File | Lines | Branches | Delta |
|---|---|---|---|---|
| :white_check_mark: | `src/main.ts` | 95.00% | 80.00% | +2.50% |
| :warning: | `src/parser.ts` | 65.00% | 55.00% | -1.00% |
| :x: | `src/new.ts` | 45.00% | 30.00% | *new* |

Files with no coverage change are collapsed by default into a `<details>` section.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `head-lcov-file` | **yes** | — | Path or glob to LCOV file(s) from the PR branch |
| `base-lcov-file` | no | `""` | Path or glob to LCOV file(s) from the base branch. Enables the delta column |
| `baseline-from` | no | `""` | Branch name to fetch baseline LCOV from for delta comparison (overrides `base-lcov-file`) |
| `save-baseline` | no | `""` | Branch name to save the head LCOV to as a baseline for future PRs |
| `github-token` | no | `${{ github.token }}` | Token for posting PR comments |
| `thresholds` | no | `"60 80"` | Space-separated lower and upper thresholds for health indicators |
| `fail-below-threshold` | no | `"false"` | Fail the action if line coverage is below the lower threshold |
| `show-badge` | no | `"true"` | Include a shields.io coverage badge |
| `show-branch-coverage` | no | `"true"` | Show branch coverage column |
| `show-function-coverage` | no | `"false"` | Show function coverage column |
| `show-unchanged-files` | no | `"false"` | Show unchanged files inline instead of collapsing them |
| `comment-header` | no | `"coverage"` | Unique ID for the comment. Use different values to post multiple comments |
| `working-directory` | no | `"."` | Working directory for resolving relative file paths |

### Thresholds

The `thresholds` input controls both the health indicators and the optional failure gate:

| Line Coverage | Icon | Badge Color |
|---|---|---|
| >= upper (default 80%) | :white_check_mark: | green |
| >= lower (default 60%) | :warning: | yellow |
| < lower (default 60%) | :x: | red |

## Outputs

| Output | Description |
|---|---|
| `total-line-rate` | Overall line coverage percentage (0–100) |
| `total-branch-rate` | Overall branch coverage percentage (0–100) |
| `total-line-rate-delta` | Change in line coverage vs. base (only set when `base-lcov-file` is provided) |
| `comment-id` | ID of the created/updated PR comment |
| `report` | The full Markdown report as a string |

### Using Outputs

```yaml
- uses: mcclurejt/cover-2@v1
  id: coverage
  with:
    head-lcov-file: coverage/lcov.info

- run: echo "Line coverage is ${{ steps.coverage.outputs.total-line-rate }}%"
```

## Examples

### Monorepo with Multiple Coverage Files

```yaml
- uses: mcclurejt/cover-2@v1
  with:
    head-lcov-file: "packages/*/coverage/lcov.info"
    base-lcov-file: "base-coverage/*.lcov"
```

### Separate Comments for Unit and Integration Tests

```yaml
- uses: mcclurejt/cover-2@v1
  with:
    head-lcov-file: coverage/unit/lcov.info
    comment-header: unit-tests

- uses: mcclurejt/cover-2@v1
  with:
    head-lcov-file: coverage/integration/lcov.info
    comment-header: integration-tests
```

### Fail if Coverage Drops Below 80%

```yaml
- uses: mcclurejt/cover-2@v1
  with:
    head-lcov-file: coverage/lcov.info
    thresholds: "80 90"
    fail-below-threshold: "true"
```

### Minimal — No Badge, No Branch Coverage

```yaml
- uses: mcclurejt/cover-2@v1
  with:
    head-lcov-file: coverage/lcov.info
    show-badge: "false"
    show-branch-coverage: "false"
```

### Non-PR Events

When triggered by a non-PR event (e.g. `push`), the action skips commenting but still sets all outputs. You can use this to record coverage values without posting a comment.

## Permissions

For PR comments only:

```yaml
permissions:
  pull-requests: write
```

For baseline storage (recommended):

```yaml
permissions:
  contents: write
  pull-requests: write
```

## License

MIT
