/**
 * src/graph/export-map.js
 *
 * 파일별 FunctionTable + ImportExportTable로부터 전역 ExportMap을 구성한다.
 * re-export 체인을 따라가 최종 FunctionRecord와 연결한다.
 */

'use strict';

const { resolvePath } = require('./module-discovery');

const DIRECT_EXPORT_KINDS = new Set(['named', 'default', 'cjs-named', 'cjs-default']);

/**
 * @param {Array<{filePath, functionTable, importExportTable}>} files
 * @returns {Map<string, Map<string, object>>}
 *   filePath → (exportedName → FunctionRecord)
 */
function buildExportMap(files) {
  const exportMap = new Map();
  const byPath = new Map(files.map((f) => [f.filePath, f]));

  for (const { filePath } of files) {
    exportMap.set(filePath, new Map());
  }

  function findFnByName(functionTable, name) {
    if (!name) return null;
    for (const rec of functionTable.all()) {
      if (rec.name === name) return rec;
    }
    return null;
  }

  function resolveExport(filePath, exportedName, visiting = new Set()) {
    const key = `${filePath}::${exportedName}`;
    if (visiting.has(key)) return null;
    visiting.add(key);

    const fileData = byPath.get(filePath);
    if (!fileData) return null;

    const { functionTable, importExportTable } = fileData;

    // 직접 named/default export (ESM + CJS)
    const direct = importExportTable.exports.find(
      (e) => e.exportedName === exportedName && DIRECT_EXPORT_KINDS.has(e.kind)
    );
    if (direct) return findFnByName(functionTable, direct.localName);

    // re-export: export { foo } from './bar'
    const reexp = importExportTable.exports.find(
      (e) => e.exportedName === exportedName && e.kind === 're-export'
    );
    if (reexp) {
      const sourcePath = resolvePath(filePath, reexp.source);
      if (sourcePath && byPath.has(sourcePath)) {
        return resolveExport(sourcePath, reexp.localName, visiting);
      }
    }

    // re-export-all: export * from './bar'
    for (const r of importExportTable.exports.filter((e) => e.kind === 're-export-all')) {
      const sourcePath = resolvePath(filePath, r.source);
      if (sourcePath && byPath.has(sourcePath)) {
        const rec = resolveExport(sourcePath, exportedName, visiting);
        if (rec) return rec;
      }
    }

    return null;
  }

  for (const { filePath, importExportTable } of files) {
    const fileExports = exportMap.get(filePath);
    for (const exp of importExportTable.exports) {
      if (exp.exportedName === '*') continue;
      const rec = resolveExport(filePath, exp.exportedName);
      if (rec) fileExports.set(exp.exportedName, rec);
    }
  }

  return exportMap;
}

module.exports = { buildExportMap };
