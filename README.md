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
    "inhuman/no-local-property-alias": "error",
    "inhuman/no-single-use-local-function": "error",
    "inhuman/max-function-size": "error",
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
Default exports must be on declarations; `export default foo` is only allowed when `foo` is a variable used internally.
Primitive `export const` values (for example strings, numbers, booleans, null, bigint, or static templates) are exempt and may appear at the top.
Direct Zod schema exports (for example `export const User = z.object(...)`) are exempt and may appear at the top, including the colocated `export type User = z.infer<typeof User>` pattern.
Direct Effect schema exports are also exempt (for example `export const User = Schema.Struct(...)` or `export const User = S.Struct(...)` from `effect/Schema`), including colocated type aliases like `export type User = Schema.Schema.Type<typeof User>`.

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

Forbids empty wrapper functions that only pass through to a single call.
Also forbids hiding the pass-through call behind a temporary variable and immediately returning it.

### `inhuman/no-local-property-alias`

Forbids local aliases for property reads like `const fooBar = Foo.bar`.
Names that communicate snapshot or boundary intent are allowed by `allow-name-pattern`.

Options default:
- `allow-name-pattern: "(^|_)(original|snapshot|initial|previous|cached|bound)($|[A-Z_])|(Original|Snapshot|Initial|Previous|Cached|Bound)$"`

Optional config:

```json
{
  "rules": {
    "inhuman/no-local-property-alias": [
      "error",
      {
        "allow-name-pattern": "(Original|Snapshot|Initial|Cached|Bound)$"
      }
    ]
  }
}
```

### `inhuman/no-single-use-local-function`

Forbids local functions with one return expression that are called once.
Names matching `settings.inhuman.predicateNamePattern` are exempt.
The rule-level `predicateNamePattern` option overrides the shared setting.

Settings default:
- `settings.inhuman.predicateNamePattern: "^(is|has|can|should|must|needs|will)[A-Z_]"`

Shared config:

```json
{
  "settings": {
    "inhuman": {
      "predicateNamePattern": "^(is|has|can|should|must|needs|will|keeps)[A-Z_]"
    }
  },
  "rules": {
    "inhuman/no-single-use-local-function": "error"
  }
}
```

Rule-local override:

```json
{
  "rules": {
    "inhuman/no-single-use-local-function": [
      "error",
      { "predicateNamePattern": "^(is|has|can|should)[A-Z_]" }
    ]
  }
}
```

### `inhuman/max-function-size`

Limits functions while allowing named callback containers to use larger limits.
By default, functions are limited to 100 lines and common test suite containers are limited to 800 lines.
Use `scoped` entries to override the limit for functions inside named calls or functions.

Options default:
- `max-lines: 100`
- `scoped: [{ "inside": ["describe", "suite", "test", "test.describe"], "max-lines": 800 }]`

Optional config:

```json
{
  "rules": {
    "inhuman/max-function-size": [
      "error",
      {
        "max-lines": 100,
        "scoped": [
          {
            "inside": ["describe", "suite", "test", "test.describe"],
            "max-lines": 800
          }
        ]
      }
    ]
  }
}
```

### `inhuman/no-switch`

Re-exported from [`oxlint-plugin-no-branching`](https://github.com/pyronaur/oxlint-plugin-no-branching).

### `inhuman/no-else`

Re-exported from [`oxlint-plugin-no-branching`](https://github.com/pyronaur/oxlint-plugin-no-branching).

## Local Demo

```sh
bunx oxlint examples
```

Expected errors include:

- `examples/fail/wrapper-if.js`
- `examples/fail/swallowed-catch.js`
- `examples/fail/exports-before-non-export.js`
- `examples/fail/export-list.js`
- `examples/fail/export-alias.js`
- `examples/fail/export-alias-member.js`
- `examples/fail/export-alias-chain.js`
- `examples/fail/default-export-identifier.js`
- `examples/fail/default-export-unused-identifier.js`
- `examples/fail/empty-wrapper-impl.ts`
- `examples/fail/empty-wrapper-generic.ts`
- `examples/fail/empty-wrapper-local.ts`
- `examples/fail/non-primitive-const-top.ts`
- `examples/fail/switch.js`
- `examples/fail/else.js`
- `examples/fail/else-if.js`
