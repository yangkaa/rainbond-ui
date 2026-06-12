import { statusOf } from './theme';

export const GATEWAY_ID = '__gateway__';

/**
 * 将 console 拓扑接口响应 (json_data + json_svg) 转换为 G6 graph data。
 * json_data: { [service_id]: 组件信息 }
 * json_svg:  { [service_id]: [依赖的 service_id...] }
 *
 * 与 weavescope 拓扑一致：自动注入一个"网关"云朵节点，连向所有开通外网访问的组件。
 */
export function transformTopology(bean = {}, gatewayLabel = '网关') {
  const components = bean.json_data || {};
  const relations = bean.json_svg || {};

  const nodes = Object.values(components).map(c => ({
    id: c.service_id,
    type: 'rb-hexagon',
    raw: c,
    label: c.service_cname
  }));

  const edges = [];
  Object.keys(relations).forEach(sourceId => {
    (relations[sourceId] || []).forEach(targetId => {
      if (!components[sourceId] || !components[targetId]) return;
      edges.push({ source: sourceId, target: targetId });
    });
  });

  const internetNodes = Object.values(components).filter(c => c.is_internet);
  if (internetNodes.length > 0) {
    nodes.push({
      id: GATEWAY_ID,
      type: 'rb-cloud',
      raw: {
        service_id: GATEWAY_ID,
        service_cname: gatewayLabel,
        isGateway: true,
        cur_status: 'running'
      },
      label: gatewayLabel
    });
    internetNodes.forEach(c => {
      edges.push({ source: GATEWAY_ID, target: c.service_id });
    });
  }

  return { nodes, edges };
}

export function isRunning(curStatus) {
  return statusOf(curStatus).kind === 'running';
}
