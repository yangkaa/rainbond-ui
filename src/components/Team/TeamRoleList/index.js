import React, { PureComponent, Fragment } from 'react';
import { connect } from 'dva';
import { Tabs, Icon, Menu, Button, Spin, Empty } from 'antd';
import PermissionsForm from './permissionsForm';
import ConfirmModal from '../../ConfirmModal';
import globalUtil from '../../../utils/global';
import roleUtil from '../../../utils/role';
import styles from './index.less';

const { Item } = Menu;
const { TabPane } = Tabs;

@connect(({ teamControl, loading }) => ({
  teamControl,
  activitiesLoading: loading.effects['activities/fetchList'],
}))
export default class RoleList extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showAddRole: false,
      roleList: [],
      rolesID: null,
      rolesLoading: true,
      permissions: null,
      permissionsLoading: true,
    };
  }
  componentDidMount() {
    this.loadTeamRoles();
    this.loadPermissions();
  }
  onDelRole = item => {
    this.setState({ deleteRole: item });
  };

  showAddRole = () => {
    this.setState({ showAddRole: true });
  };
  hideAddRole = ID => {
    this.setState({ showAddRole: false });
    if (ID && typeof ID === 'number') {
      return this.loadTeamRoles(ID);
    }
  };

  handleDelRole = () => {
    this.props.dispatch({
      type: 'teamControl/removeRole',
      payload: {
        team_name: globalUtil.getCurrTeamName(),
        role_id: this.state.deleteRole.ID,
      },
      callback: () => {
        this.hideDelRole();
        this.loadTeamRoles();
      },
    });
  };
  hideDelRole = () => {
    this.setState({ deleteRole: null });
  };

  loadTeamRoles = (rolesID = false) => {
    const { dispatch } = this.props;
    dispatch({
      type: 'teamControl/fetchTeamRoles',
      payload: {
        team_name: globalUtil.getCurrTeamName(),
      },
      callback: res => {
        if (res && res._code === 200) {
          let ID = null;
          if (res.list && res.list.length > 0) {
            ID = res.list[0].ID;
          }
          this.setState({
            roleList: res.list,
            rolesID: rolesID || ID,
            rolesLoading: false,
          });
        }
      },
    });
  };

  loadPermissions = () => {
    const { dispatch } = this.props;
    dispatch({
      type: 'global/fetchPermissions',
      callback: res => {
        if (res && res._code === 200) {
          this.setState({
            permissions: res.bean || [],
            permissionsLoading: false,
          });
        }
      },
    });
  };

  selectKey = ({ key }) => {
    this.setState({
      rolesID: key,
    });
  };

  render() {
    const {
      rolePermissions: { isCreate, isEdit, isDelete },
    } = this.props;
    const {
      roleList,
      rolesLoading,
      permissions,
      permissionsLoading,
      showAddRole,
      rolesID,
      deleteRole,
    } = this.state;
    const roles = roleList && roleList.length > 0;
    return (
      <Fragment>
        <div className={styles.systemRoleWrapper}>
          <div className={styles.systemRole}>
            <div className={styles.systemRoleTitle}>角色列表</div>
            <Spin spinning={rolesLoading}>
              <div className={styles.systemRoleList}>
                {roles && (
                  <Menu
                    mode="inline"
                    selectedKeys={[`${rolesID}`]}
                    onClick={this.selectKey}
                  >
                    {roleList.map(item => {
                      const { ID, name } = item;
                      return (
                        <Item key={ID} className={styles.roleName}>
                          <div> {roleUtil.actionMap(name)}</div>
                          {isDelete && (
                            <Icon
                              type="delete"
                              onClick={() => {
                                this.onDelRole(item);
                              }}
                            />
                          )}
                        </Item>
                      );
                    })}
                  </Menu>
                )}
              </div>
            </Spin>
            <div className={styles.systemRoleBtn}>
              {!showAddRole && isCreate && (
                <Button type="primary" onClick={this.showAddRole}>
                  添加角色
                </Button>
              )}
            </div>
          </div>
          <div className={styles.authSettingBody}>
            <Tabs defaultActiveKey="1">
              <TabPane tab="权限设置" key="1">
                {!roles && !permissionsLoading && !showAddRole ? (
                  <div className={styles.noRole}>
                    <Empty description={<span>暂无角色、请先添加角色</span>} />
                  </div>
                ) : (
                  <PermissionsForm
                    isEdit={isEdit}
                    isCreate={isCreate}
                    isAddRole={showAddRole}
                    onCancelAddRole={this.hideAddRole}
                    rolesID={rolesID}
                    roleList={roleList}
                    permissions={permissions}
                    permissionsLoading={permissionsLoading}
                  />
                )}
              </TabPane>
            </Tabs>
          </div>
        </div>

        {deleteRole && (
          <ConfirmModal
            onOk={this.handleDelRole}
            title="删除角色"
            subDesc="此操作不可恢复"
            desc={`确定要删除角色 （${deleteRole.name}） 吗？`}
            onCancel={this.hideDelRole}
          />
        )}
      </Fragment>
    );
  }
}
