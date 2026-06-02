/**
 * Fixture-based integration test
 *
 * test/fixtures/es7-single-file/ 의 각 fixture를 분석하여
 * function/call site 수집 결과가 기대치와 일치하는지 검증.
 *
 * 각 fixture는 파일 상단 주석에 expected를 명시함.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { analyzeSource, FunctionKind, CalleeKind } = require('../../src/ast');

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'es7-single-file');

function loadFixture(name) {
  const fullPath = path.join(FIXTURE_DIR, name);
  const code = fs.readFileSync(fullPath, 'utf-8');
  return { code, filePath: fullPath };
}

function analyzeFixture(name) {
  const { code, filePath } = loadFixture(name);
  return analyzeSource(code, filePath);
}

describe('AST integration: fixture analysis', () => {
  describe('01-trivial-chain.js', () => {
    test('captures 4 functions: main, a, b, c', () => {
      const { functions } = analyzeFixture('01-trivial-chain.js');
      expect(functions.size()).toBe(4);
      const names = functions.all().map((r) => r.name).sort();
      expect(names).toEqual(['a', 'b', 'c', 'main']);
      expect(
        functions.all().every((r) => r.kind === FunctionKind.DECLARATION)
      ).toBe(true);
    });

    test('captures 4 call sites: main→a, a→b, b→c, top-level main()', () => {
      const { functions, calls } = analyzeFixture('01-trivial-chain.js');
      expect(calls.size()).toBe(4);

      const findByName = (n) => functions.all().find((r) => r.name === n);
      const main = findByName('main');
      const a = findByName('a');
      const b = findByName('b');

      expect(calls.byCaller(main.id).map((c) => c.calleeText)).toEqual(['a']);
      expect(calls.byCaller(a.id).map((c) => c.calleeText)).toEqual(['b']);
      expect(calls.byCaller(b.id).map((c) => c.calleeText)).toEqual(['c']);
      expect(calls.topLevel().map((c) => c.calleeText)).toEqual(['main']);
    });
  });

  describe('02-star-callee.js', () => {
    test('captures 5 functions: util, a, b, c, d', () => {
      const { functions } = analyzeFixture('02-star-callee.js');
      expect(functions.size()).toBe(5);
      const names = functions.all().map((r) => r.name).sort();
      expect(names).toEqual(['a', 'b', 'c', 'd', 'util']);
    });

    test('every non-util function calls util exactly once', () => {
      const { functions, calls } = analyzeFixture('02-star-callee.js');
      const callers = ['a', 'b', 'c', 'd'];
      callers.forEach((name) => {
        const rec = functions.all().find((r) => r.name === name);
        const fromRec = calls.byCaller(rec.id);
        expect(fromRec).toHaveLength(1);
        expect(fromRec[0].calleeText).toBe('util');
      });
    });

    test('util has no outgoing calls', () => {
      const { functions, calls } = analyzeFixture('02-star-callee.js');
      const util = functions.all().find((r) => r.name === 'util');
      expect(calls.byCaller(util.id)).toHaveLength(0);
    });
  });

  describe('03-recursion.js', () => {
    test('captures 3 functions: selfRec, mutA, mutB', () => {
      const { functions } = analyzeFixture('03-recursion.js');
      expect(functions.size()).toBe(3);
      const names = functions.all().map((r) => r.name).sort();
      expect(names).toEqual(['mutA', 'mutB', 'selfRec']);
    });

    test('self-call captured: selfRec calls itself', () => {
      const { functions, calls } = analyzeFixture('03-recursion.js');
      const selfRec = functions.all().find((r) => r.name === 'selfRec');
      const fromSelf = calls.byCaller(selfRec.id);
      expect(fromSelf).toHaveLength(1);
      expect(fromSelf[0].calleeText).toBe('selfRec');
    });

    test('mutual recursion captured: mutA→mutB, mutB→mutA', () => {
      const { functions, calls } = analyzeFixture('03-recursion.js');
      const mutA = functions.all().find((r) => r.name === 'mutA');
      const mutB = functions.all().find((r) => r.name === 'mutB');
      expect(calls.byCaller(mutA.id).map((c) => c.calleeText)).toEqual(['mutB']);
      expect(calls.byCaller(mutB.id).map((c) => c.calleeText)).toEqual(['mutA']);
    });
  });

  describe('04-control-context.js', () => {
    test('captures 6 functions including main', () => {
      const { functions } = analyzeFixture('04-control-context.js');
      expect(functions.size()).toBe(6);
      const names = functions.all().map((r) => r.name).sort();
      expect(names).toEqual([
        'elseCall',
        'ifCall',
        'loopCall',
        'main',
        'nestedCall',
        'uncondCall',
      ]);
    });

    test('main calls all 5 helpers (context verified separately)', () => {
      const { functions, calls } = analyzeFixture('04-control-context.js');
      const main = functions.all().find((r) => r.name === 'main');
      const fromMain = calls.byCaller(main.id);
      const calleeTexts = fromMain.map((c) => c.calleeText).sort();
      expect(calleeTexts).toEqual([
        'elseCall',
        'ifCall',
        'loopCall',
        'nestedCall',
        'uncondCall',
      ]);
    });
  });

  describe('05-anonymous.js', () => {
    test('captures named functions and anonymous callbacks', () => {
      const { functions } = analyzeFixture('05-anonymous.js');
      // helper, main + 3 anonymous (map callback, filter arrow, IIFE)
      expect(functions.size()).toBe(5);

      const named = functions.all().filter((r) => !r.isAnonymous);
      const anon = functions.all().filter((r) => r.isAnonymous);
      expect(named.map((r) => r.name).sort()).toEqual(['helper', 'main']);
      expect(anon).toHaveLength(3);
    });

    test('anonymous callback → helper edge captured', () => {
      const { functions, calls } = analyzeFixture('05-anonymous.js');
      // 어떤 익명 함수든 그 안에서 helper() 호출이 있어야 함
      const anon = functions.all().filter((r) => r.isAnonymous);
      const callsToHelper = anon
        .flatMap((a) => calls.byCaller(a.id))
        .filter((c) => c.calleeText === 'helper');
      expect(callsToHelper).toHaveLength(1);
    });

    test('arrow callback → filterCheck edge captured', () => {
      const { functions, calls } = analyzeFixture('05-anonymous.js');
      const anon = functions.all().filter((r) => r.isAnonymous);
      const callsToFilterCheck = anon
        .flatMap((a) => calls.byCaller(a.id))
        .filter((c) => c.calleeText === 'filterCheck');
      expect(callsToFilterCheck).toHaveLength(1);
    });

    test('IIFE-internal setup call captured', () => {
      const { functions, calls } = analyzeFixture('05-anonymous.js');
      const anon = functions.all().filter((r) => r.isAnonymous);
      const callsToSetup = anon
        .flatMap((a) => calls.byCaller(a.id))
        .filter((c) => c.calleeText === 'setup');
      expect(callsToSetup).toHaveLength(1);
    });

    test('top-level main() call exists', () => {
      const { calls } = analyzeFixture('05-anonymous.js');
      const topMain = calls.topLevel().filter((c) => c.calleeText === 'main');
      expect(topMain).toHaveLength(1);
    });
  });

  describe('cross-fixture determinism', () => {
    test('re-analyzing same fixture produces same IDs', () => {
      const r1 = analyzeFixture('01-trivial-chain.js');
      const r2 = analyzeFixture('01-trivial-chain.js');
      expect(r1.functions.ids().sort()).toEqual(r2.functions.ids().sort());
      expect(r1.calls.all().map((c) => c.id).sort()).toEqual(
        r2.calls.all().map((c) => c.id).sort()
      );
    });
  });
});
