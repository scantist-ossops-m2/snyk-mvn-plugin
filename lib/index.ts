import { legacyPlugin } from '@snyk/cli-interface';
import { CallGraph } from '@snyk/cli-interface/legacy/common';
import * as javaCallGraphBuilder from '@snyk/java-call-graph-builder';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import debugLib = require('debug');

import { parseTree, parseVersions } from './parse-mvn';
import * as subProcess from './sub-process';
import { containsJar, createPomForJar, createPomForJars, isJar } from './jar';

const debug = debugLib('snyk-mvn-plugin');

export interface MavenOptions extends legacyPlugin.BaseInspectOptions {
  scanAllUnmanaged?: boolean;
  reachableVulns?: boolean;
}

export function getCommand(root: string, targetFile: string | undefined) {
  if (!targetFile) {
    return 'mvn';
  }
  const isWinLocal = /^win/.test(os.platform()); // local check, can be stubbed in tests
  const wrapperScript = isWinLocal ? 'mvnw.cmd' : './mvnw';
  // try to find a sibling wrapper script first
  let pathToWrapper = path.resolve(
    root,
    path.dirname(targetFile),
    wrapperScript,
  );
  if (fs.existsSync(pathToWrapper)) {
    return wrapperScript;
  }
  // now try to find a wrapper in the root
  pathToWrapper = path.resolve(root, wrapperScript);
  if (fs.existsSync(pathToWrapper)) {
    return wrapperScript;
  }
  return 'mvn';
}

// When we have `mvn`, we can run the subProcess from anywhere.
// However due to https://github.com/takari/maven-wrapper/issues/133, `mvnw` can only be run
// within the directory where `mvnw` exists
function calculateTargetFilePath(mavenCommand, root: string, targetPath) {
  return mavenCommand === 'mvn' ? root : path.dirname(targetPath);
}

export async function inspect(
  root: string,
  targetFile?: string,
  options?: MavenOptions,
): Promise<legacyPlugin.InspectResult> {
  const targetPath = targetFile
    ? path.resolve(root, targetFile)
    : path.resolve(root);
  if (!fs.existsSync(targetPath)) {
    throw new Error('Could not find file or directory ' + targetPath);
  }

  if (!options) {
    options = { dev: false, scanAllUnmanaged: false };
  }

  if (isJar(targetPath)) {
    targetFile = await createPomForJar(root, targetFile!);
  }

  if (options.scanAllUnmanaged) {
    if (containsJar(root)) {
      targetFile = await createPomForJars(root);
    } else {
      throw Error(`Could not find any supported files in '${root}'.`);
    }
  }

  const mvnArgs = buildArgs(targetFile, options.args);
  const mavenCommand = getCommand(root, targetFile);
  const targetFilePath = calculateTargetFilePath(
    mavenCommand,
    root,
    targetPath,
  );
  try {
    const result = await subProcess.execute(mavenCommand, mvnArgs, {
      cwd: targetFilePath,
    });
    const versionResult = await subProcess.execute(
      `${mavenCommand} --version`,
      [],
      {
        cwd: targetFilePath,
      },
    );
    const parseResult = parseTree(result, options.dev);
    const { javaVersion, mavenVersion } = parseVersions(versionResult);
    let callGraph: CallGraph | undefined;
    if (options.reachableVulns) {
      debug(`getting call graph from path ${targetPath}`);
      callGraph = await javaCallGraphBuilder.getCallGraphMvn(
        path.dirname(targetPath),
      );
      debug('got call graph successfully');
    }
    return {
      plugin: {
        name: 'bundled:maven',
        runtime: 'unknown',
        meta: {
          versionBuildInfo: {
            metaBuildVersion: {
              mavenVersion,
              javaVersion,
            },
          },
        },
      },
      package: parseResult.data,
      callGraph,
    };
  } catch (error) {
    error.message = buildErrorMessage(error, mvnArgs, mavenCommand);
    throw error;
  }
}

export function buildArgs(
  targetFile?: string,
  mavenArgs?: string[] | undefined,
) {
  // Requires Maven >= 2.2
  let args = ['dependency:tree', '-DoutputType=dot'];
  if (targetFile) {
    args.push('--file="' + targetFile + '"');
  }
  if (mavenArgs) {
    args = args.concat(mavenArgs);
  }
  return args;
}

function buildErrorMessage(
  error: Error,
  mvnArgs: string[],
  mavenCommand: string,
): string {
  const mavenArguments: string = mvnArgs.join(' ');
  const fullCommand = `${mavenCommand} ${mavenArguments}`;
  const mvnwCommandTipMessage =
    'Currently, you cannot run `mvnw` outside your current directory, you will have to go inside the directory of your project (see: https://github.com/takari/maven-wrapper/issues/133)\n\n';
  return (
    error.message +
    '\n\n' +
    'Please make sure that Apache Maven Dependency Plugin ' +
    'version 2.2 or above is installed, and that `' +
    fullCommand +
    '` executes successfully ' +
    'on this project.\n\n' +
    (mavenCommand.indexOf('mvnw') >= 0 ? mvnwCommandTipMessage : '') +
    'If the problem persists, collect the output of `' +
    fullCommand +
    '` and contact support@snyk.io\n'
  );
}
