/*
 * tests/_harness.js — the whole test framework.
 *
 * No Jest, no Mocha, no assertion library. A test that needs a framework to
 * run is a test that will not be run. Every suite is a plain node script that
 * exits non-zero on failure, so `npm test` is an && chain and CI is `node`.
 */
'use strict';

function harness(title) {
  let pass = 0, fail = 0;
  const failures = [];
  let group = '';

  function ok(cond, label, extra) {
    const full = (group ? group + ' / ' : '') + label;
    if (cond) {
      pass++;
      if (!process.env.QUIET) console.log('  ok   ' + full + (extra ? '  ' + extra : ''));
    } else {
      fail++;
      failures.push(full + (extra ? '  ' + extra : ''));
      console.log('  FAIL ' + full + (extra ? '  ' + extra : ''));
    }
  }

  function eq(actual, expected, label) {
    const same = Object.is(actual, expected);
    ok(same, label, same ? '' : '(expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')');
  }

  function near(actual, expected, tol, label) {
    const same = Math.abs(actual - expected) <= tol;
    ok(same, label, same ? '' : '(expected ~' + expected + ' +/-' + tol + ', got ' + actual + ')');
  }

  function deep(actual, expected, label) {
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    ok(a === b, label, a === b ? '' : '(expected ' + b + ', got ' + a + ')');
  }

  function throws(fn, label) {
    let threw = false;
    try { fn(); } catch (e) { threw = true; }
    ok(threw, label, threw ? '' : '(expected a throw)');
  }

  function section(name) { group = name; if (!process.env.QUIET) console.log('\n  · ' + name); }

  function done() {
    console.log('\n' + (fail ? 'FAIL' : 'PASS') + ' — ' + title + ' — ' +
      pass + '/' + (pass + fail) + ' checks passed');
    if (fail) {
      console.log('\nFailures:');
      failures.forEach(f => console.log('  - ' + f));
    }
    process.exit(fail ? 1 : 0);
  }

  console.log('\n=== ' + title + ' ===');
  return { ok, eq, near, deep, throws, section, done, counts: () => ({ pass, fail }) };
}

module.exports = harness;
