/* G6 自定义节点：六边形组件节点 / 网关云朵节点（移植自 G6 原型，已按现网截图调紧） */
import G6 from '@antv/g6';
import { COLORS, strokeColorOf } from './theme';

export const HEX_R = 30;
const HALO_COLOR = 'rgba(64, 169, 255, 0.28)';

/**
 * 竖向尖角（pointy-top）圆角六边形路径
 * @param {number} r 外接圆半径
 * @param {number} rc 圆角半径
 */
function roundedHexPath(r, rc = 6) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI / 2 + (Math.PI / 3) * i;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const seg = [];
  for (let i = 0; i < 6; i += 1) {
    const p = pts[i];
    const prev = pts[(i + 5) % 6];
    const next = pts[(i + 1) % 6];
    const toPrev = unit(prev, p);
    const toNext = unit(next, p);
    seg.push({
      entry: [p[0] + toPrev[0] * rc, p[1] + toPrev[1] * rc],
      vertex: p,
      exit: [p[0] + toNext[0] * rc, p[1] + toNext[1] * rc]
    });
  }
  let d = `M ${seg[0].exit[0]} ${seg[0].exit[1]} `;
  for (let i = 1; i <= 6; i += 1) {
    const s = seg[i % 6];
    d += `L ${s.entry[0]} ${s.entry[1]} Q ${s.vertex[0]} ${s.vertex[1]} ${s.exit[0]} ${s.exit[1]} `;
  }
  return `${d}Z`;
}

function unit(to, from) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return [dx / len, dy / len];
}

/** 悬浮 / 连线模式共用的淡蓝光晕（默认隐藏） */
function addHalo(group, shapeAttrs) {
  const halo = group.addShape('path', {
    attrs: {
      ...shapeAttrs,
      fill: HALO_COLOR,
      stroke: 'rgba(64, 169, 255, 0.35)',
      lineWidth: 1,
      opacity: 0
    },
    name: 'node-halo',
    zIndex: -2
  });
  halo.toBack();
  return halo;
}

/** 连线模式下的绿色 "+" 标记（默认隐藏） */
function addPlusMark(group, color) {
  group.addShape('circle', {
    attrs: { x: 0, y: 0, r: 8, stroke: color, lineWidth: 1.6, fill: '#fff', opacity: 0 },
    name: 'plus-circle',
    draggable: true
  });
  group.addShape('path', {
    attrs: {
      path: 'M -4 0 L 4 0 M 0 -4 L 0 4',
      stroke: color,
      lineWidth: 1.6,
      lineCap: 'round',
      opacity: 0
    },
    name: 'plus-sign',
    draggable: true
  });
}

function applyNodeStates(name, value, item) {
  const group = item.getContainer();
  const halo = group.find(s => s.get('name') === 'node-halo');
  const dot = group.find(s => s.get('name') === 'center-dot');
  const plusCircle = group.find(s => s.get('name') === 'plus-circle');
  const plusSign = group.find(s => s.get('name') === 'plus-sign');
  const linkable = item.hasState('linkable');
  const hover = item.hasState('hover');
  const selected = item.hasState('selected');

  if (name === 'hover' || name === 'linkable' || name === 'selected') {
    // 选中态复用 hover 浅蓝光晕，且持续显示
    if (halo) halo.attr('opacity', hover || linkable || selected ? 1 : 0);
    const showPlus = linkable;
    if (plusCircle) plusCircle.attr('opacity', showPlus ? 1 : 0);
    if (plusSign) plusSign.attr('opacity', showPlus ? 1 : 0);
    if (dot) dot.attr('opacity', showPlus ? 0 : 1);
  }
  if (name === 'selected') {
    const keyShape = item.get('keyShape');
    keyShape.attr('shadowBlur', value ? 14 : 0);
    keyShape.attr('shadowColor', value ? 'rgba(24,144,255,0.45)' : 'transparent');
  }
  if (name === 'dim') {
    // 无关节点整体淡出
    group.attr('opacity', value ? 0.18 : 1);
  }
}

let registered = false;

export function registerNodes() {
  if (registered) return;
  registered = true;

  /* ---------------- 六边形组件节点 ---------------- */
  G6.registerNode(
    'rb-hexagon',
    {
      draw(cfg, group) {
        const c = cfg.raw || {};

        addHalo(group, { path: roundedHexPath(HEX_R + 8, 9) });

        const keyShape = group.addShape('path', {
          attrs: {
            path: roundedHexPath(HEX_R),
            fill: '#ffffff',
            stroke: strokeColorOf(c.cur_status),
            lineWidth: 2.2,
            cursor: 'pointer'
          },
          name: 'hex-key',
          draggable: true
        });

        group.addShape('circle', {
          attrs: { x: 0, y: 0, r: 4, fill: COLORS.centerDot, cursor: 'pointer' },
          name: 'center-dot',
          draggable: true
        });

        addPlusMark(group, COLORS.hexRunning);

        group.addShape('text', {
          attrs: {
            x: 0,
            y: HEX_R + 14,
            text: c.service_cname,
            fontSize: 12,
            fill: 'rgba(0,0,0,0.75)',
            textAlign: 'center',
            textBaseline: 'middle',
            cursor: 'pointer'
          },
          name: 'hex-label',
          draggable: true
        });

        return keyShape;
      },
      update(cfg, item) {
        const group = item.getContainer();
        const c = cfg.raw || {};
        const keyShape = item.get('keyShape');
        keyShape.attr('stroke', strokeColorOf(c.cur_status));
        const label = group.find(s => s.get('name') === 'hex-label');
        if (label) label.attr('text', c.service_cname);
      },
      setState: applyNodeStates
    },
    'single-node'
  );

  /* ---------------- 网关云朵节点 ---------------- */
  G6.registerNode(
    'rb-cloud',
    {
      draw(cfg, group) {
        const cloudPath =
          'M -18 14 ' +
          'A 12.5 12.5 0 0 1 -21.5 -10 ' +
          'A 17 17 0 0 1 10.5 -17 ' +
          'A 12 12 0 0 1 21.5 14 ' +
          'Z';

        addHalo(group, { path: roundedHexPath(HEX_R + 8, 9) });

        const keyShape = group.addShape('path', {
          attrs: {
            path: cloudPath,
            fill: '#ffffff',
            stroke: COLORS.cloud,
            lineWidth: 2.2,
            lineJoin: 'round',
            cursor: 'pointer'
          },
          name: 'cloud-key',
          draggable: true
        });

        group.addShape('circle', {
          attrs: { x: 0, y: 2, r: 4, fill: COLORS.centerDot, cursor: 'pointer' },
          name: 'center-dot',
          draggable: true
        });

        addPlusMark(group, COLORS.hexRunning);

        group.addShape('text', {
          attrs: {
            x: 0,
            y: HEX_R + 14,
            text: (cfg.raw || {}).service_cname,
            fontSize: 12,
            fill: 'rgba(0,0,0,0.75)',
            textAlign: 'center',
            textBaseline: 'middle'
          },
          name: 'cloud-label'
        });

        return keyShape;
      },
      setState: applyNodeStates
    },
    'single-node'
  );
}
