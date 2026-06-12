/* G6 Graph 实例封装：布局、交互模式、tooltip */
import G6 from '@antv/g6';
import { formatMessage } from '@/utils/intl';
import { registerNodes } from './nodes';
import { COLORS, statusOf } from './theme';

const FIT_PADDING = [60, 70, 60, 70];

function buildTooltip() {
  return new G6.Tooltip({
    offsetX: 12,
    offsetY: 12,
    itemTypes: ['node'],
    shouldBegin(e) {
      const model = e.item.getModel();
      return !(model.raw && model.raw.isGateway);
    },
    getContent(e) {
      const c = e.item.getModel().raw || {};
      const st = statusOf(c.cur_status);
      const div = document.createElement('div');
      div.className = 'g6-rb-tooltip';
      const monitorRows = (c.monitor || [])
        .map(m => `<div class="tt-row"><span>${m.label}</span><b>${m.value}</b></div>`)
        .join('');
      div.innerHTML = `
        <div class="tt-title">${c.service_cname || ''}</div>
        <div class="tt-row"><span>${formatMessage({ id: 'topology.g6.tooltip.status' })}</span><b style="color:${
        st.color
      }">● ${c.status_cn || c.cur_status || ''}</b></div>
        <div class="tt-row"><span>${formatMessage({ id: 'topology.g6.tooltip.instances' })}</span><b>${
        c.node_num != null ? c.node_num : '-'
      }</b></div>
        <div class="tt-row"><span>${formatMessage({ id: 'topology.g6.tooltip.memory' })}</span><b>${
        c.component_memory != null ? `${c.component_memory} MB` : '-'
      }</b></div>
        ${monitorRows}
        ${
          c.is_internet
            ? `<div class="tt-net">⇄ ${formatMessage({ id: 'topology.g6.tooltip.internet' })}</div>`
            : ''
        }
      `;
      return div;
    }
  });
}

/**
 * 创建拓扑 Graph 实例。
 * 布局：dagre TB，间距对齐现网截图（紧凑）。
 */
export function createTopologyGraph(container) {
  registerNodes();
  const graph = new G6.Graph({
    container,
    width: container.clientWidth || 800,
    height: container.clientHeight || 600,
    fitView: true,
    fitViewPadding: FIT_PADDING,
    maxZoom: 2.5,
    minZoom: 0.3,
    plugins: [buildTooltip()],
    modes: {
      default: ['drag-canvas', 'zoom-canvas', 'drag-node'],
      addEdge: [
        'zoom-canvas',
        {
          type: 'create-edge',
          trigger: 'drag',
          edgeConfig: {
            type: 'line',
            style: { stroke: COLORS.hexRunning, lineWidth: 1.6, lineDash: [6, 4] }
          }
        }
      ]
    },
    layout: {
      type: 'dagre',
      rankdir: 'TB',
      nodesep: 30,
      ranksep: 36
    },
    defaultEdge: {
      type: 'line',
      style: { stroke: COLORS.edge, lineWidth: 1 }
    }
  });
  return graph;
}

export function fitGraph(graph) {
  if (!graph || graph.get('destroyed')) return;
  graph.fitView(FIT_PADDING);
}
