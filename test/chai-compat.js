/**
 * Regression tests for the Chai-compatible assertion layer.
 *
 * Every case here comes from a real challenge that broke because the mini
 * framework diverged from Chai. Each entry says whether Chai itself would
 * pass or fail the assertion, so the framework cannot silently drift again.
 */

const { runInIsolate } = require('../src/isolate-runner');

// [title, assertion code, expected result]
const CASES = [
  // .include.members — subset, .have.members — exact set
  ['include.members subset', `expect([1,2,3]).to.include.members([1,3]);`, 'pass'],
  ['include.members with extra items', `expect(['a','b','c']).to.contain.members(['b']);`, 'pass'],
  ['include.members missing item', `expect([1,2,3]).to.include.members([4]);`, 'fail'],
  ['have.members exact', `expect([1,2,3]).to.have.members([3,2,1]);`, 'pass'],
  ['have.members rejects subset', `expect([1,2,3]).to.have.members([1,2]);`, 'fail'],
  ['not.include.members', `expect([1,2,3]).to.not.include.members([9]);`, 'pass'],

  // .deep chains must keep chaining
  ['deep.equal', `expect({a:[1,2]}).to.deep.equal({a:[1,2]});`, 'pass'],
  ['deep.include.members', `expect([{a:1},{b:2}]).to.deep.include.members([{b:2}]);`, 'pass'],
  ['deep.members', `expect([{a:1}]).to.deep.members([{a:1}]);`, 'pass'],
  ['deep.include object', `expect([{a:1},{b:2}]).to.deep.include({a:1});`, 'pass'],

  // .contain.oneOf — target contains one of the items
  ['contains.oneOf', `expect('console.log(15 * 71);').contains.oneOf(['console.log(15 * 71)','console.log(71 * 15)']);`, 'pass'],
  ['oneOf stays strict without contains', `expect('abcd').to.be.oneOf(['abc']);`, 'fail'],

  // language chains after an assertion method
  ['an(object).that.is.empty', `expect({}).to.be.an('object').that.is.empty;`, 'pass'],
  ['an(array).that.is.empty', `expect([]).to.be.an('array').that.is.empty;`, 'pass'],
  ['a(number).and.equal', `expect(5).to.be.a('number').and.equal(5);`, 'pass'],

  // sparse arrays: holes equal explicit undefined
  ['sparse array deep equal', `const a=[]; a[0]=1; a[4]=1; expect(a).to.deep.equal([1,undefined,undefined,undefined,1]);`, 'pass'],
  ['sparse array wrong length', `const a=[]; a[0]=1; a[4]=1; expect(a).to.deep.equal([1,undefined,undefined,1]);`, 'fail'],
  ['NaN inside array', `expect([NaN,1]).to.deep.equal([NaN,1]);`, 'pass'],

  // Chai assert API (Codewars-style tests)
  ['assert.equal', `assert.equal(2+2, 4);`, 'pass'],
  ['assert.equal failing', `assert.equal(1, 2);`, 'fail'],
  ['assert.deepEqual', `assert.deepEqual([10,-65], [10,-65]);`, 'pass'],
  ['assert.isTrue', `assert.isTrue(true);`, 'pass'],
  ['assert.throws', `assert.throws(() => { throw new Error('x'); });`, 'pass'],

  // process stub for timing tests
  ['process.hrtime', `const s = process.hrtime(); const d = process.hrtime(s); expect(d).to.have.lengthOf(2);`, 'pass'],
  ['process.memoryUsage', `expect(process.memoryUsage()).to.be.an('object');`, 'pass'],

  // basics that must not regress
  ['not.equal', `expect(1).to.not.equal(2);`, 'pass'],
  ['lengthOf', `expect([1,2]).to.have.lengthOf(2);`, 'pass'],
  ['include on string', `expect('hello world').to.include('world');`, 'pass'],
  ['instanceOf', `expect([]).to.be.an.instanceOf(Array);`, 'pass'],
];

async function testChaiCompat() {
  console.log(`\n--- Chai Compatibility: ${CASES.length} cases ---\n`);

  const test = CASES.map(([title, code]) => `it(${JSON.stringify(title)}, () => { ${code} });`).join('\n');
  const result = await runInIsolate('', test, {});

  if (result.error) {
    console.log(`E  framework error: ${result.error}`);
    return { passed: 0, failed: CASES.length, total: CASES.length };
  }

  let passed = 0;
  const failures = [];
  CASES.forEach(([title, , expected], i) => {
    const actual = result.results[i] && result.results[i].event;
    if (actual === expected) {
      passed++;
      process.stdout.write('.');
    } else {
      process.stdout.write('F');
      failures.push({ title, expected, actual, err: result.results[i] && result.results[i].payload.err });
    }
  });

  console.log(`\n\nResults: ${passed} passed, ${failures.length} failed out of ${CASES.length}`);
  failures.forEach(f => {
    console.log(`  [${f.title}] expected ${f.expected}, got ${f.actual}`);
    if (f.err) console.log(`     ${String(f.err).slice(0, 120)}`);
  });

  return { passed, failed: failures.length, total: CASES.length };
}

module.exports = { testChaiCompat };

if (require.main === module) {
  testChaiCompat().then(r => process.exit(r.failed === 0 ? 0 : 1));
}
