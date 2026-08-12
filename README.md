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
    "inhuman/no-caught-typebox-validation": "error",
    "inhuman/no-empty-wrappers": "error",
    "inhuman/no-local-property-alias": "error",
    "inhuman/no-manual-validation": "error",
    "inhuman/no-nonvalidating-decode": "error",
    "inhuman/no-literal-boolean-check": "error",
    "inhuman/no-shell-polling-loops": "error",
    "inhuman/no-single-use-local-function": "error",
    "inhuman/no-unused-schema-properties": "error",
    "inhuman/no-validation-in-codec": "error",
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

### `inhuman/no-caught-typebox-validation`

Forbids `try`/`catch` around `Assert`, `Parse`, or `Decode` imported from `typebox/value`,
including aliased and namespace imports. Expected validation failures should be expressed through
TypeBox schemas or refinements so structured TypeBox errors can propagate. Operational catches
unrelated to TypeBox validation are allowed.

A shared boundary parser may be permitted by its exact absolute path or normalized
project-relative suffix:

```json
{
  "rules": {
    "inhuman/no-caught-typebox-validation": [
      "error",
      {
        "allowed_files": ["workflows/x/modules/typebox/decode.ts"]
      }
    ]
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

### `inhuman/no-manual-validation`

Forbids hand-written runtime validators and trust-boundary parsers that establish validity through
checks such as `typeof`, `Array.isArray`, direct numeric or date conversion, or throwing on invalid
input. The rule reports the containing function once rather than reporting each individual check.

The diagnostic does not prescribe a schema library. It asks whether the project's established
schema or validation package should own the validation and inferred type instead.

Ordinary runtime control flow, predicates over already-typed domain inputs, and typed orchestration
that happens to compare values or throw are allowed. Parser rejection must be tied to the branch
that validates the incoming value; unrelated throws do not make a function a validator.

### `inhuman/no-nonvalidating-decode`

Requires the encoded side of `Type.Decode` to validate its input. Direct or locally bound
`Type.Unknown()` and `Type.Any()` bases are forbidden because they move validation into the
codec callback instead of expressing it in the schema. Named, aliased, default, and namespace
TypeBox imports are recognized.

### `inhuman/no-literal-boolean-check`

Forbids wrapping boolean conditions in `Check(Type.Literal(true|false), ...)`.
Use the boolean condition directly. Direct and locally bound literal schemas are
recognized with named, aliased, default, and namespace TypeBox imports.

### `inhuman/no-validation-in-codec`

Requires `Type.Decode` callbacks to transform input that the encoded schema has already
validated. Calls to TypeBox `Check` or `Assert` and conditional validation throws belong
in the encoded schema or its refinements. Inline and locally named callbacks are recognized.
Pure transformations and conditional propagation of an existing error are allowed.

### `inhuman/no-unused-schema-properties`

Requires private finite `Type.Object` properties and `Type.Tuple` positions to be consumed after
runtime decoding. The rule follows imported TypeBox `Assert`, `Decode`, and `Parse` boundaries plus
configured project boundary functions. A schema property is consumed by a direct read,
destructuring, array iterator, or `for...of` binding. Local aliases and transparent identity or
nullish `Type.Decode` transforms preserve this flow. For a projecting codec, fields consumed by the
codec determine which encoded properties are used. Returning, forwarding, spreading, or dynamically
indexing the decoded value consumes the complete value because use outside the current file cannot
be inspected.

Check-only predicate schemas, open `Type.Record` schemas, directly exported schemas, schemas used by
exported `Static` or `StaticDecode` types, and `Type.Unsafe` schemas backed by exported types are
exempt.

Optional boundary functions use lower snake case configuration:

```json
{
  "rules": {
    "inhuman/no-unused-schema-properties": [
      "error",
      { "boundary_functions": ["decodeBoundary"] }
    ]
  }
}
```

### `inhuman/no-shell-polling-loops`

Forbids static shell-source string and template literals containing a `while` or `until` loop
that repeatedly invokes `sleep`. Repeated shell `sleep` commands churn child processes and can
leak them when a fixture is cancelled.

Prefer an event-driven wait. When a test only needs one cancellable blocker, replace the shell
with the blocking process once, for example `exec sleep 3600`.

The rule recognizes standalone shell-loop literals and scripts with a shell shebang. It does not
inspect JavaScript loop syntax, comments, or prose that merely mentions a shell loop.

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
