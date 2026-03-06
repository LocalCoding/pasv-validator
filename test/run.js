/**
 * Test runner: runs fixtures through the new isolated-vm validator
 * and verifies results match expectations.
 */

const path = require('path');
const { runInIsolate } = require('../src/isolate-runner');
const { validateEqual } = require('../src/equal-validator');

const fixturesDir = path.join(__dirname, '../../pasv-validator-dockerized/test-data');

async function testUnit() {
  const fixtures = require(path.join(fixturesDir, 'fixtures-unit.json'));
  const total = fixtures.length;
  let passed = 0;
  let failed = 0;
  let errors = 0;
  const durations = [];
  const failures = [];

  console.log(`\n--- Unit Tests: ${total} fixtures ---\n`);

  for (let i = 0; i < total; i++) {
    const f = fixtures[i];
    try {
      const result = await runInIsolate(f.solution, f.test);
      durations.push(result.duration);

      if (result.isPassed) {
        passed++;
        process.stdout.write('.');
      } else if (result.error) {
        errors++;
        process.stdout.write('E');
        failures.push({
          index: i,
          name: f.name,
          type: 'error',
          error: result.error,
          results: result.results?.slice(0, 3),
        });
      } else {
        failed++;
        process.stdout.write('F');
        const failedTests = result.results?.filter(r => r.event === 'fail') || [];
        failures.push({
          index: i,
          name: f.name,
          type: 'fail',
          passed: result.passedTests,
          total: result.totalTests,
          firstFail: failedTests[0]?.payload,
        });
      }
    } catch (err) {
      errors++;
      process.stdout.write('X');
      failures.push({ index: i, name: f.name, type: 'exception', error: err.message });
    }

    if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}/${total}\n`);
  }

  console.log(`\n\nResults: ${passed} passed, ${failed} failed, ${errors} errors out of ${total}`);

  if (durations.length) {
    const sorted = [...durations].sort((a, b) => a - b);
    console.log('Duration (ms):', {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      total: sorted.reduce((a, b) => a + b, 0),
    });
  }

  if (failures.length) {
    console.log(`\nFirst 10 failures:`);
    failures.slice(0, 10).forEach(f => {
      console.log(`  [${f.index}] ${f.name}`);
      if (f.type === 'error' || f.type === 'exception') {
        console.log(`    Error: ${f.error}`);
      } else {
        console.log(`    Passed ${f.passed}/${f.total}`);
        if (f.firstFail) console.log(`    First fail: ${f.firstFail.title} — ${f.firstFail.err}`);
      }
    });
  }

  return { passed, failed, errors, total };
}

async function testEqual() {
  const fixtures = require(path.join(fixturesDir, 'fixtures-equal.json'));
  const total = fixtures.length;
  let passed = 0;
  let failed = 0;

  console.log(`\n--- Equal Tests: ${total} fixtures ---\n`);

  for (const f of fixtures) {
    const result = validateEqual(f.solution, f.completedSolution);
    if (result[0]?.type === 'passed') {
      passed++;
      process.stdout.write('.');
    } else {
      failed++;
      process.stdout.write('F');
    }
  }

  console.log(`\n\nResults: ${passed} passed, ${failed} failed out of ${total}`);
  return { passed, failed, total };
}

async function main() {
  console.log('PASV Validator — Test Suite');
  console.log('==========================');

  const equalResult = await testEqual();
  const unitResult = await testUnit();

  console.log('\n==========================');
  console.log('Summary:');
  console.log(`  Equal: ${equalResult.passed}/${equalResult.total} passed`);
  console.log(`  Unit:  ${unitResult.passed}/${unitResult.total} passed, ${unitResult.errors} errors`);

  const allPassed = unitResult.failed === 0 && unitResult.errors === 0 && equalResult.failed === 0;
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
