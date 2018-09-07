var fs = require('fs');
var path = require('path');
var test = require('tap-only');
var parse = require('../../lib/parse-mvn');

test('compare full results - without --dev', function (t) {
  t.plan(1);
  var mavenOutput = fs.readFileSync(path.join(
    __dirname, '..','fixtures', 'maven-dependency-tree-output.txt'), 'utf8');
  var depTree = parse(mavenOutput, false);
  var results = require(path.join(
    __dirname, '..', 'fixtures', 'maven-parse-results.json'));

  t.same(depTree.data, results);
});

test('compare full results - with --dev', function (t) {
  t.plan(1);
  var mavenOutput = fs.readFileSync(path.join(
    __dirname, '..', 'fixtures', 'maven-dependency-tree-output.txt'), 'utf8');
  var depTree = parse(mavenOutput, true);
  var results = require(path.join(
    __dirname, '..', 'fixtures', 'maven-parse-dev-results.json'));

  t.same(depTree.data, results);
});

test('test with bad mvn dependency:tree output', function (t) {
  t.plan(1);
  var mavenOutput = fs.readFileSync(path.join(
    __dirname, '..', 'fixtures', 'maven-dependency-tree-bad.txt'), 'utf8');
  try {
    parse(mavenOutput, true);
    t.fail('Should have thrown!');
  } catch (error) {
    t.equal(error.message, 'Cannot find dependency information.',
      'proper error message');
  }
});

test('test with error mvn dependency:tree output', function (t) {
  t.plan(1);
  var mavenOutput = fs.readFileSync(path.join(
    __dirname, '..', 'fixtures', 'maven-dependency-tree-error.txt'), 'utf8');
  try {
    parse(mavenOutput, true);
    t.fail('Should have thrown!');
  } catch (error) {
    t.equal(error.message, 'Failed to execute an `mvn` command.',
      'proper error message');
  }
});

test('test with type "test-jar" in mvn dependency', function (t) {
  t.plan(1);
  var mavenOutput = fs.readFileSync(path.join(
    __dirname, '..', 'fixtures',
    'maven-dependency-tree-with-type.txt'), 'utf8');
  var result = parse(mavenOutput, true);

  t.equal(result.data.dependencies['com.snyk.tester:tester-queue'].version,
    '15.0.0');
});
