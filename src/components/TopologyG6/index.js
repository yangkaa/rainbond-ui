/* eslint-disable react/sort-comp */
/*
 * G6 应用拓扑图（替换 weavescope iframe 实现）
 * - 数据：/console/teams/{team}/regions/{region}/topological?group_id= （global/fetAllTopology）
 * - 监控：application/groupMonitorData（合入节点 tooltip）
 * - 操作：启动/关闭/重启/更新/构建/删除/创建依赖/web终端（与旧版 Topological 同款 service/dispatch）
 */
import { Modal, notification, Button } from 'antd';
import { connect } from 'dva';
import { routerRedux, Link } from 'dva/router';
import React from 'react';
import { formatMessage } from '@/utils/intl';
import globalUtil from '../../utils/global';
import ConfirmModal from '../ConfirmModal';
import DependencyConfigModal from '../Topological/DependencyConfigModal';
import {
  addRelationedApp,
  editPortAlias,
  getOuterEnvs,
  getPorts,
  removeRelationedApp,
  updateRolling
} from '../../services/app';
import { createTopologyGraph, fitGraph } from './graph';
import { transformTopology, GATEWAY_ID } from './transform';
import NodeContextMenu from './menu';
import styles from './index.less';

const POLL_INTERVAL = 10000;

const getDefaultDependencyConfigState = () => ({
  dependencyConfigVisible: false,
  dependencyConfigLoading: false,
  dependencyConfigSubmitting: false,
  dependencyConfigSource: null,
  dependencyConfigTarget: null,
  dependencyConfigPorts: [],
  dependencyConfigAllEnvs: [],
  dependencyConfigSelectedPort: '',
  dependencyConfigAlias: '',
  dependencyConfigInitialAliases: {},
  dependencyConfigActiveLanguage: 'java',
  dependencyConfigShouldUpdate: true
});

@connect(
  ({ appControl, loading }) => ({
    build_upgrade: appControl.build_upgrade,
    deleteAppLoading: loading.effects['appControl/deleteApp'],
    stopLoading: loading.effects['appControl/putStop'],
    startLoading: loading.effects['appControl/putStart'],
    reStartLoading: loading.effects['appControl/putReStart'],
    updateRollingLoading: loading.effects['appControl/putUpdateRolling']
  }),
  null,
  null,
  { withRef: true }
)
class TopologyG6 extends React.Component {
  state = {
    deleteVisible: false,
    promptModal: null, // 'start' | 'stop' | 'restart' | 'rolling' | 'build'
    appAlias: '',
    actionIng: false,
    linkMode: false,
    contextMenu: null, // { x, y, raw }
    ...getDefaultDependencyConfigState()
  };

  componentDidMount() {
    this.mounted = true;
    this.monitorMap = {};
    this.initGraph();
    this.fetchTopology(true);
    this.fetchMonitor();
    this.pollTimer = setInterval(() => {
      this.fetchTopology(false);
      this.fetchMonitor();
    }, POLL_INTERVAL);
    window.addEventListener('resize', this.handleResize);
  }

  componentWillUnmount() {
    this.mounted = false;
    clearInterval(this.pollTimer);
    window.removeEventListener('resize', this.handleResize);
    if (this.graph && !this.graph.get('destroyed')) {
      this.graph.destroy();
    }
    this.graph = null;
  }

  /* ---------------- Graph 初始化与事件 ---------------- */

  initGraph = () => {
    const container = this.containerRef;
    if (!container) return;
    const graph = createTopologyGraph(container);
    this.graph = graph;

    graph.on('node:mouseenter', e => graph.setItemState(e.item, 'hover', true));
    graph.on('node:mouseleave', e => graph.setItemState(e.item, 'hover', false));

    graph.on('node:click', e => {
      if (graph.getCurrentMode() === 'addEdge') return;
      this.setState({ contextMenu: null });
      const raw = e.item.getModel().raw || {};
      this.handleNodeClick(raw);
    });

    graph.on('canvas:click', () => {
      this.setState({ contextMenu: null });
      if (this.state.linkMode) this.exitLinkMode();
    });

    graph.on('node:contextmenu', e => {
      e.preventDefault();
      const raw = e.item.getModel().raw || {};
      if (raw.isGateway) return;
      const rect = container.getBoundingClientRect();
      this.setState({
        contextMenu: { x: e.clientX - rect.left, y: e.clientY - rect.top, raw }
      });
    });
    container.addEventListener('contextmenu', ev => ev.preventDefault());

    graph.on('edge:contextmenu', e => {
      e.preventDefault();
      const model = e.item.getModel();
      this.handleEdgeDelete(model);
    });

    // 拖线建依赖
    graph.on('aftercreateedge', e => {
      const model = e.edge.getModel();
      graph.removeItem(e.edge);
      this.exitLinkMode();
      if (!model.target || model.target === model.source || model.target === GATEWAY_ID) {
        return;
      }
      this.handleEdgeCreated(model.source, model.target);
    });
  };

  handleResize = () => {
    const container = this.containerRef;
    if (!this.graph || this.graph.get('destroyed') || !container) return;
    this.graph.changeSize(container.clientWidth, container.clientHeight);
    fitGraph(this.graph);
  };

  /* ---------------- 数据获取 ---------------- */

  fetchTopology = (isFirst = false) => {
    const { dispatch, group_id: groupId } = this.props;
    const teamName = globalUtil.getCurrTeamName();
    const regionName = globalUtil.getCurrRegionName();
    dispatch({
      type: 'global/fetAllTopology',
      payload: { team_name: teamName, region_name: regionName, groupId },
      callback: res => {
        if (!this.mounted || !this.graph || this.graph.get('destroyed')) return;
        const bean = (res && (res.bean || res.data)) || res || {};
        const data = transformTopology(
          bean,
          formatMessage({ id: 'topology.Topological.label' })
        );
        this.applyMonitor(data);
        if (isFirst || !this.rendered) {
          this.graph.data(data);
          this.graph.render();
          this.rendered = true;
        } else {
          this.graph.changeData(data);
        }
      }
    });
  };

  fetchMonitor = () => {
    const { dispatch, group_id: groupId } = this.props;
    const teamName = globalUtil.getCurrTeamName();
    dispatch({
      type: 'application/groupMonitorData',
      payload: { team_name: teamName, group_id: groupId },
      callback: data => {
        if (!this.mounted) return;
        const list = (data && (data.list || data.bean)) || [];
        const map = {};
        (Array.isArray(list) ? list : []).forEach(item => {
          const sid = item.service_id;
          if (!sid) return;
          if (!map[sid]) map[sid] = [];
          if (item.monitor_item != null && item.value != null) {
            map[sid].push({ label: item.monitor_item, value: item.value });
          }
        });
        this.monitorMap = map;
      },
      handleError: () => {}
    });
  };

  applyMonitor = data => {
    const map = this.monitorMap || {};
    data.nodes.forEach(node => {
      if (node.raw && map[node.id]) {
        node.raw.monitor = map[node.id];
      }
    });
  };

  /* ---------------- 节点点击：跳转详情（复用现有 SlidePanel 行为） ---------------- */

  handleNodeClick = raw => {
    const { dispatch } = this.props;
    const teamName = globalUtil.getCurrTeamName();
    const regionName = globalUtil.getCurrRegionName();
    const appID = globalUtil.getAppID();
    if (raw.isGateway) {
      dispatch(
        routerRedux.push(
          `/team/${teamName}/region/${regionName}/apps/${appID}/overview?type=gateway`
        )
      );
      return;
    }
    const app = (this.props.apps || []).find(
      item => item.service_alias === raw.service_alias
    );
    if (app && app.status === 'creating' && app.service_source !== 'kubeblocks') {
      dispatch(
        routerRedux.push(
          `/team/${teamName}/region/${regionName}/create/create-check/${raw.service_alias}`
        )
      );
      return;
    }
    dispatch(
      routerRedux.push(
        `/team/${teamName}/region/${regionName}/apps/${appID}/overview?type=components&componentID=${raw.service_alias}&tab=overview`
      )
    );
  };

  /* ---------------- 右键菜单操作 ---------------- */

  handleMenuClick = (key, raw) => {
    this.setState({ contextMenu: null });
    switch (key) {
      case 'link':
        this.enterLinkMode();
        break;
      case 'build':
        this.setState({ appAlias: raw.service_alias, promptModal: 'build' });
        break;
      case 'update':
        this.setState({ appAlias: raw.service_alias, promptModal: 'rolling' });
        break;
      case 'start':
        this.setState({ appAlias: raw.service_alias, promptModal: 'start' });
        break;
      case 'restart':
        this.setState({ appAlias: raw.service_alias, promptModal: 'restart' });
        break;
      case 'stop':
        this.setState({ appAlias: raw.service_alias, promptModal: 'stop' });
        break;
      case 'terminal':
        this.setState({ appAlias: raw.service_alias }, () => {
          const link = document.getElementById('topology-g6-terminal-link');
          if (link) link.click();
        });
        break;
      case 'delete':
        this.setState({ appAlias: raw.service_alias, deleteVisible: true });
        break;
      default:
        break;
    }
  };

  handlePromptOk = () => {
    const { promptModal } = this.state;
    if (promptModal === 'build') {
      this.handleDeploy();
      return;
    }
    const parameter = {
      stop: 'putStop',
      start: 'putStart',
      restart: 'putReStart',
      rolling: 'putUpdateRolling'
    }[promptModal];
    if (parameter) this.handleOperation(parameter);
  };

  handlePromptCancel = () => {
    this.setState({ promptModal: null });
  };

  handleOperation = state => {
    const { actionIng, appAlias } = this.state;
    const { dispatch } = this.props;
    const teamName = globalUtil.getCurrTeamName();
    if (actionIng) {
      notification.warning({
        message: formatMessage({ id: 'notification.warn.executing' })
      });
      return;
    }
    const operationMap = {
      putReStart: formatMessage({ id: 'notification.success.operationRestart' }),
      putStart: formatMessage({ id: 'notification.success.operationStart' }),
      putStop: formatMessage({ id: 'notification.success.operationClose' }),
      putUpdateRolling: formatMessage({ id: 'notification.success.operationUpdata' })
    };
    dispatch({
      type: `appControl/${state}`,
      payload: { team_name: teamName, app_alias: appAlias },
      callback: res => {
        if (res) {
          notification.success({ message: operationMap[state] });
        }
        this.setState({ promptModal: null });
        this.fetchTopology(false);
      }
    });
  };

  handleDeploy = () => {
    const { actionIng, appAlias } = this.state;
    const { dispatch } = this.props;
    const teamName = globalUtil.getCurrTeamName();
    if (actionIng) {
      notification.warning({
        message: formatMessage({ id: 'notification.warn.executing' })
      });
      return;
    }
    dispatch({
      type: 'appControl/putDeploy',
      payload: {
        team_name: teamName,
        app_alias: appAlias,
        group_version: '',
        is_upgrate: ''
      },
      callback: res => {
        if (res) {
          notification.success({
            message: formatMessage({ id: 'notification.success.deployment' })
          });
        }
        this.setState({ promptModal: null });
        this.fetchTopology(false);
      }
    });
  };

  /* ---------------- 删除组件 ---------------- */

  cancelDeleteApp = () => {
    this.setState({ deleteVisible: false });
  };

  handleDeleteApp = () => {
    const { dispatch } = this.props;
    const teamName = globalUtil.getCurrTeamName();
    dispatch({
      type: 'appControl/deleteApp',
      payload: { team_name: teamName, app_alias: this.state.appAlias },
      callback: () => {
        this.setState({ deleteVisible: false });
        dispatch({ type: 'global/fetchGroups', payload: { team_name: teamName } });
        this.fetchTopology(false);
      }
    });
  };

  /* ---------------- 创建依赖（连线模式） ---------------- */

  enterLinkMode = () => {
    const graph = this.graph;
    if (!graph || graph.get('destroyed')) return;
    graph.setMode('addEdge');
    graph.getNodes().forEach(n => graph.setItemState(n, 'linkable', true));
    this.setState({ linkMode: true });
  };

  exitLinkMode = () => {
    const graph = this.graph;
    if (!graph || graph.get('destroyed')) return;
    graph.setMode('default');
    graph.getNodes().forEach(n => graph.setItemState(n, 'linkable', false));
    this.setState({ linkMode: false });
  };

  findNodeRaw = serviceId => {
    if (!this.graph) return null;
    const item = this.graph.findById(serviceId);
    return item ? item.getModel().raw || {} : null;
  };

  handleEdgeCreated = (sourceId, targetId) => {
    const { dispatch } = this.props;
    const teamName = globalUtil.getCurrTeamName();
    const sourceRaw = this.findNodeRaw(sourceId) || {};
    const targetRaw = this.findNodeRaw(targetId) || {};

    // 网关 → 组件：开启对外端口
    if (sourceId === GATEWAY_ID) {
      dispatch({
        type: 'appControl/openExternalPort',
        payload: {
          team_name: teamName,
          app_alias: targetRaw.service_alias,
          container_port: '',
          open_outer: ''
        },
        callback: res => {
          if (res && res.status_code === 200) {
            notification.success({
              message: res.msg_show || formatMessage({ id: 'topology.g6.port.opened' })
            });
            this.fetchTopology(false);
          } else if (res && res.status_code === 201 && res.list && res.list.length > 0) {
            dispatch({
              type: 'appControl/openExternalPort',
              payload: {
                team_name: teamName,
                app_alias: targetRaw.service_alias,
                container_port: res.list[0],
                open_outer: true
              },
              callback: portRes => {
                if (portRes && portRes.status_code === 200) {
                  notification.success({
                    message: formatMessage({ id: 'topology.g6.port.opened' })
                  });
                  this.fetchTopology(false);
                }
              }
            });
          }
        }
      });
      return;
    }

    // 组件间连线：创建依赖关系（与旧版 onEdgeCreated 同款逻辑）
    const openModal = preferredPort => {
      this.openDependencyConfigModal({
        sourceServiceAlias: sourceRaw.service_alias,
        sourceServiceCname: sourceRaw.service_cname,
        sourceShape: sourceRaw.cur_status,
        targetServiceId: targetId,
        targetServiceAlias: targetRaw.service_alias,
        targetServiceCname: targetRaw.service_cname,
        preferredPort
      });
    };

    addRelationedApp({
      team_name: teamName,
      app_alias: sourceRaw.service_alias,
      dep_service_id: targetId
    })
      .then(res => {
        if (res && res.status_code === 200) {
          openModal();
        } else if (res && res.status_code === 201 && res.list && res.list.length > 0) {
          addRelationedApp({
            team_name: teamName,
            app_alias: sourceRaw.service_alias,
            dep_service_id: targetId,
            open_inner: true,
            container_port: res.list[0]
          }).then(portRes => {
            if (portRes && portRes.status_code === 200) {
              openModal(res.list[0]);
            }
          });
        } else if (res && res.status_code === 212) {
          notification.warning({
            message: res.msg_show || formatMessage({ id: 'topology.g6.dependency.exists' })
          });
        } else {
          notification.error({
            message: formatMessage({ id: 'topology.g6.dependency.failed' })
          });
        }
      })
      .catch(() => {
        notification.error({
          message: formatMessage({ id: 'topology.g6.network.error' })
        });
      });
  };

  /* ---------------- 删除连线（依赖 / 对外端口） ---------------- */

  handleEdgeDelete = model => {
    const { dispatch } = this.props;
    const teamName = globalUtil.getCurrTeamName();
    const sourceRaw = this.findNodeRaw(model.source) || {};
    const targetRaw = this.findNodeRaw(model.target) || {};
    const isInternet = model.source === GATEWAY_ID;
    const sourceDisplay = sourceRaw.service_cname || sourceRaw.service_alias || '';
    const targetDisplay = targetRaw.service_cname || targetRaw.service_alias || '';

    Modal.confirm({
      title: isInternet
        ? formatMessage({ id: 'topology.g6.edge.close_port_title' })
        : formatMessage({ id: 'topology.g6.edge.delete_dep_title' }),
      content: isInternet
        ? formatMessage({ id: 'topology.g6.edge.close_port_desc' }, { name: targetDisplay })
        : formatMessage(
            { id: 'topology.g6.edge.delete_dep_desc' },
            { source: sourceDisplay, target: targetDisplay }
          ),
      okType: 'danger',
      onOk: () => {
        if (isInternet) {
          dispatch({
            type: 'appControl/openExternalPort',
            payload: {
              team_name: teamName,
              app_alias: targetRaw.service_alias,
              close_outer: true
            },
            callback: res => {
              if (res && res.status_code === 200) {
                notification.success({
                  message: res.msg_show || formatMessage({ id: 'topology.g6.port.closed' })
                });
              }
              this.fetchTopology(false);
            }
          });
        } else {
          removeRelationedApp({
            team_name: teamName,
            app_alias: sourceRaw.service_alias,
            dep_service_id: model.target
          })
            .then(res => {
              if (res && res.status_code === 200) {
                notification.success({
                  message: res.msg_show || formatMessage({ id: 'topology.g6.dependency.removed' })
                });
              }
              this.fetchTopology(false);
            })
            .catch(() => {
              notification.error({
                message: formatMessage({ id: 'topology.g6.network.error' })
              });
            });
        }
      }
    });
  };

  /* ---------------- 依赖配置弹窗（与旧版 Topological 同款逻辑） ---------------- */

  getTargetAppDetail = (targetServiceId, targetServiceAlias) => {
    const currentApps = this.props.apps || [];
    return (
      currentApps.find(app => `${app.service_id}` === `${targetServiceId}`) ||
      currentApps.find(app => app.service_alias === targetServiceAlias) ||
      null
    );
  };

  getSelectablePorts = (ports = []) => {
    const openedInnerPorts = ports.filter(port => port.is_inner_service);
    return openedInnerPorts.length ? openedInnerPorts : ports;
  };

  getSelectedDependencyPort = () => {
    const { dependencyConfigPorts, dependencyConfigSelectedPort } = this.state;
    return dependencyConfigPorts.find(
      port => `${port.container_port}` === `${dependencyConfigSelectedPort}`
    );
  };

  getDependencyPreviewEnvs = () => {
    const {
      dependencyConfigAllEnvs,
      dependencyConfigAlias,
      dependencyConfigSelectedPort
    } = this.state;
    const selectedPort = this.getSelectedDependencyPort();
    if (!selectedPort) return [];

    const exactPortEnvs = dependencyConfigAllEnvs.filter(
      env => `${env.container_port}` === `${dependencyConfigSelectedPort}`
    );
    const sharedEnvs = dependencyConfigAllEnvs.filter(
      env => Number(env.container_port) === 0
    );
    const previewEnvs = exactPortEnvs.length
      ? exactPortEnvs.concat(
          sharedEnvs.filter(
            env => !exactPortEnvs.some(item => item.attr_name === env.attr_name)
          )
        )
      : dependencyConfigAllEnvs;

    const originalAlias = selectedPort.port_alias || '';
    const nextAlias = dependencyConfigAlias || originalAlias;

    return previewEnvs.map(env => {
      const attrName = env.attr_name || '';
      return {
        ...env,
        attr_name:
          originalAlias && attrName.indexOf(`${originalAlias}_`) === 0
            ? `${nextAlias}${attrName.slice(originalAlias.length)}`
            : attrName
      };
    });
  };

  openDependencyConfigModal = ({
    sourceServiceAlias,
    sourceServiceCname,
    sourceShape,
    targetServiceId,
    targetServiceAlias,
    targetServiceCname,
    preferredPort
  }) => {
    const teamName = globalUtil.getCurrTeamName();
    const targetApp = this.getTargetAppDetail(targetServiceId, targetServiceAlias);
    const resolvedTargetAlias = (targetApp && targetApp.service_alias) || targetServiceAlias;

    if (!resolvedTargetAlias) {
      notification.warning({
        message: formatMessage({ id: 'topology.dependency_config.load_failed' })
      });
      return;
    }

    this.setState({
      ...getDefaultDependencyConfigState(),
      dependencyConfigVisible: true,
      dependencyConfigLoading: true,
      dependencyConfigSource: {
        service_alias: sourceServiceAlias,
        displayName: sourceServiceCname || sourceServiceAlias || ''
      },
      dependencyConfigTarget: {
        ...(targetApp || {}),
        service_alias: resolvedTargetAlias,
        displayName:
          (targetApp && (targetApp.service_cname || targetApp.service_alias)) ||
          targetServiceCname ||
          resolvedTargetAlias
      },
      dependencyConfigShouldUpdate:
        sourceShape !== 'undeploy' && sourceShape !== 'closed' && sourceShape !== 'stopping'
    });

    Promise.all([
      getPorts({ team_name: teamName, app_alias: resolvedTargetAlias }).catch(() => null),
      getOuterEnvs({
        team_name: teamName,
        app_alias: resolvedTargetAlias,
        page: 1,
        page_size: 1000,
        env_name: ''
      }).catch(() => null)
    ]).then(([portsRes, envRes]) => {
      if (!this.mounted) return;
      const rawPorts = portsRes && portsRes.list ? portsRes.list : [];
      const dependencyConfigPorts = this.getSelectablePorts(rawPorts);
      const dependencyConfigInitialAliases = dependencyConfigPorts.reduce((result, port) => {
        result[`${port.container_port}`] = port.port_alias || '';
        return result;
      }, {});

      let dependencyConfigSelectedPort = '';
      if (
        preferredPort &&
        dependencyConfigPorts.some(port => `${port.container_port}` === `${preferredPort}`)
      ) {
        dependencyConfigSelectedPort = `${preferredPort}`;
      } else if (dependencyConfigPorts.length) {
        dependencyConfigSelectedPort = `${dependencyConfigPorts[0].container_port}`;
      }

      this.setState({
        dependencyConfigLoading: false,
        dependencyConfigPorts,
        dependencyConfigAllEnvs: envRes && envRes.list ? envRes.list : [],
        dependencyConfigInitialAliases,
        dependencyConfigSelectedPort,
        dependencyConfigAlias:
          dependencyConfigInitialAliases[dependencyConfigSelectedPort] || ''
      });
    });
  };

  closeDependencyConfigModal = () => {
    this.setState(getDefaultDependencyConfigState());
  };

  handleDependencyConfigCancel = () => {
    this.closeDependencyConfigModal();
    this.fetchTopology(false);
  };

  handleDependencyPortChange = value => {
    const { dependencyConfigInitialAliases } = this.state;
    this.setState({
      dependencyConfigSelectedPort: value,
      dependencyConfigAlias: dependencyConfigInitialAliases[value] || '',
      dependencyConfigActiveLanguage: 'java'
    });
  };

  handleDependencyAliasChange = e => {
    this.setState({ dependencyConfigAlias: e.target.value });
  };

  handleDependencyLanguageChange = dependencyConfigActiveLanguage => {
    this.setState({ dependencyConfigActiveLanguage });
  };

  handleDependencyConfigSubmit = () => {
    const teamName = globalUtil.getCurrTeamName();
    const selectedPort = this.getSelectedDependencyPort();
    const {
      dependencyConfigAlias,
      dependencyConfigInitialAliases,
      dependencyConfigShouldUpdate,
      dependencyConfigSource,
      dependencyConfigTarget,
      dependencyConfigPorts
    } = this.state;

    if (!selectedPort || !dependencyConfigTarget || !dependencyConfigSource) {
      return;
    }

    const nextAlias = (dependencyConfigAlias || '').trim();
    if (!nextAlias) {
      notification.warning({
        message: formatMessage({ id: 'topology.dependency_config.alias_required' })
      });
      return;
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(nextAlias)) {
      notification.warning({
        message: formatMessage({ id: 'topology.dependency_config.alias_invalid' })
      });
      return;
    }

    const portKey = `${selectedPort.container_port}`;
    const originalAlias = dependencyConfigInitialAliases[portKey] || '';
    const aliasChanged = nextAlias !== originalAlias;

    this.setState({ dependencyConfigSubmitting: true });

    const saveAliasRequest = aliasChanged
      ? editPortAlias({
          team_name: teamName,
          app_alias: dependencyConfigTarget.service_alias,
          k8s_service_name: selectedPort.k8s_service_name,
          port: selectedPort.container_port,
          port_alias: nextAlias
        })
      : Promise.resolve({ status_code: 200 });

    saveAliasRequest
      .then(res => {
        if (!res || (res.status_code && res.status_code >= 400)) {
          throw new Error('edit');
        }
        if (!dependencyConfigShouldUpdate) {
          return { updated: false };
        }
        return updateRolling({
          team_name: teamName,
          app_alias: dependencyConfigSource.service_alias
        }).then(updateRes => {
          if (!updateRes || (updateRes.status_code && updateRes.status_code >= 400)) {
            throw new Error('update');
          }
          return { updated: true };
        });
      })
      .then(({ updated }) => {
        const nextPorts = aliasChanged
          ? dependencyConfigPorts.map(port =>
              `${port.container_port}` !== portKey ? port : { ...port, port_alias: nextAlias }
            )
          : dependencyConfigPorts;

        this.setState({
          dependencyConfigPorts: nextPorts,
          dependencyConfigInitialAliases: {
            ...dependencyConfigInitialAliases,
            [portKey]: nextAlias
          },
          dependencyConfigSubmitting: false
        });

        notification.success({
          message: formatMessage({
            id: updated
              ? 'notification.success.operationUpdata'
              : 'notification.success.succeeded'
          })
        });

        this.closeDependencyConfigModal();
        this.fetchTopology(false);
      })
      .catch(error => {
        this.setState({ dependencyConfigSubmitting: false });
        notification.error({
          message: formatMessage({
            id:
              error && error.message === 'edit'
                ? 'notification.error.edit'
                : 'notification.error.update'
          })
        });
      });
  };

  saveContainer = ref => {
    this.containerRef = ref;
  };

  render() {
    const {
      deleteAppLoading,
      stopLoading,
      startLoading,
      reStartLoading,
      updateRollingLoading,
      iframeHeight
    } = this.props;
    const {
      deleteVisible,
      promptModal,
      appAlias,
      linkMode,
      contextMenu,
      dependencyConfigVisible,
      dependencyConfigLoading,
      dependencyConfigSubmitting,
      dependencyConfigSource,
      dependencyConfigTarget,
      dependencyConfigPorts,
      dependencyConfigSelectedPort,
      dependencyConfigAlias,
      dependencyConfigActiveLanguage,
      dependencyConfigShouldUpdate
    } = this.state;
    const teamName = globalUtil.getCurrTeamName();
    const regionName = globalUtil.getCurrRegionName();
    const codeObj = {
      start: formatMessage({ id: 'topology.Topological.start' }),
      stop: formatMessage({ id: 'topology.Topological.stop' }),
      restart: formatMessage({ id: 'topology.g6.menu.restart' }),
      rolling: formatMessage({ id: 'topology.Topological.rolling' }),
      build: formatMessage({ id: 'topology.Topological.build' })
    };
    const dependencySelectedPort = this.getSelectedDependencyPort();
    const dependencyPreviewEnvs = this.getDependencyPreviewEnvs();
    const canSubmitDependencyConfig =
      !dependencyConfigLoading &&
      !!dependencySelectedPort &&
      !!(dependencyConfigAlias || '').trim();

    return (
      <div className={styles.wrap} style={{ height: iframeHeight || '100%' }}>
        <div className={styles.canvas} ref={this.saveContainer} />

        {linkMode && (
          <div className={styles.linkModeBar}>
            {formatMessage({ id: 'topology.g6.link_mode.tip' })}
            <Button size="small" onClick={this.exitLinkMode}>
              {formatMessage({ id: 'topology.g6.link_mode.exit' })}
            </Button>
          </div>
        )}

        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            raw={contextMenu.raw}
            onClick={this.handleMenuClick}
          />
        )}

        {deleteVisible && (
          <ConfirmModal
            onOk={this.handleDeleteApp}
            onCancel={this.cancelDeleteApp}
            loading={deleteAppLoading}
            title={formatMessage({ id: 'confirmModal.component.delete.title' })}
            desc={formatMessage({ id: 'confirmModal.delete.component.desc' })}
            subDesc={formatMessage({ id: 'confirmModal.delete.strategy.subDesc' })}
          />
        )}

        {promptModal && (
          <Modal
            title={formatMessage({ id: 'topology.Topological.title' })}
            visible
            onOk={this.handlePromptOk}
            onCancel={this.handlePromptCancel}
            confirmLoading={
              promptModal === 'stop'
                ? stopLoading
                : promptModal === 'start'
                ? startLoading
                : promptModal === 'restart'
                ? reStartLoading
                : promptModal === 'rolling'
                ? updateRollingLoading
                : false
            }
          >
            <p style={{ textAlign: 'center' }}>
              {formatMessage({ id: 'topology.Topological.determine' })}
              {codeObj[promptModal]}
              {formatMessage({ id: 'topology.Topological.now' })}
            </p>
          </Modal>
        )}

        {dependencyConfigVisible && (
          <DependencyConfigModal
            visible={dependencyConfigVisible}
            loading={dependencyConfigLoading}
            submitting={dependencyConfigSubmitting}
            sourceName={(dependencyConfigSource && dependencyConfigSource.displayName) || ''}
            targetName={(dependencyConfigTarget && dependencyConfigTarget.displayName) || ''}
            ports={dependencyConfigPorts}
            selectedPortKey={dependencyConfigSelectedPort}
            selectedPort={dependencySelectedPort}
            aliasValue={dependencyConfigAlias}
            envs={dependencyPreviewEnvs}
            activeLanguage={dependencyConfigActiveLanguage}
            shouldUpdateService={dependencyConfigShouldUpdate}
            canSubmit={canSubmitDependencyConfig}
            onClose={this.closeDependencyConfigModal}
            onPortChange={this.handleDependencyPortChange}
            onAliasChange={this.handleDependencyAliasChange}
            onLanguageChange={this.handleDependencyLanguageChange}
            onCancelAction={this.handleDependencyConfigCancel}
            onSubmit={this.handleDependencyConfigSubmit}
          />
        )}

        <Link
          id="topology-g6-terminal-link"
          to={`/team/${teamName}/region/${regionName}/components/${appAlias}/webconsole`}
          target="_blank"
        />
      </div>
    );
  }
}

export default TopologyG6;
