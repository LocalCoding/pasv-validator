const ivm = require('isolated-vm');

const MEMORY_LIMIT_MB = 32;
const TIMEOUT_MS = 10000;

/**
 * Mini test framework code injected into the isolate.
 * Provides: describe(), it(), expect() with Chai-compatible API.
 */
const TEST_FRAMEWORK = `
const __results = [];
const __errors = [];
let __currentSuite = '';

function describe(title, fn) {
  const prev = __currentSuite;
  __currentSuite = __currentSuite ? __currentSuite + ' ' + title : title;
  try { fn(); } catch(e) { __errors.push({ title: __currentSuite, error: String(e) }); }
  __currentSuite = prev;
}

function it(title, fn) {
  const fullTitle = __currentSuite ? __currentSuite + ' ' + title : title;
  const start = Date.now();
  try {
    fn();
    __results.push({
      event: 'pass',
      payload: { title, fullTitle, duration: Date.now() - start, currentRetry: 0 }
    });
  } catch(e) {
    __results.push({
      event: 'fail',
      payload: {
        title,
        fullTitle,
        duration: Date.now() - start,
        currentRetry: 0,
        err: e.message || String(e),
        stack: e.stack || ''
      }
    });
  }
}

function expect(val) {
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

  function deepEqual(a, b) {
    if (a === b) return true;
    // NaN === NaN
    if (typeof a === 'number' && typeof b === 'number' && isNaN(a) && isNaN(b)) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  function formatVal(v) {
    if (v === undefined) return 'undefined';
    if (v !== v) return 'NaN';
    try { return JSON.stringify(v); } catch { return String(v); }
  }

  const obj = {
    to: null,
    be: null,
    been: null,
    is: null,
    that: null,
    which: null,
    and: null,
    has: null,
    have: null,
    with: null,
    at: null,
    of: null,
    same: null,
    but: null,
    does: null,
    still: null,
    also: null,
    not: null,

    _negated: false,

    // Type check
    a(type) {
      const actual = typeof val;
      if (type === 'array') {
        const isArr = Array.isArray(val);
        assert(this._negated ? !isArr : isArr,
          'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to be an array');
      } else {
        assert(this._negated ? actual !== type : actual === type,
          'expected ' + formatVal(val) + ' to be ' + (this._negated ? 'not ' : '') + 'a ' + type + ', but got ' + actual);
      }
      return this;
    },

    an(type) {
      if (type === undefined) return proxy; // chain: .an.instanceOf(...)
      return this.a(type);
    },

    // Strict equal
    eq(expected) {
      assert(this._negated ? val !== expected : val === expected,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to equal ' + formatVal(expected));
      return this;
    },
    equal(expected) { return this.eq(expected); },
    equals(expected) { return this.eq(expected); },

    // Deep equal
    eql(expected) {
      const isEqual = deepEqual(val, expected);
      assert(this._negated ? !isEqual : isEqual,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to deeply equal ' + formatVal(expected));
      return this;
    },
    deep: null,

    // Truthiness
    get ok() {
      assert(this._negated ? !val : !!val,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to be truthy');
      return this;
    },

    get true() {
      assert(this._negated ? val !== true : val === true,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to be true');
      return this;
    },

    get false() {
      assert(this._negated ? val !== false : val === false,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to be false');
      return this;
    },

    get null() {
      assert(this._negated ? val !== null : val === null,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to be null');
      return this;
    },

    get undefined() {
      assert(this._negated ? val !== undefined : val === undefined,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to be undefined');
      return this;
    },

    get NaN() {
      const isNan = Number.isNaN(val);
      assert(this._negated ? !isNan : isNan,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to be NaN');
      return this;
    },

    get exist() {
      assert(this._negated ? (val === null || val === undefined) : (val !== null && val !== undefined),
        'expected ' + formatVal(val) + (this._negated ? '' : ' not') + ' to be null or undefined');
      return this;
    },

    // Length
    length(n) { return this.lengthOf(n); },
    lengthOf(n) {
      const len = val.length;
      assert(this._negated ? len !== n : len === n,
        'expected ' + formatVal(val) + ' to have length ' + (this._negated ? 'not ' : '') + n + ', but got ' + len);
      return this;
    },

    // Include
    include(item) {
      let includes;
      if (typeof val === 'string') {
        includes = val.includes(item);
      } else if (Array.isArray(val)) {
        includes = val.includes(item);
      } else if (typeof val === 'object' && val !== null) {
        includes = Object.keys(item).every(k => deepEqual(val[k], item[k]));
      } else {
        includes = false;
      }
      assert(this._negated ? !includes : includes,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to include ' + formatVal(item));
      return this;
    },
    includes(item) { return this.include(item); },
    contain(item) { return this.include(item); },
    contains(item) { return this.include(item); },

    // Above / below
    above(n) {
      assert(this._negated ? val <= n : val > n,
        'expected ' + val + (this._negated ? ' not' : '') + ' to be above ' + n);
      return this;
    },
    gt(n) { return this.above(n); },
    greaterThan(n) { return this.above(n); },

    below(n) {
      assert(this._negated ? val >= n : val < n,
        'expected ' + val + (this._negated ? ' not' : '') + ' to be below ' + n);
      return this;
    },
    lt(n) { return this.below(n); },
    lessThan(n) { return this.below(n); },

    least(n) {
      assert(this._negated ? val < n : val >= n,
        'expected ' + val + (this._negated ? ' not' : '') + ' to be at least ' + n);
      return this;
    },
    gte(n) { return this.least(n); },

    most(n) {
      assert(this._negated ? val > n : val <= n,
        'expected ' + val + (this._negated ? ' not' : '') + ' to be at most ' + n);
      return this;
    },
    lte(n) { return this.most(n); },

    // Property — returns a new chainable expect on the property value
    property(name, expected) {
      const hasProp = val != null && (typeof val === 'object' || typeof val === 'function') && name in val;
      assert(this._negated ? !hasProp : hasProp,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to have property ' + formatVal(name));
      if (!this._negated && hasProp && arguments.length > 1) {
        assert(deepEqual(val[name], expected),
          'expected property ' + name + ' to equal ' + formatVal(expected) + ', but got ' + formatVal(val[name]));
      }
      // Return a new expect chain on the property value for further assertions
      if (!this._negated && hasProp) {
        return expect(val[name]);
      }
      return this;
    },

    // Satisfy
    satisfy(fn) {
      const result = fn(val);
      assert(this._negated ? !result : result,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to satisfy the given function');
      return this;
    },
    satisfies(fn) { return this.satisfy(fn); },

    // Match (regex)
    match(re) {
      assert(this._negated ? !re.test(val) : re.test(val),
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to match ' + re);
      return this;
    },

    // Throw
    throw(errType) {
      let threw = false;
      let thrownError;
      try { val(); } catch(e) { threw = true; thrownError = e; }
      if (errType) {
        assert(this._negated ? !threw : threw && thrownError instanceof errType,
          'expected function to' + (this._negated ? ' not' : '') + ' throw ' + (errType.name || errType));
      } else {
        assert(this._negated ? !threw : threw,
          'expected function to' + (this._negated ? ' not' : '') + ' throw');
      }
      return this;
    },
    throws(errType) { return this.throw(errType); },

    // Members
    members(list) {
      const isSuperset = list.every(m => val.some(v => deepEqual(v, m)));
      const sameLength = val.length === list.length;
      assert(this._negated ? !(isSuperset && sameLength) : (isSuperset && sameLength),
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to have same members as ' + formatVal(list));
      return this;
    },

    // Keys
    keys(...args) {
      const expectedKeys = Array.isArray(args[0]) ? args[0] : args;
      const actualKeys = Object.keys(val);
      const hasAll = expectedKeys.every(k => actualKeys.includes(k));
      assert(this._negated ? !hasAll : hasAll,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to have keys ' + formatVal(expectedKeys));
      return this;
    },

    // oneOf
    oneOf(list) {
      const found = list.some(item => deepEqual(val, item));
      assert(this._negated ? !found : found,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to be one of ' + formatVal(list));
      return this;
    },

    // instanceof
    instanceof(constructor) {
      assert(this._negated ? !(val instanceof constructor) : val instanceof constructor,
        'expected ' + formatVal(val) + (this._negated ? ' not' : '') + ' to be an instance of ' + (constructor.name || constructor));
      return this;
    },
    instanceOf(constructor) { return this.instanceof(constructor); },
  };

  // Chain proxies for .not, .to, .be, .deep etc.
  const proxy = new Proxy(obj, {
    get(target, prop) {
      if (prop === 'not') {
        target._negated = !target._negated;
        return proxy;
      }
      if (prop === 'deep') {
        // .deep.equal -> .eql
        return new Proxy(target, {
          get(t, p) {
            if (p === 'equal' || p === 'equals' || p === 'eq') return t.eql.bind(t);
            if (p in t) {
              const v = t[p];
              return typeof v === 'function' ? v.bind(t) : proxy;
            }
            return proxy;
          }
        });
      }
      // 'a' and 'an' work both as chain and as method
      if (prop === 'a' || prop === 'an') {
        const method = target[prop].bind(target);
        // Return a function that also acts as a proxy for chaining
        return new Proxy(method, {
          get(_, innerProp) {
            // .a.instanceOf, .an.instanceof, etc.
            if (innerProp in target) {
              const v = target[innerProp];
              return typeof v === 'function' ? v.bind(target) : v;
            }
            return proxy;
          }
        });
      }
      // Language chains return the proxy but with method access
      const chains = ['to','be','been','is','that','which','and','has','have','with','at','of','same','but','does','still','also','all','any','own','nested','ordered','contain','contains','include','includes'];
      if (chains.includes(prop)) {
        // Check if it's also a method name — if so, return a dual-purpose proxy
        if (prop in target && typeof target[prop] === 'function') {
          const method = target[prop].bind(target);
          return new Proxy(method, {
            get(_, innerProp) {
              if (innerProp in target) {
                const v = target[innerProp];
                return typeof v === 'function' ? v.bind(target) : v;
              }
              return proxy;
            }
          });
        }
        return proxy;
      }
      if (prop in target) {
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      }
      return undefined;
    }
  });

  return proxy;
}
`;

/**
 * Run user solution + tests inside an isolated V8 context.
 *
 * @param {string} solution - User's code
 * @param {string} test - Mocha-style test code (it/expect)
 * @param {object} options
 * @param {number} options.memoryMB - Memory limit (default: 32)
 * @param {number} options.timeoutMs - Execution timeout (default: 10000)
 * @returns {object} { results, totalTests, passedTests, isPassed, error?, duration }
 */
async function runInIsolate(solution, test, options = {}) {
  const memoryMB = options.memoryMB || MEMORY_LIMIT_MB;
  const timeoutMs = options.timeoutMs || TIMEOUT_MS;

  const isolate = new ivm.Isolate({ memoryLimit: memoryMB });
  const start = Date.now();

  try {
    const context = await isolate.createContext();
    const jail = context.global;

    // Make global available as `global`
    await jail.set('global', jail.derefInto());

    // Inject test framework
    const frameworkScript = await isolate.compileScript(TEST_FRAMEWORK);
    await frameworkScript.run(context, { timeout: timeoutMs });

    // Run user solution
    try {
      const solutionScript = await isolate.compileScript(solution);
      await solutionScript.run(context, { timeout: timeoutMs });
    } catch (err) {
      // Solution has a runtime error — return as terminal error
      const duration = Date.now() - start;
      return {
        results: [{ terminal: encodeURI(err.message || String(err)) }],
        totalTests: 0,
        passedTests: 0,
        isPassed: false,
        error: err.message,
        duration,
      };
    }

    // Run tests
    try {
      const testScript = await isolate.compileScript(test);
      await testScript.run(context, { timeout: timeoutMs });
    } catch (err) {
      const duration = Date.now() - start;
      return {
        results: [{ terminal: encodeURI(err.message || String(err)) }],
        totalTests: 0,
        passedTests: 0,
        isPassed: false,
        error: err.message,
        duration,
      };
    }

    // Collect results
    const collectScript = await isolate.compileScript('JSON.stringify({ results: __results, errors: __errors })');
    const resultJson = await collectScript.run(context, { timeout: 1000 });
    const { results, errors } = JSON.parse(resultJson);

    const duration = Date.now() - start;
    const totalTests = results.length;
    const passedTests = results.filter(r => r.event === 'pass').length;

    return {
      results,
      totalTests,
      passedTests,
      isPassed: passedTests === totalTests && totalTests > 0,
      duration,
    };
  } finally {
    isolate.dispose();
  }
}

module.exports = { runInIsolate };
