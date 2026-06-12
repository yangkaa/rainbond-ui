/* 节点右键菜单（纯展示组件） */
import React, { PureComponent } from 'react';
import { Icon } from 'antd';
import { formatMessage } from '@/utils/intl';
import { statusOf } from './theme';
import styles from './index.less';

export function buildMenuItems(raw) {
  const st = statusOf(raw.cur_status);
  const stopped = st.kind === 'stopped';
  const items = [
    { key: 'link', icon: 'fork', label: formatMessage({ id: 'topology.g6.menu.link' }) },
    { key: 'build', icon: 'cloud-upload', label: formatMessage({ id: 'topology.g6.menu.build' }) },
    { key: 'update', icon: 'sync', label: formatMessage({ id: 'topology.g6.menu.update' }) }
  ];
  if (stopped) {
    items.push({ key: 'start', icon: 'play-circle', label: formatMessage({ id: 'topology.g6.menu.start' }) });
  } else {
    items.push({ key: 'restart', icon: 'reload', label: formatMessage({ id: 'topology.g6.menu.restart' }) });
    items.push({ key: 'stop', icon: 'poweroff', label: formatMessage({ id: 'topology.g6.menu.stop' }) });
  }
  items.push({ key: 'terminal', icon: 'code', label: formatMessage({ id: 'topology.g6.menu.terminal' }) });
  items.push({
    key: 'delete',
    icon: 'delete',
    label: formatMessage({ id: 'topology.g6.menu.delete' }),
    danger: true
  });
  return items;
}

class NodeContextMenu extends PureComponent {
  render() {
    const { x, y, raw, onClick } = this.props;
    if (!raw) return null;
    const items = buildMenuItems(raw);
    return (
      <div className={styles.ctxMenu} style={{ left: x, top: y }}>
        <div className={styles.ctxTitle}>{raw.service_cname}</div>
        {items.map(m => (
          <div
            key={m.key}
            className={m.danger ? `${styles.ctxItem} ${styles.ctxDanger}` : styles.ctxItem}
            onClick={() => onClick(m.key, raw)}
          >
            <Icon type={m.icon} className={styles.ctxIcon} />
            {m.label}
          </div>
        ))}
      </div>
    );
  }
}

export default NodeContextMenu;
