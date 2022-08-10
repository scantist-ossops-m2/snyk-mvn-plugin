import * as path from 'path';
import * as test from 'tap-only';
import * as sinon from 'sinon';
import * as javaCallGraphBuilder from '@snyk/java-call-graph-builder';
import { CallGraph } from '@snyk/cli-interface/legacy/common';

import * as plugin from '../../lib';
import { readFixtureJSON } from '../helpers/read';

const testsPath = path.join(__dirname, '..');
const fixturesPath = path.join(testsPath, 'fixtures');
const testProjectPath = path.join(fixturesPath, 'test-project');

test('inspect on test-project pom with reachable vulns no entry points found', async (t) => {
  const javaCallGraphBuilderStub = sinon
    .stub(javaCallGraphBuilder, 'getCallGraphMvn')
    .rejects({
      message:
        'Scanning for reachable vulnerabilities took too long. Please use the --reachable-timeout flag to increase the timeout for finding reachable vulnerabilities.',
      innerError: new Error(
        'Timed out while generating call graph for project',
      ),
    });

  t.tearDown(() => {
    javaCallGraphBuilderStub.restore();
  });

  const result = await plugin.inspect(
    '.',
    path.join(testProjectPath, 'pom.xml'),
    {
      reachableVulns: true,
    },
  );

  if (
    'callGraph' in result &&
    result.callGraph != null &&
    'innerError' in result.callGraph
  ) {
    const err = result.callGraph;
    t.ok(
      javaCallGraphBuilderStub.calledOnce,
      'called to the call graph builder',
    );
    t.ok(
      javaCallGraphBuilderStub.calledWith(testProjectPath),
      'call graph builder was called with the correct path',
    );
    t.equals(
      err.message,
      'Scanning for reachable vulnerabilities took too long. Please use the --reachable-timeout flag to increase the timeout for finding reachable vulnerabilities.',
    );
    t.equals(
      err.innerError.message,
      'Timed out while generating call graph for project',
      'correct inner error',
    );
  } else {
    t.fail('the call to inspect() should have failed to generate a call graph');
  }
});

test('inspect on test-project pom with reachable vulns', async (t) => {
  const mavenCallGraph = await readFixtureJSON('call-graphs', 'simple.json');
  const javaCallGraphBuilderStub = sinon
    .stub(javaCallGraphBuilder, 'getCallGraphMvn')
    .resolves(mavenCallGraph as CallGraph);

  const metrics = {
    getEntrypoints: 0,
    generateCallGraph: 13,
    mapClassesPerJar: 12,
    getCallGraph: 10,
  };
  const callGraphMetrics = sinon
    .stub(javaCallGraphBuilder, 'runtimeMetrics')
    .returns(metrics);

  const result = await plugin.inspect(
    '.',
    path.join(testProjectPath, 'pom.xml'),
    {
      reachableVulns: true,
    },
  );
  const expected = await readFixtureJSON(
    'test-project',
    'expected-with-call-graph.json',
  );
  t.ok(javaCallGraphBuilderStub.calledOnce, 'called to the call graph builder');
  t.ok(
    javaCallGraphBuilderStub.calledWith(testProjectPath),
    'call graph builder was called with the correct path',
  );
  t.ok(callGraphMetrics.calledOnce, 'callgraph metrics were fetched');
  t.equals((result.plugin.meta as any).callGraphMetrics, metrics);

  delete result.plugin.meta;
  t.same(result, expected, 'should return expected result');
  t.tearDown(() => {
    javaCallGraphBuilderStub.restore();
    callGraphMetrics.restore();
  });
});

test('inspect on test-project pom with reachable vulns with maven args', async (t) => {
  const mavenCallGraph = await readFixtureJSON('call-graphs', 'simple.json');
  const javaCallGraphBuilderStub = sinon
    .stub(javaCallGraphBuilder, 'getCallGraphMvn')
    .resolves(mavenCallGraph as CallGraph);

  const metrics = {
    getEntrypoints: 0,
    generateCallGraph: 13,
    mapClassesPerJar: 12,
    getCallGraph: 10,
  };
  const callGraphMetrics = sinon
    .stub(javaCallGraphBuilder, 'runtimeMetrics')
    .returns(metrics);

  const args = [`-s=${path.join(testProjectPath, 'settings.xml')}`];
  const result = await plugin.inspect(
    '.',
    path.join(testProjectPath, 'pom.xml'),
    {
      reachableVulns: true,
      args,
    },
  );
  t.ok(
    javaCallGraphBuilderStub.calledWith(testProjectPath, undefined, args),
    'call graph builder was called with the correct path and custom args',
  );
  const expected = await readFixtureJSON(
    'test-project',
    'expected-with-call-graph.json',
  );
  t.ok(javaCallGraphBuilderStub.calledOnce, 'called to the call graph builder');
  t.ok(
    javaCallGraphBuilderStub.calledWith(testProjectPath),
    'call graph builder was called with the correct path',
  );
  t.ok(callGraphMetrics.calledOnce, 'callgraph metrics were fetched');
  t.equals((result.plugin.meta as any).callGraphMetrics, metrics);

  delete result.plugin.meta;
  t.same(result, expected, 'should return expected result');
  t.tearDown(() => {
    javaCallGraphBuilderStub.restore();
    callGraphMetrics.restore();
  });
});
