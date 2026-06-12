/*
 * 自定义拓扑布局（对齐旧 weavescope 版结构）：
 * - 连通子图按依赖层级 TB 分层（依赖方在上、被依赖方在下，网关云朵在最上层）
 * - 网关所在子图排最左，其余子图按规模降序排在右侧
 * - 孤立节点（无任何边）不参与分层，单独成网格排在连通子图下方
 * - 布局是纯函数且确定性的（按名称排序），轮询刷新时坐标稳定不跳变
 */
import { GATEWAY_ID } from './transform';

const COL_GAP = 110; // 同层节点水平间距
const ROW_GAP = 130; // 层级垂直间距
const GROUP_GAP = 70; // 连通子图之间的水平间距
const ISOLATED_TOP_GAP = 60; // 孤立区与连通区的垂直间距
const ISOLATED_COLS = 4; // 孤立节点每行个数

function nameOf(node) {
  return (node.raw && (node.raw.service_cname || node.raw.service_alias)) || node.id;
}

/** 并查集找连通分量 */
function buildComponents(nodes, edges) {
  const parent = {};
  nodes.forEach(n => {
    parent[n.id] = n.id;
  });
  const find = x => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  edges.forEach(e => {
    if (parent[e.source] == null || parent[e.target] == null) return;
    parent[find(e.source)] = find(e.target);
  });
  const groups = {};
  nodes.forEach(n => {
    const root = find(n.id);
    if (!groups[root]) groups[root] = [];
    groups[root].push(n);
  });
  return Object.values(groups);
}

/**
 * 最长路径分层：无入边节点（不被任何组件依赖的"顶层"组件）rank=0，
 * 依赖边 source → target 表示 source 依赖 target，target 排在更深层。
 */
function assignRanks(nodes, edges) {
  const ids = new Set(nodes.map(n => n.id));

  // 自顶向下松弛推层级（rank 上限 = 节点数，天然防环）
  const rank = {};
  nodes.forEach(n => {
    rank[n.id] = 0;
  });
  for (let round = 0; round < nodes.length; round += 1) {
    let changed = false;
    edges.forEach(e => {
      if (!ids.has(e.source) || !ids.has(e.target)) return;
      if (rank[e.target] < rank[e.source] + 1 && rank[e.target] < nodes.length) {
        rank[e.target] = rank[e.source] + 1;
        changed = true;
      }
    });
    if (!changed) break;
  }
  return rank;
}

/** 对单个连通子图布局，返回 { width, place(xOffset) } */
function layoutSubgraph(nodes, edges) {
  const rank = assignRanks(nodes, edges);
  const rows = {};
  nodes.forEach(n => {
    const r = rank[n.id];
    if (!rows[r]) rows[r] = [];
    rows[r].push(n);
  });
  const rowKeys = Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b);
  const maxCount = Math.max(...rowKeys.map(r => rows[r].length));
  const width = (maxCount - 1) * COL_GAP;
  const depth = rowKeys[rowKeys.length - 1];

  const place = xOffset => {
    rowKeys.forEach(r => {
      const row = rows[r].slice().sort((a, b) => {
        // 网关云朵永远排行首，其余按名称稳定排序
        if (a.id === GATEWAY_ID) return -1;
        if (b.id === GATEWAY_ID) return 1;
        return nameOf(a).localeCompare(nameOf(b));
      });
      const rowWidth = (row.length - 1) * COL_GAP;
      const start = xOffset + (width - rowWidth) / 2;
      row.forEach((n, i) => {
        n.x = start + i * COL_GAP;
        n.y = r * ROW_GAP;
      });
    });
  };
  return { width, depth, place };
}

/**
 * 计算所有节点坐标（直接写入 node.x / node.y）。
 * @param {{nodes: Array, edges: Array}} data G6 graph data
 * @returns 同一 data（已带坐标）
 */
export function applyTopologyLayout(data) {
  const { nodes = [], edges = [] } = data;
  if (!nodes.length) return data;

  const groups = buildComponents(nodes, edges);
  const connected = groups.filter(g => g.length > 1);
  const isolated = groups
    .filter(g => g.length === 1)
    .map(g => g[0])
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  // 网关所在子图最左，其余按节点数降序、名称稳定排序
  connected.sort((a, b) => {
    const aGw = a.some(n => n.id === GATEWAY_ID);
    const bGw = b.some(n => n.id === GATEWAY_ID);
    if (aGw !== bGw) return aGw ? -1 : 1;
    if (a.length !== b.length) return b.length - a.length;
    return nameOf(a[0]).localeCompare(nameOf(b[0]));
  });

  let xOffset = 0;
  let maxDepth = 0;
  connected.forEach(group => {
    const groupEdges = edges; // place 内部按 rank 仅作用本组节点
    const sub = layoutSubgraph(group, groupEdges);
    sub.place(xOffset);
    xOffset += sub.width + GROUP_GAP + COL_GAP;
    maxDepth = Math.max(maxDepth, sub.depth);
  });

  // 孤立节点网格：排在连通区下方
  const isolatedTop = connected.length
    ? (maxDepth + 1) * ROW_GAP + ISOLATED_TOP_GAP
    : 0;
  isolated.forEach((n, i) => {
    n.x = (i % ISOLATED_COLS) * COL_GAP;
    n.y = isolatedTop + Math.floor(i / ISOLATED_COLS) * (ROW_GAP - 20);
  });

  return data;
}
