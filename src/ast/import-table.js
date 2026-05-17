'use strict';

const traverse = require('@babel/traverse').default;

/**
 * 단일 파일 AST에서 ESM import/export 선언을 수집한다.
 *
 * @param {object} ast  Babel File AST
 * @returns {{ imports: object[], exports: object[] }}
 *
 * import 항목: { localName, importedName, source, kind }
 *   kind: 'named' | 'default' | 'namespace'
 *
 * export 항목: { localName, exportedName, kind, source? }
 *   kind: 'named' | 'default' | 're-export' | 're-export-all'
 */
function collectImportsExports(ast) {
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
        localName: '*',
        exportedName: '*',
        kind: 're-export-all',
        source: path.node.source.value,
      });
    },
  });

  return { imports, exports };
}

module.exports = { collectImportsExports };
