/**
 * Equal validator — simple string comparison.
 * Port of the original equalValidator.js from pasv-validator-dockerized.
 */

function strictEqual(s, o, w) {
  if (s !== o) {
    w.push({ type: 'notEqual', message: 'Your code does not match the sample' });
  }
}

function semicolon(s, o, w) {
  if (o.endsWith(';') && !s.endsWith(';')) {
    w.push({ type: 'semicolon', message: 'Missing tail semicolon' });
  }
}

function spaces(s, o, w) {
  const sNoSpace = s.replace(/\s/g, '');
  const oNoSpace = o.replace(/\s/g, '');

  const sCountSpaces = (s.match(/\s/g) || []).length;
  const oCountSpaces = (o.match(/\s/g) || []).length;

  if (sNoSpace === oNoSpace && sCountSpaces !== oCountSpaces) {
    w.push({
      type: 'checkSpaces',
      message: 'Your solution is correct, but spaces do not match',
    });
  }
}

function varLetConst(s, o, w) {
  const solutionStartsLet = s.startsWith('let');
  const originStartsLet = o.startsWith('let');
  const solutionStartsConst = s.startsWith('const');
  const originStartsConst = o.startsWith('const');
  const solutionStartsVar = s.startsWith('var');

  if (solutionStartsVar) {
    w.push({ type: 'noVar', message: 'Do not use `var`! Use `let` or `const`.' });
  }
  if (originStartsLet && solutionStartsConst) {
    w.push({ type: 'letConst', message: 'Use here `let` instead of `const`' });
  }
  if (originStartsConst && solutionStartsLet) {
    w.push({ type: 'constLet', message: 'Use here `const` instead of `let`' });
  }
}

function validateEqual(solution, completedSolution) {
  const s = (solution || '').trim();
  const o = (completedSolution || '').trim();

  if (s === o) {
    return [{ type: 'passed' }];
  }

  const warnings = [];
  strictEqual(s, o, warnings);
  semicolon(s, o, warnings);
  varLetConst(s, o, warnings);
  spaces(s, o, warnings);

  return warnings;
}

module.exports = { validateEqual };
