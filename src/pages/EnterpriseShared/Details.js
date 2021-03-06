/* eslint-disable no-unused-expressions */
import React, { PureComponent } from 'react';
import {
  Icon,
  Form,
  Upload,
  Select,
  Input,
  Radio,
  Spin,
  Divider,
  Row,
  Col,
  Card,
  notification,
  Table,
  Button,
  Modal
} from 'antd';
import { connect } from 'dva';
import moment from 'moment';
import { routerRedux } from 'dva/router';
import apiconfig from '../../../config/api.config';
import ConfirmModal from '../../components/ConfirmModal';
import EditAppVersion from '../../components/EditAppVersion';
import editClusterInfo from '@/components/Cluster/BaseAddCluster';
import PageHeaderLayout from '../../layouts/PageHeaderLayout';
import BraftEditor from 'braft-editor';
import { object } from 'prop-types';
import cookie from '../../utils/cookie';
import globalUtil from '../../utils/global';
import userUtil from '../../utils/user';
import 'braft-editor/dist/index.css';
import styless from './index.less';
import detailstyles from '../../components/MarketAppDetailShow/index.less';
import styles from '../../components/CreateTeam/index.less';

const FormItem = Form.Item;
const { Option } = Select;
const { TextArea } = Input;
const { confirm } = Modal;

@connect(({ user, application, enterprise, teamControl, loading }) => ({
  currUser: user.currentUser,
  apps: application.apps,
  currentTeam: teamControl.currentTeam,
  currentRegionName: teamControl.currentRegionName,
  currentEnterprise: enterprise.currentEnterprise,
  groupDetail: application.groupDetail || {},
  loading
}))
@Form.create()
export default class Main extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      appInfo: {},
      isShared: window.location.href.indexOf('shared') > -1,
      isAddLicense: false,
      tagList: [],
      teamList: [],
      imageUrl: '',
      enterpriseTeamsLoading: true,
      imageBase64: '',
      page: 1,
      page_size: 10,
      appList: [],
      toDelete: false,
      editAppVersion: false,
      isEdit: false,
      isAppDetails: false
    };
  }
  componentWillMount() {
    this.getTags();
    this.getEnterpriseTeams();
    this.getAppModelsDetails();
  }
  componentDidMount() {}
  getLogoBase64 = (img, callback) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => callback(reader.result));
    reader.readAsDataURL(img);
  };
  getEnterpriseTeams = name => {
    const {
      dispatch,
      match: {
        params: { eid }
      }
    } = this.props;
    const { page, page_size } = this.state;
    dispatch({
      type: 'global/fetchEnterpriseTeams',
      payload: {
        name,
        page,
        page_size,
        enterprise_id: eid
      },
      callback: res => {
        if (res && res._code === 200) {
          if (res.bean && res.bean.list) {
            const listNum = (res.bean && res.bean.total_count) || 0;
            const isAdd = !!(listNum && listNum > page_size);

            this.setState({
              teamList: res.bean.list,
              isAddLicense: isAdd,
              enterpriseTeamsLoading: false
            });
          }
        }
      }
    });
  };
  getTags = () => {
    const {
      dispatch,
      match: {
        params: { eid }
      }
    } = this.props;
    dispatch({
      type: 'market/fetchAppModelsTags',
      payload: {
        enterprise_id: eid
      },
      callback: res => {
        if (res && res._code === 200) {
          this.setState({
            tagList: res.list
          });
        }
      }
    });
  };
  getAppModelsDetails = () => {
    const {
      dispatch,
      match: {
        params: { eid, appId }
      },
      form
    } = this.props;

    dispatch({
      type: 'market/fetchAppModelsDetails',
      payload: {
        enterprise_id: eid,
        appId
      },
      callback: res => {
        if (res && res._code === 200) {
          // 异步设置编辑器内容
          const text = res.bean && res.bean.details;
          const details = form.getFieldValue('details');
          if (details) {
            form.setFieldsValue({
              details: BraftEditor.createEditorState(text)
            });
          }

          this.setState({
            imageUrl: res.bean.pic,
            appInfo: res.bean,
            appList: res.list
          });
        }
      }
    });
  };
  upDataAppVersionInfo = value => {
    const {
      dispatch,
      match: {
        params: { eid, appId }
      }
    } = this.props;
    const { editAppVersion } = this.state;
    dispatch({
      type: 'market/upDataAppVersionInfo',
      payload: {
        enterprise_id: eid,
        appId,
        version: editAppVersion.version,
        ...value
      },
      callback: res => {
        if (res && res._code === 200) {
          this.handleCloseEditAppVersion();
          this.getAppModelsDetails();
          notification.success({ message: '编辑成功' });
        }
      }
    });
  };
  handleRelease = value => {
    const {
      dispatch,
      match: {
        params: { eid, appId }
      }
    } = this.props;
    const parameter = Object.assign(value, {
      dev_status: value.dev_status ? '' : 'release'
    });
    dispatch({
      type: 'market/upDataAppVersionInfo',
      payload: {
        enterprise_id: eid,
        appId,
        ...value
      },
      callback: res => {
        if (res && res._code === 200) {
          this.handleCloseEditAppVersion();
          this.getAppModelsDetails();
        }
      }
    });
  };
  handleLogoChange = info => {
    if (info.file.status === 'uploading') {
      this.setState({ loading: true });
      return;
    }
    if (info.file.status === 'done') {
      this.setState({
        imageUrl:
          info.file &&
          info.file.response &&
          info.file.response.data &&
          info.file.response.data.bean &&
          info.file.response.data.bean.file_url,
        loading: false
      });

      this.getLogoBase64(info.file.originFileObj, imageBase64 =>
        this.setState({
          imageBase64
        })
      );
    }
  };
  handleLogoRemove = () => {
    this.setState({ imageUrl: '', imageBase64: '' });
  };
  handleToDelete = info => {
    this.setState({
      toDelete: info
    });
  };
  handleCancelDelete = () => {
    this.setState({
      toDelete: false
    });
  };
  handleCloseEditAppVersion = () => {
    this.setState({
      editAppVersion: false
    });
  };
  handleEditAppVersionInfo = info => {
    this.setState({
      editAppVersion: info
    });
  };
  handleDeleteVersion = () => {
    const {
      dispatch,
      match: {
        params: { eid, appId }
      }
    } = this.props;
    const { toDelete } = this.state;
    dispatch({
      type: 'market/deleteAppVersion',
      payload: {
        enterprise_id: eid,
        appId,
        version: toDelete.version
      },
      callback: res => {
        if (res && res._code === 200) {
          notification.success({ message: '删除成功' });
          this.handleCancelDelete();
          this.getAppModelsDetails();
        }
      }
    });
  };
  addTeams = () => {
    this.setState(
      {
        enterpriseTeamsLoading: true,
        page_size: this.state.page_size + 10
      },
      () => {
        this.getEnterpriseTeams();
      }
    );
  };
  upAppModel = (appInfo, tagId, details) => {
    const {
      dispatch,
      match: {
        params: { eid, appId }
      },
      form
    } = this.props;
    const { imageUrl, tagList, isEdit, isAppDetails } = this.state;
    form.validateFields((err, values) => {
      if (!err) {
        const arr = [];
        if (
          values.tag_ids &&
          values.tag_ids.length > 0 &&
          tagList &&
          tagList.length > 0
        ) {
          values.tag_ids.map(items => {
            tagList.map(item => {
              if (items === item.name) {
                arr.push(parseFloat(item.tag_id));
              }
            });
          });
        }
        const parameter = {
          enterprise_id: eid,
          name: appInfo ? appInfo.app_name : values.name,
          pic: imageUrl,
          tag_ids: tagId ? tagId : arr,
          app_id: appId,
          describe: appInfo ? appInfo.describe : values.describe,
          details: details ? details : values.details.toHTML(),
          scope: appInfo ? appInfo.scope : values.scope
        };
        dispatch({
          type: 'market/upAppModel',
          payload: parameter,
          callback: res => {
            if (res && res._code === 200) {
              notification.success({ message: '保存成功' });
              if (appInfo) {
                this.handleAppDetails(!isAppDetails);
              } else {
                this.handleIsEdit(!isEdit);
              }
              this.getAppModelsDetails();
            }
          }
        });
      }
    });
  };
  handleIsEdit = isEdit => {
    this.setState({ isEdit });
  };
  handleAppDetails = isAppDetails => {
    const { appInfo } = this.state;
    const { form } = this.props;
    const text = appInfo && appInfo.details;
    this.setState({ isAppDetails }, () => {
      if (isAppDetails) {
        form.setFieldsValue({
          details: BraftEditor.createEditorState(text)
        });
      }
    });
  };
  handleCancel = () => {
    const {
      dispatch,
      match: {
        params: { eid }
      }
    } = this.props;
    dispatch(routerRedux.push(`/enterprise/${eid}/shared`));
  };
  handleIsRelease = record => {
    const _th = this;
    confirm({
      title: record.dev_status
        ? '确定取消Release状态?'
        : '确定设为Release状态?',
      content: '',
      okText: '确认',
      cancelText: '取消',
      onOk() {
        _th.handleRelease(record);
      }
    });
  };

  render() {
    const {
      loading,
      form,
      match: {
        params: { appId }
      }
    } = this.props;
    const {
      appInfo,
      isShared,
      isAddLicense,
      tagList,
      imageUrl,
      enterpriseTeamsLoading,
      teamList,
      imageBase64,
      appList,
      toDelete,
      editAppVersion,
      isEdit,
      isAppDetails
    } = this.state;
    const { getFieldDecorator, getFieldValue } = form;
    const formItemLayout = {
      labelCol: {
        xs: { span: 24 },
        sm: { span: 5 }
      },
      wrapperCol: {
        xs: { span: 24 },
        sm: { span: 19 }
      }
    };
    const formItemLayouts = {
      labelCol: {
        xs: { span: 24 },
        sm: { span: 3 }
      },
      wrapperCol: {
        xs: { span: 24 },
        sm: { span: 21 }
      }
    };
    const token = cookie.get('token');
    const controls = [
      'bold',
      'italic',
      'underline',
      'text-color',
      'separator',
      'link',
      'separator'
    ];
    const myheaders = {};
    const arr = [];
    const tagId = [];

    if (
      appInfo &&
      appInfo.tags &&
      appInfo.tags.length > 0 &&
      tagList &&
      tagList.length > 0
    ) {
      appInfo.tags.map(items => {
        arr.push(items.name);
        tagId.push(items.tag_id);
      });
    }

    if (token) {
      myheaders.Authorization = `GRJWT ${token}`;
    }
    const uploadButton = (
      <div>
        <Icon type="plus" />
        <div className="ant-upload-text">上传图标</div>
      </div>
    );
    const defaulAppImg = globalUtil.fetchSvg('defaulAppImg');

    return (
      <div>
        {toDelete && (
          <ConfirmModal
            title="删除应用版本"
            desc="确定要删除应用版本?"
            loading={loading.effects['market/deleteAppVersion']}
            onCancel={this.handleCancelDelete}
            onOk={this.handleDeleteVersion}
          />
        )}
        {editAppVersion && (
          <EditAppVersion
            loading={loading.effects['market/upDataAppVersionInfo']}
            appInfo={editAppVersion}
            onOk={this.upDataAppVersionInfo}
            onCancel={this.handleCloseEditAppVersion}
          />
        )}
        <PageHeaderLayout
          title="应用市场管理"
          content="应用模型是指模型化、标准化的应用制品包，是企业数字资产的应用化产物，可以通过标准的方式安装到任何Rainbond平台或其他支持的云原生平台"
        >
          <Form onSubmit={this.handleSubmit} layout="horizontal">
            <Card
              style={{
                marginBottom: 24
              }}
              bordered={false}
              bodyStyle={{
                padding: 0
              }}
            >
              <div
                style={{
                  padding: '24px'
                }}
              >
                <div
                  style={{
                    textAlign: 'right',
                    margin: '-14px 0 10px 0'
                  }}
                ></div>
                {isEdit && (
                  <Row gutter={24}>
                    <Col span="12">
                      <FormItem {...formItemLayout} label="名称">
                        <div>
                          {getFieldDecorator('name', {
                            initialValue: (appInfo && appInfo.app_name) || '',
                            rules: [
                              {
                                required: true,
                                message: '请输入名称'
                              },
                              {
                                max: 64,
                                message: '最大长度64位'
                              }
                            ]
                          })(<Input placeholder="请输入名称" />)}
                          <div className={styles.conformDesc}>
                            请输入应用模版名称，最多64字.
                          </div>
                        </div>
                      </FormItem>
                    </Col>
                    <Col span="12">
                      <FormItem {...formItemLayout} label="发布范围">
                        {getFieldDecorator('scope', {
                          initialValue:
                            (appInfo && appInfo.scope) || 'enterprise',
                          rules: [
                            {
                              required: true,
                              message: '请输入名称'
                            }
                          ]
                        })(
                          <Select
                            placeholder="请选择发布范围"
                            dropdownRender={menu => (
                              <div>
                                {menu}
                                {isAddLicense && (
                                  <div>
                                    <Divider style={{ margin: '4px 0' }} />
                                    {enterpriseTeamsLoading ? (
                                      <Spin size="small" />
                                    ) : (
                                      <div
                                        style={{
                                          padding: '4px 8px',
                                          cursor: 'pointer'
                                        }}
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => {
                                          this.addTeams();
                                        }}
                                      >
                                        <Icon type="plus" /> 加载更多
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          >
                            <Option value="enterprise" key="enterprise">
                              <div style={{ borderBottom: '1px solid #ccc' }}>
                                当前企业
                              </div>
                            </Option>

                            {teamList &&
                              teamList.map(item => {
                                return (
                                  <Option
                                    key={item.team_name}
                                    value={item.team_name}
                                  >
                                    {item.team_alias}
                                  </Option>
                                );
                              })}
                          </Select>
                        )}
                        <div className={styles.conformDesc}>
                          发布模型的可视范围
                        </div>
                      </FormItem>
                    </Col>
                    <Col span="12">
                      <Form.Item {...formItemLayout} label="分类标签">
                        {getFieldDecorator('tag_ids', {
                          initialValue: arr,
                          rules: [
                            {
                              required: false,
                              message: '请添加标签'
                            }
                          ]
                        })(
                          <Select
                            mode="tags"
                            style={{ width: '100%' }}
                            // onSelect={this.handleOnSelect}
                            tokenSeparators={[',']}
                            placeholder="请选择分类标签"
                          >
                            {tagList.map(item => {
                              const { tag_id, name } = item;
                              return (
                                <Option key={tag_id} value={name} label={name}>
                                  {name}
                                </Option>
                              );
                            })}
                          </Select>
                        )}
                        <div className={styles.conformDesc}>请选择分类标签</div>
                      </Form.Item>
                    </Col>
                    <Col span="12">
                      <FormItem {...formItemLayout} label="简介">
                        {getFieldDecorator('describe', {
                          initialValue: (appInfo && appInfo.describe) || '',
                          rules: [
                            {
                              required: false,
                              message: '请输入简介'
                            },
                            {
                              max: 255,
                              message: '最大长度255位'
                            }
                          ]
                        })(<TextArea placeholder="请输入简介" />)}
                        <div className={styles.conformDesc}>
                          请输入应用模版简介
                        </div>
                      </FormItem>
                    </Col>
                    <Col span="12">
                      <Form.Item {...formItemLayout} label="LOGO">
                        {getFieldDecorator('pic', {
                          initialValue: (appInfo && appInfo.pic) || '',
                          rules: [
                            {
                              required: false,
                              message: '请上传图标'
                            }
                          ]
                        })(
                          <Upload
                            className="logo-uploader"
                            name="file"
                            accept="image/jpg,image/jpeg,image/png"
                            action={apiconfig.imageUploadUrl}
                            listType="picture-card"
                            headers={myheaders}
                            showUploadList={false}
                            onChange={this.handleLogoChange}
                            onRemove={this.handleLogoRemove}
                          >
                            {imageUrl ? (
                              <img
                                src={imageBase64 || imageUrl}
                                alt="LOGO"
                                style={{ width: '100%' }}
                              />
                            ) : (
                              uploadButton
                            )}
                          </Upload>
                        )}
                      </Form.Item>
                    </Col>
                  </Row>
                )}
                {isEdit && (
                  <div style={{ textAlign: 'center' }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={false}
                      disabled={loading.effects['market/upAppModel']}
                      style={{ marginRight: '20px' }}
                      onClick={() => {
                        this.upAppModel(
                          false,
                          false,
                          appInfo && appInfo.details
                        );
                      }}
                    >
                      保存
                    </Button>
                    <Button
                      onClick={() => {
                        this.handleIsEdit(!isEdit);
                      }}
                    >
                      取消
                    </Button>
                  </div>
                )}
                {appInfo && !isEdit && (
                  <div className={styless.appBoxs}>
                    <div>
                      <Icon type="arrow-left" onClick={this.handleCancel} />
                    </div>
                    <div>
                      {imageBase64 || imageUrl ? (
                        <img
                          src={imageBase64 || imageUrl}
                          alt="LOGO"
                          style={{
                            margin: '0 30px',
                            maxWidth: '60px',
                            maxHeight: '60px'
                          }}
                        />
                      ) : (
                        appInfo &&
                        appInfo.app_name && (
                          <div
                            style={{
                              margin: '0 30px'
                            }}
                          >
                            {defaulAppImg}
                          </div>
                        )
                      )}
                    </div>

                    <div style={{ marginRight: '30px' }}>
                      <h3 style={{ marginBottom: '5px' }}>
                        {appInfo.app_name}
                      </h3>
                      <div>{appInfo.describe}</div>
                    </div>
                    <div>
                      {arr.map(item => {
                        return <div className={styless.appVersion}>{item}</div>;
                      })}
                    </div>
                    {!isEdit && (
                      <a
                        onClick={() => {
                          this.handleIsEdit(!isEdit);
                        }}
                      >
                        编辑
                      </a>
                    )}
                  </div>
                )}
              </div>
            </Card>
            <Card
              style={{
                marginBottom: 24
              }}
              title="应用版本管理"
              bordered={false}
              bodyStyle={{
                padding: 0
              }}
            >
              <div
                style={{
                  padding: '24px'
                }}
              >
                <Table
                  dataSource={appList}
                  style={{ width: '100%', overflowX: 'auto' }}
                  columns={[
                    {
                      title: '版本号',
                      dataIndex: 'version',
                      width: '220px',
                      render: (val, data) => {
                        return (
                          <span>
                            {val}({data.version_alias})
                          </span>
                        );
                      }
                    },
                    {
                      title: '状态',
                      dataIndex: 'dev_status',
                      align: 'center',
                      width: '100px',
                      render: val => {
                        return (
                          <div>
                            {val ? (
                              <span className={styless.devStatus}>Release</span>
                            ) : (
                              '-'
                            )}
                          </div>
                        );
                      }
                    },
                    {
                      title: '发布人',
                      dataIndex: 'share_user',
                      align: 'center',
                      width: '150px'
                    },
                    {
                      title: '版本简介',
                      dataIndex: 'app_version_info'
                    },
                    {
                      title: '发布时间',
                      dataIndex: 'create_time',
                      width: '190px',
                      align: 'center',
                      render: val => {
                        return (
                          <span>
                            {moment(val)
                              .locale('zh-cn')
                              .format('YYYY-MM-DD HH:mm:ss')}
                          </span>
                        );
                      }
                    },
                    {
                      title: '更新时间',
                      dataIndex: 'update_time',
                      width: '190px',
                      align: 'center',
                      render: val => {
                        return (
                          <span>
                            {moment(val)
                              .locale('zh-cn')
                              .format('YYYY-MM-DD HH:mm:ss')}
                          </span>
                        );
                      }
                    },
                    {
                      title: '操作',
                      dataIndex: 'action',
                      width: '230px',
                      align: 'center',
                      render: (_data, record) => (
                        <div>
                          <a
                            style={{ marginRight: '5px' }}
                            onClick={() => {
                              this.handleEditAppVersionInfo(record);
                            }}
                          >
                            编辑
                          </a>
                          <a
                            style={{ marginRight: '5px' }}
                            onClick={() => {
                              this.handleIsRelease(record);
                            }}
                          >
                            {record.dev_status
                              ? '取消Release状态'
                              : '设为Release状态'}
                          </a>
                          <a
                            onClick={() => {
                              this.handleToDelete(record);
                            }}
                          >
                            删除
                          </a>
                        </div>
                      )
                    }
                  ]}
                />
              </div>
            </Card>
            <Card
              style={{
                marginBottom: 24
              }}
              title="应用详情"
              bordered={false}
              extra={
                <div>
                  {!isAppDetails && (
                    <a onClick={() => this.handleAppDetails(!isAppDetails)}>
                      编辑
                    </a>
                  )}
                </div>
              }
              bodyStyle={{
                padding: 0
              }}
            >
              <div
                style={{
                  padding: '24px'
                }}
              >
                <Row gutter={24}>
                  {isAppDetails ? (
                    <FormItem
                      labelCol={{ span: 0 }}
                      wrapperCol={{ span: 24 }}
                      label=""
                    >
                      {getFieldDecorator('details', {
                        validateTrigger: 'onBlur',
                        rules: [
                          {
                            required: true,
                            validator: (_, value, callback) => {
                              if (value.isEmpty()) {
                                callback('请输入详情');
                              } else {
                                callback();
                              }
                            }
                          }
                        ]
                      })(
                        <BraftEditor
                          className="my-editor"
                          controls={controls}
                          placeholder="请输入详情"
                        />
                      )}
                    </FormItem>
                  ) : (
                    <div
                      className={detailstyles.markdown}
                      style={{ minHeight: '490px' }}
                      dangerouslySetInnerHTML={{
                        __html: appInfo && appInfo.details
                      }}
                    />
                  )}
                  {isAppDetails && (
                    <div style={{ textAlign: 'center' }}>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={false}
                        disabled={loading.effects['market/upAppModel']}
                        style={{ marginRight: '20px' }}
                        onClick={() => {
                          this.upAppModel(appInfo, tagId);
                        }}
                      >
                        保存
                      </Button>
                      <Button
                        onClick={() => {
                          this.handleAppDetails(!isAppDetails);
                        }}
                      >
                        取消
                      </Button>
                    </div>
                  )}
                </Row>
              </div>
            </Card>
          </Form>
        </PageHeaderLayout>
      </div>
    );
  }
}
