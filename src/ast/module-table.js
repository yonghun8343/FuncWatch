/**
 * src/ast/module-table.js
 *
 * ESM import/export 수집 (CJS는 Task 2–3에서 추가 예정). collectModuleInfo(ast) 하나를 export한다.
 *
 * imports: [{ localName, importedName, source, kind }]
 *   kind: 'named'|'default'|'namespace'        (ESM)
 *         'cjs-named'|'cjs-namespace'           (CJS — Task 2에서 추가)
 * exports: [{ localName, exportedName, kind, source? }]
 *   kind: 'named'|'default'|'re-export'|'re-export-all'  (ESM)
 *         'cjs-named'|'cjs-default'                       (CJS — Task 3에서 추가)
 */

'use strict';

const traverse = require('@babel/traverse').default;

function isRequireCall(node) {
  return (
    node != null &&
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'require' &&
    node.arguments.length === 1 &&
    node.arguments[0].type === 'StringLiteral'
  );
}

function collectModuleInfo(ast) {
  const imports = [];
  const exports = [];

  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      for (const spec of path.node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          imports.push({
            localName: spec.local.name,
            importedName: spec.imported
              ? spec.imported.name || spec.imported.value
              : spec.local.name,
            source,
            kind: 'named',
          });
        } else if (spec.type === 'ImportDefaultSpecifier') {
          imports.push({ localName: spec.local.name, importedName: 'default', source, kind: 'default' });
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          imports.push({ localName: spec.local.name, importedName: '*', source, kind: 'namespace' });
        }
      }
    },

    ExportNamedDeclaration(path) {
      const { source, declaration, specifiers } = path.node;
      if (source) {
        for (const spec of specifiers) {
          exports.push({
            localName: spec.local.name,
            exportedName: spec.exported.name || spec.exported.value,
            kind: 're-export',
            source: source.value,
          });
        }
      } else if (declaration) {
        if (declaration.id) {
          exports.push({ localName: declaration.id.name, exportedName: declaration.id.name, kind: 'named' });
        } else if (declaration.declarations) {
          for (const d of declaration.declarations) {
            if (d.id && d.id.name) {
              exports.push({ localName: d.id.name, exportedName: d.id.name, kind: 'named' });
            }
          }
        }
      } else {
        for (const spec of specifiers) {
          exports.push({
            localName: spec.local.name,
            exportedName: spec.exported.name || spec.exported.value,
            kind: 'named',
          });
        }
      }
    },

    ExportDefaultDeclaration(path) {
      const decl = path.node.declaration;
      const localName = decl && decl.id ? decl.id.name : null;
      exports.push({ localName, exportedName: 'default', kind: 'default' });
    },

    ExportAllDeclaration(path) {
      exports.push({
        localName: null,
        exportedName: '*',
        kind: 're-export-all',
        source: path.node.source.value,
      });
    },

    VariableDeclaration(path) {
      for (const decl of path.node.declarations) {
        if (!decl.init) continue;

        // Pattern 1: const utils = require('./y')
        if (isRequireCall(decl.init) && decl.id.type === 'Identifier') {
          imports.push({
            localName: decl.id.name,
            importedName: '*',
            source: decl.init.arguments[0].value,
            kind: 'cjs-namespace',
          });
          continue;
        }

        // Pattern 2: const { a, b } = require('./y')
        if (isRequireCall(decl.init) && decl.id.type === 'ObjectPattern') {
          const source = decl.init.arguments[0].value;
          for (const prop of decl.id.properties) {
            if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier' && !prop.computed) {
              imports.push({
                localName: prop.value.name || prop.key.name,
                importedName: prop.key.name,
                source,
                kind: 'cjs-named',
              });
            }
          }
          continue;
        }

        // Pattern 3: const a = require('./y').a
        if (
          decl.init.type === 'MemberExpression' &&
          !decl.init.computed &&
          isRequireCall(decl.init.object) &&
          decl.id.type === 'Identifier' &&
          decl.init.property.type === 'Identifier'
        ) {
          imports.push({
            localName: decl.id.name,
            importedName: decl.init.property.name,
            source: decl.init.object.arguments[0].value,
            kind: 'cjs-named',
          });
        }
      }
    },
  });

  return { imports, exports };
}

module.exports = { collectModuleInfo };
