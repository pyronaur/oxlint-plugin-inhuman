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

const NO_EXPORT_SPECIFIERS_MESSAGE =
  "Do not use `export { ... }` for local values. Export the declaration directly at the bottom of the file instead.";

const NO_EXPORT_ALIAS_MESSAGE =
  "Do not export local aliases like `export const x = y`. Export the declaration directly at the bottom of the file instead.";

const NO_EMPTY_WRAPPERS_MESSAGE =
  "Do not export empty wrapper functions. Export the implementation directly instead.";

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

function unwrapExpression(node) {
  let current = node;
  // Unwrap common wrappers around call expressions.
  while (
    current &&
    (current.type === "AwaitExpression" ||
      current.type === "ChainExpression" ||
      current.type === "ParenthesizedExpression")
  ) {
    current =
      current.type === "AwaitExpression"
        ? current.argument
        : current.expression;
  }
  return current;
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

function isPrimitiveLiteralExpression(node) {
  if (!node) {
    return false;
  }

  if (node.type === "ParenthesizedExpression") {
    return isPrimitiveLiteralExpression(node.expression);
  }

  if (node.type === "ChainExpression") {
    return isPrimitiveLiteralExpression(node.expression);
  }

  if (node.type === "TemplateLiteral") {
    return node.expressions.length === 0;
  }

  if (node.type === "Literal") {
    const value = node.value;
    return (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    );
  }

  if (node.type === "UnaryExpression") {
    const arg = node.argument;

    if (node.operator === "+" || node.operator === "-" || node.operator === "~") {
      return arg?.type === "Literal" && (typeof arg.value === "number" || typeof arg.value === "bigint");
    }

    if (node.operator === "!") {
      return arg?.type === "Literal" && typeof arg.value === "boolean";
    }
  }

  return false;
}

function isPrimitiveConstExport(node) {
  if (node?.type !== "ExportNamedDeclaration") {
    return false;
  }

  if (node.source != null) {
    return false;
  }

  const declaration = node.declaration;
  if (!declaration || declaration.type !== "VariableDeclaration" || declaration.kind !== "const") {
    return false;
  }

  const declarations = declaration.declarations ?? [];
  if (declarations.length === 0) {
    return false;
  }

  return declarations.every((declarator) => {
    return declarator.id?.type === "Identifier" && isPrimitiveLiteralExpression(declarator.init);
  });
}

function isExemptExport(node, options) {
  if (isTypeOnlyExport(node)) {
    return true;
  }

  if (isPrimitiveConstExport(node)) {
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

function isLocalNamedExportList(node) {
  if (node?.type !== "ExportNamedDeclaration") {
    return false;
  }

  // `export { foo }` (no declaration, no source) is a local export list.
  if (node.declaration != null) {
    return false;
  }
  if (node.source != null) {
    return false;
  }

  return Array.isArray(node.specifiers) && node.specifiers.length > 0;
}

function isAliasLikeExpression(node) {
  if (!node) {
    return false;
  }

  if (node.type === "Identifier" || node.type === "MemberExpression") {
    return true;
  }

  if (node.type === "ChainExpression") {
    return isAliasLikeExpression(node.expression);
  }

  if (node.type === "ParenthesizedExpression") {
    return isAliasLikeExpression(node.expression);
  }

  return false;
}

function isLocalAliasExport(node) {
  if (node?.type !== "ExportNamedDeclaration") {
    return false;
  }

  const declaration = node.declaration;
  if (!declaration || declaration.type !== "VariableDeclaration") {
    return false;
  }

  // Treat `export const x = y` and `export const x = obj.y` as alias exports.
  return declaration.declarations.some(
    (declarator) => isAliasLikeExpression(declarator.init),
  );
}

function isExportedFunction(node) {
  const parent = node?.parent;
  if (!parent) return false;
  return (
    parent.type === "ExportNamedDeclaration" ||
    parent.type === "ExportDefaultDeclaration"
  );
}

function getCallExpressionFromStatement(statement) {
  if (!statement) return null;

  if (statement.type === "ExpressionStatement") {
    const expr = unwrapExpression(statement.expression);
    return expr?.type === "CallExpression" ? expr : null;
  }

  if (statement.type === "ReturnStatement") {
    const expr = unwrapExpression(statement.argument);
    return expr?.type === "CallExpression" ? expr : null;
  }

  return null;
}

function isPassThroughWrapper(node, callExpression) {
  const params = node.params ?? [];
  const args = callExpression.arguments ?? [];

  // Only treat plain identifier parameters (and a single rest identifier) as pass-through.
  const paramNames = [];
  let restName = null;

  for (const param of params) {
    if (param.type === "Identifier") {
      paramNames.push(param.name);
      continue;
    }

    if (param.type === "RestElement" && param.argument?.type === "Identifier") {
      restName = param.argument.name;
      continue;
    }

    // Destructuring or other patterns are not considered "empty wrappers".
    return false;
  }

  if (restName != null) {
    // Require the rest arg to be passed through as `...rest` at the end.
    if (args.length !== paramNames.length + 1) {
      return false;
    }

    for (let i = 0; i < paramNames.length; i += 1) {
      const arg = args[i];
      if (arg?.type !== "Identifier" || arg.name !== paramNames[i]) {
        return false;
      }
    }

    const lastArg = args[args.length - 1];
    return (
      lastArg?.type === "SpreadElement" &&
      lastArg.argument?.type === "Identifier" &&
      lastArg.argument.name === restName
    );
  }

  if (args.length !== paramNames.length) {
    return false;
  }

  for (let i = 0; i < paramNames.length; i += 1) {
    const arg = args[i];
    if (arg?.type !== "Identifier" || arg.name !== paramNames[i]) {
      return false;
    }
  }

  return true;
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
      noExportSpecifiers: NO_EXPORT_SPECIFIERS_MESSAGE,
      noExportAlias: NO_EXPORT_ALIAS_MESSAGE,
    },
  },
  create(context) {
    const options = context.options?.[0] ?? {};

    return {
      Program(program) {
        const body = program.body ?? [];
        if (body.length === 0) return;

        // First, forbid local export lists like `export { foo }`.
        for (const node of body) {
          if (!isLocalNamedExportList(node)) continue;
          if (isTypeOnlyExport(node)) continue;

          context.report({
            node,
            messageId: "noExportSpecifiers",
          });
        }

        // Next, forbid alias exports like `export const x = y`.
        for (const node of body) {
          if (!isLocalAliasExport(node)) continue;

          context.report({
            node,
            messageId: "noExportAlias",
          });
        }

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
          if (isLocalNamedExportList(node) && !isTypeOnlyExport(node)) continue;
          if (isLocalAliasExport(node)) continue;
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

/** @type {import('eslint').Rule.RuleModule} */
const noEmptyWrappersRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow exported empty wrapper functions that only pass through to another call.",
      recommended: false,
    },
    schema: [],
    messages: {
      noEmptyWrapper: NO_EMPTY_WRAPPERS_MESSAGE,
    },
  },
  create(context) {
    function checkFunctionLike(node) {
      if (!isExportedFunction(node)) {
        return;
      }

      const body = node.body;
      if (!body || body.type !== "BlockStatement") {
        return;
      }

      const statements = body.body ?? [];
      if (statements.length !== 1) {
        return;
      }

      const callExpression = getCallExpressionFromStatement(statements[0]);
      if (!callExpression) {
        return;
      }

      if (!isPassThroughWrapper(node, callExpression)) {
        return;
      }

      context.report({
        node,
        messageId: "noEmptyWrapper",
      });
    }

    return {
      FunctionDeclaration: checkFunctionLike,
      FunctionExpression: checkFunctionLike,
      ArrowFunctionExpression: checkFunctionLike,
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
    "no-empty-wrappers": noEmptyWrappersRule,
    "no-switch": noBranchingPlugin.rules["no-switch"],
    "no-else": noBranchingPlugin.rules["no-else"],
  },
};

export default plugin;
