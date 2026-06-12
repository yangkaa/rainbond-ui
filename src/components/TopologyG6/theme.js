// G6 拓扑图配色与组件状态主题（对齐现网 weavescope 截图）
export const COLORS = {
  hexRunning: '#34c6a2', // 运行中描边
  hexStopped: '#5a5a5a', // 未运行深灰描边
  hexAbnormal: '#f5222d',
  hexPending: '#1890ff',
  cloud: '#4aa8f8', // 网关云朵蓝
  centerDot: '#262626',
  edge: '#b8bcc4'
};

// 组件状态 → 视觉主题
export const STATUS_THEME = {
  running: { kind: 'running', color: '#52c41a' },
  closed: { kind: 'stopped', color: '#bfbfbf' },
  undeploy: { kind: 'stopped', color: '#bfbfbf' },
  abnormal: { kind: 'abnormal', color: '#f5222d' },
  some_abnormal: { kind: 'abnormal', color: '#fa8c16' },
  creating: { kind: 'pending', color: '#1890ff' },
  deploying: { kind: 'pending', color: '#1890ff' },
  starting: { kind: 'pending', color: '#1890ff' },
  stopping: { kind: 'pending', color: '#1890ff' },
  upgrade: { kind: 'pending', color: '#1890ff' },
  third_party: { kind: 'running', color: '#52c41a' },
  operator: { kind: 'running', color: '#52c41a' },
  Unknown: { kind: 'stopped', color: '#bfbfbf' }
};

export const DEFAULT_STATUS = STATUS_THEME.closed;

export function statusOf(curStatus) {
  return STATUS_THEME[curStatus] || DEFAULT_STATUS;
}

export function strokeColorOf(curStatus) {
  const st = statusOf(curStatus);
  if (st.kind === 'running') return COLORS.hexRunning;
  if (st.kind === 'abnormal') return COLORS.hexAbnormal;
  if (st.kind === 'pending') return COLORS.hexPending;
  return COLORS.hexStopped;
}
