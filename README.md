# oxlint-plugin-inhuman

Opinionated Oxlint rules that encode pet peeves and steer AI toward explicit, safer code.

This plugin also re-exposes the no-branching rules under the `inhuman/*` namespace from
[`oxlint-plugin-no-branching`](https://github.com/pyronaur/oxlint-plugin-no-branching).

## Install

```sh
npm i -D oxlint-plugin-inhuman
```

## Oxlint Config (Explicit)

Oxlint requires enabling JS plugin rules explicitly under `rules`.

```json
{
  "jsPlugins": ["oxlint-plugin-inhuman"],
  "rules": {
    "inhuman/require-guard-clauses": "error",
    "inhuman/no-swallowed-catch": "error",
    "inhuman/export-code-last": "error",
    "inhuman/no-empty-wrappers": "error",
    "inhuman/no-switch": "error",
    "inhuman/no-else": "error"
  }
}
```

## Rules

### `inhuman/require-guard-clauses`

Forbids a single wrapper `if (...) { ... }` that is the entire function body.

### `inhuman/no-swallowed-catch`

Forbids empty or comment-only `catch` blocks, including `catch { /* ignore */ }`.

### `inhuman/export-code-last`

Requires value exports at the bottom of the file. Type-only exports are exempt and may appear anywhere.
Local export lists like `export { b }` are not allowed; export the declaration directly instead.
Local alias exports like `export const x = y` are also not allowed.
Primitive `export const` values (for example strings, numbers, booleans, null, bigint, or static templates) are exempt and may appear at the top.

Options default:
- `allowReExport: false`

Optional config:

```json
{
  "rules": {
    "inhuman/export-code-last": ["error", { "allowReExport": true }]
  }
}
```

### `inhuman/no-empty-wrappers`

Forbids exported empty wrapper functions that only pass through to a single call.

### `inhuman/no-switch`

Re-exported from [`oxlint-plugin-no-branching`](https://github.com/pyronaur/oxlint-plugin-no-branching).

### `inhuman/no-else`

Re-exported from [`oxlint-plugin-no-branching`](https://github.com/pyronaur/oxlint-plugin-no-branching).

## Local Demo

```sh
bunx oxlint examples
```

Expected errors include:

- `examples/fail-wrapper-if.js`
- `examples/fail-swallowed-catch.js`
- `examples/fail-exports-before-non-export.js`
- `examples/fail-export-list.js`
- `examples/fail-export-alias.js`
- `examples/fail-export-alias-member.js`
- `examples/fail-export-alias-chain.js`
- `examples/fail-empty-wrapper-impl.ts`
- `examples/fail-empty-wrapper-generic.ts`
- `examples/fail-non-primitive-const-top.ts`
- `examples/fail-switch.js`
- `examples/fail-else.js`
- `examples/fail-else-if.js`
