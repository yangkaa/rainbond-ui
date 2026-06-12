import React, { PureComponent } from 'react';
import Topological from '../../components/Topological';
import TopologyG6 from '../../components/TopologyG6';

const G6_FLAG_KEY = 'rainbond:topology-g6';

/**
 * G6 拓扑图 feature flag：
 * - URL 参数 ?topo=g6 / ?topo=iframe 临时切换（优先级最高）
 * - localStorage rainbond:topology-g6 = 'true' 持久开启
 * - 默认走旧 weavescope iframe 版
 */
export function isTopologyG6Enabled() {
  try {
    const search = window.location.search || '';
    if (/[?&]topo=g6(&|$)/.test(search)) return true;
    if (/[?&]topo=iframe(&|$)/.test(search)) return false;
    return window.localStorage.getItem(G6_FLAG_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export default class AppShape extends PureComponent {
  render() {
    const { group_id, iframeHeight, apps } = this.props;
    const TopologyComponent = isTopologyG6Enabled() ? TopologyG6 : Topological;
    return (
      <div style={{ height: iframeHeight }}>
        <TopologyComponent iframeHeight={iframeHeight} group_id={group_id} apps={apps} />
      </div>
    );
  }
}
