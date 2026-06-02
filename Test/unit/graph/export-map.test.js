'use strict';

const path = require('path');
const fs = require('fs');
const traverse = require('@babel/traverse').default;
const { buildExportMap } = require('../../../src/graph/export-map');
const { discoverFiles } = require('../../../src/graph/module-discovery');
const { parseSource } = require('../../../src/ast/parser');
const { collectModuleInfo } = require('../../../src/ast/module-table');
const { FunctionTable, isFunctionNode } = require('../../../src/ast/function-table');

const FIXTURES = path.resolve(__dirname, '../../fixtures/esm');

function loadFiles(entryPath) {
  return discoverFiles(entryPath).map((filePath) => {
    const code = fs.readFileSync(filePath, 'utf-8');
    const ast = parseSource(code);
    const moduleInfo = collectModuleInfo(ast);
    const functionTable = new FunctionTable();
    traverse(ast, {
      Function: {
        enter(p) {
          if (isFunctionNode(p.node)) functionTable.add(p.node, p.parent, filePath);
        },
      },
    });
    return { filePath, ast, functionTable, importExportTable: moduleInfo };
  });
}

describe('buildExportMap', () => {
  test('named export가 FunctionRecord에 매핑된다', () => {
    const files = loadFiles(path.join(FIXTURES, '01-basic-named/main.js'));
    const exportMap = buildExportMap(files);
    const utilsPath = files.find((f) => f.filePath.includes('utils')).filePath;
    expect(exportMap.get(utilsPath).get('add')).toMatchObject({ name: 'add' });
    expect(exportMap.get(utilsPath).get('multiply')).toMatchObject({ name: 'multiply' });
  });

  test('default export가 "default" 키로 매핑된다', () => {
    const files = loadFiles(path.join(FIXTURES, '02-default/main.js'));
    const exportMap = buildExportMap(files);
    const loggerPath = files.find((f) => f.filePath.includes('logger')).filePath;
    expect(exportMap.get(loggerPath).get('default')).toMatchObject({ name: 'log' });
  });

  test('re-export 체인이 원본 FunctionRecord로 해소된다', () => {
    const files = loadFiles(path.join(FIXTURES, '03-reexport/main.js'));
    const exportMap = buildExportMap(files);
    const indexPath = files.find((f) => f.filePath.includes('index')).filePath;
    expect(exportMap.get(indexPath).get('add')).toMatchObject({ name: 'add' });
  });

  test('순환 re-export에서 throw 없이 종료한다', () => {
    const files = loadFiles(path.join(FIXTURES, '05-circular/a.js'));
    expect(() => buildExportMap(files)).not.toThrow();
  });

  describe('CJS exports', () => {
    function makeCJSFile(filePath, code) {
      const ast = parseSource(code);
      const importExportTable = collectModuleInfo(ast);
      const functionTable = new FunctionTable();
      traverse(ast, {
        Function: {
          enter(p) { if (isFunctionNode(p.node)) functionTable.add(p.node, p.parent, filePath); },
        },
      });
      return { filePath, ast, functionTable, importExportTable };
    }

    test('module.exports = { add } → add FunctionRecord로 해소', () => {
      const code = 'function add(a, b) { return a + b; }\nmodule.exports = { add };';
      const file = makeCJSFile('/proj/math.js', code);
      const exportMap = buildExportMap([file]);
      const rec = exportMap.get('/proj/math.js').get('add');
      expect(rec).toBeDefined();
      expect(rec.name).toBe('add');
    });

    test('exports.format = format → format FunctionRecord로 해소', () => {
      const code = 'function format(s) { return s.trim(); }\nexports.format = format;';
      const file = makeCJSFile('/proj/utils.js', code);
      const exportMap = buildExportMap([file]);
      const rec = exportMap.get('/proj/utils.js').get('format');
      expect(rec).toBeDefined();
      expect(rec.name).toBe('format');
    });

    test('module.exports = function foo() {} → "default" 키로 해소', () => {
      const code = 'module.exports = function foo() {};';
      const file = makeCJSFile('/proj/fn.js', code);
      const exportMap = buildExportMap([file]);
      const rec = exportMap.get('/proj/fn.js').get('default');
      expect(rec).toBeDefined();
      expect(rec.name).toBe('foo');
    });
  });
});
