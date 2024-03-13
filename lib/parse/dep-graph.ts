import type { MavenGraph, MavenGraphNode } from './types';

import { DepGraph, DepGraphBuilder, PkgInfo } from '@snyk/dep-graph';
import { parseDependency } from './dependency';

export function buildDepGraph(
  mavenGraph: MavenGraph,
  includeTestScope = false,
  verboseEnabled = false,
): DepGraph {
  const { rootId, nodes } = mavenGraph;
  const parsedRoot = parseId(rootId);
  const builder = new DepGraphBuilder({ name: 'maven' }, parsedRoot.pkgInfo);
  const visitedMap: Record<string, DepInfo> = {};
  const queue: QueueItem[] = [];
  queue.push(...getItems(rootId, nodes[rootId]));

  // breadth first search
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const { id, parentId } = item;
    const parsed = parseId(id);
    const node = nodes[id];
    if (!includeTestScope && parsed.scope === 'test' && !node.reachesProdDep) {
      continue;
    }
    const visited = visitedMap[parsed.key];
    if (!verboseEnabled && visited) {
      const prunedId = visited.id + ':pruned';
      builder.addPkgNode(visited.pkgInfo, prunedId, {
        labels: { pruned: 'true' },
      });
      builder.connectDep(parentId, prunedId);
      continue; // don't queue any more children
    }
    const parentNodeId = parentId === rootId ? builder.rootNodeId : parentId;
    if (verboseEnabled && visited) {
      // use visited node when omited dependencies found (verbose)
      builder.addPkgNode(visited.pkgInfo, visited.id);
      builder.connectDep(parentNodeId, visited.id);
    } else {
      builder.addPkgNode(parsed.pkgInfo, id);
      builder.connectDep(parentNodeId, id);
      visitedMap[parsed.key] = parsed;
    }
    queue.push(...getItems(id, node));
  }

  return builder.build();
}

interface QueueItem {
  id: string;
  parentId: string;
}

function getItems(parentId: string, node?: MavenGraphNode): QueueItem[] {
  const items: QueueItem[] = [];
  for (const id of node?.dependsOn || []) {
    items.push({ id, parentId });
  }
  return items;
}

interface DepInfo {
  id: string; // maven graph id
  key: string; // maven dependency groupId:artifactId:type:classifier
  pkgInfo: PkgInfo; // dep-graph name and version
  scope?: string; // maybe scope
}

function parseId(id: string): DepInfo {
  const dep = parseDependency(id);
  const maybeClassifier = dep.classifier ? `:${dep.classifier}` : '';
  const name = `${dep.groupId}:${dep.artifactId}`;
  return {
    id,
    key: `${name}:${dep.type}${maybeClassifier}`,
    pkgInfo: {
      name,
      version: dep.version,
    },
    scope: dep.scope,
  };
}
