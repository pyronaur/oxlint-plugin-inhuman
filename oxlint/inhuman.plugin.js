/**
 * Oxlint JS plugin: inhuman
 *
 * Opinionated rules that encode "pet peeves" and push code toward
 * explicit, guard-clause-first, error-safe patterns.
 */

import noBranchingPlugin from "oxlint-plugin-no-branching";

const REQUIRE_GUARD_CLAUSE_MESSAGE =
  "Avoid wrapping the entire function body in an if. Use a guard clause / early return instead.";

const NO_SWALLOWED_CATCH_MESSAGE =
  "Do not swallow errors in catch blocks. Handle, log, rethrow, or explicitly justify it.";

const EXPORTS_LAST_EXCEPT_TYPES_MESSAGE =
  "Value export statements should appear at the end of the file (type-only exports are exempt).";

function getSourceCode(context) {
  return context.sourceCode ?? (typeof context.getSourceCode === "function" ? context.getSourceCode() : null);
}

function isEarlyExitStatement(node) {
  if (!node) return false;

  if (node.type === "ReturnStatement" || node.type === "ThrowStatement") {
    return true;
  }

  if (node.type === "BlockStatement") {
    return node.body.length === 1 && isEarlyExitStatement(node.body[0]);
  }

  return false;
}

function isNegatedCondition(node) {
  return node?.type === "UnaryExpression" && node.operator === "!";
}

function isExportNode(node) {
  return (
    node?.type === "ExportAllDeclaration" ||
    node?.type === "ExportDefaultDeclaration" ||
    node?.type === "ExportNamedDeclaration"
  );
}

function isTypeOnlyExport(node) {
  if (node?.type !== "ExportNamedDeclaration") {
    return false;
  }

  // TS/ESTree: `export type { Foo } from "./x"`
  if (node.exportKind === "type") {
    return true;
  }

  // `export { type Foo } from "./x"` style
  if (Array.isArray(node.specifiers) && node.specifiers.length > 0) {
    return node.specifiers.every((specifier) => specifier.exportKind === "type");
  }

  return false;
}

function isExemptExport(node, options) {
  if (isTypeOnlyExport(node)) {
    return true;
  }

  if (options?.allowReExport === true) {
    if (node.type === "ExportAllDeclaration") {
      return true;
    }

    if (node.type === "ExportNamedDeclaration" && node.source) {
      return true;
    }
  }

  return false;
}

function blockHasOnlyComments(block, sourceCode) {
  if (!sourceCode) {
    // Fall back to structural check only.
    return block.body.length === 0;
  }

  const text = sourceCode.getText(block);
  // Strip the outer braces and trim.
  const inner = text.slice(1, -1).trim();
  if (inner.length === 0) {
    return true;
  }

  // Remove block and line comments, then trim again.
  const withoutBlockComments = inner.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutAnyComments = withoutBlockComments.replace(/\/\/[^\n\r]*/g, "");
  return withoutAnyComments.trim().length === 0;
}

/** @type {import('eslint').Rule.RuleModule} */
const requireGuardClausesRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require guard clauses by forbidding a single if-statement that wraps the entire function body.",
      recommended: false,
    },
    schema: [],
    messages: {
      requireGuardClause: REQUIRE_GUARD_CLAUSE_MESSAGE,
    },
  },
  create(context) {
    function checkFunctionLike(node) {
      const body = node.body;
      if (!body || body.type !== "BlockStatement") {
        return;
      }

      const statements = body.body;
      if (statements.length !== 1) {
        return;
      }

      const onlyStatement = statements[0];
      if (onlyStatement.type !== "IfStatement") {
        return;
      }

      // We only care about the "wrapper if" shape: a single if with no alternate.
      if (onlyStatement.alternate != null) {
        return;
      }

      // Allow actual guard clauses / early exits, e.g.:
      // if (!user) return;
      if (
        isEarlyExitStatement(onlyStatement.consequent) &&
        isNegatedCondition(onlyStatement.test)
      ) {
        return;
      }

      context.report({ node: onlyStatement, messageId: "requireGuardClause" });
    }

    return {
      FunctionDeclaration: checkFunctionLike,
      FunctionExpression: checkFunctionLike,
      ArrowFunctionExpression: checkFunctionLike,
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
const noSwallowedCatchRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid empty or comment-only catch blocks that swallow errors.",
      recommended: false,
    },
    schema: [],
    messages: {
      noSwallowedCatch: NO_SWALLOWED_CATCH_MESSAGE,
    },
  },
  create(context) {
    const sourceCode = getSourceCode(context);

    return {
      CatchClause(node) {
        const body = node.body;
        if (!body || body.type !== "BlockStatement") {
          return;
        }

        const isStructurallyEmpty = body.body.length === 0;
        if (!isStructurallyEmpty && !blockHasOnlyComments(body, sourceCode)) {
          return;
        }

        context.report({ node: body, messageId: "noSwallowedCatch" });
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
const exportsLastExceptTypesRule = {
  meta: {
    type: "layout",
    docs: {
      description:
        "Require value exports at the bottom of the file, but allow type-only exports anywhere.",
      recommended: false,
    },
    schema: [
      {
        type: "object",
        properties: {
          allowReExport: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      exportsLast: EXPORTS_LAST_EXCEPT_TYPES_MESSAGE,
    },
  },
  create(context) {
    const options = context.options?.[0] ?? {};

    return {
      Program(program) {
        const body = program.body ?? [];
        if (body.length === 0) return;

        // Find the last non-export top-level statement.
        let lastNonExportIndex = -1;
        for (let i = body.length - 1; i >= 0; i -= 1) {
          const node = body[i];
          if (!isExportNode(node)) {
            lastNonExportIndex = i;
            break;
          }
        }

        // If everything is exports, there is nothing to enforce.
        if (lastNonExportIndex === -1) return;

        // Any non-exempt export before that index is a violation.
        for (let i = 0; i < lastNonExportIndex; i += 1) {
          const node = body[i];
          if (!isExportNode(node)) continue;
          if (isExemptExport(node, options)) continue;

          context.report({
            node,
            messageId: "exportsLast",
          });
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "inhuman",
  },
  rules: {
    "require-guard-clauses": requireGuardClausesRule,
    "no-swallowed-catch": noSwallowedCatchRule,
    "export-code-last": exportsLastExceptTypesRule,
    "no-switch": noBranchingPlugin.rules["no-switch"],
    "no-else": noBranchingPlugin.rules["no-else"],
  },
};

export default plugin;
