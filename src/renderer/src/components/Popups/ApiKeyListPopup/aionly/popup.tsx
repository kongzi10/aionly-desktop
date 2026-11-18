import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { addApikey, deleteApikeyById, getApikeyList, updateApikey } from '@renderer/api/apikey'
import { TopView } from '@renderer/components/TopView'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { updateProvider } from '@renderer/store/llm'
import { maskApiKey } from '@renderer/utils'
import { formatApiKeys, splitApiKeyString } from '@renderer/utils/api'
import type { TableProps } from 'antd'
import { Button, Divider, Flex, Input, Modal, Table, Tag, Tooltip, Typography } from 'antd'
import { Check, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  resolve: (value: any) => void
  providerId?: string
}

/**
 * API Key 列表弹窗容器组件
 */
const PopupContainer: React.FC<Props> = ({ resolve, providerId }) => {
  const [open, setOpen] = useState(true)
  const [apiKeyList, setApiKeyList] = useState<any[]>([])
  const [addLoading, setAddLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<{ appname: string }>({ appname: '' })
  const [originalData, setOriginalData] = useState<{ appname: string }>({ appname: '' })

  const query = useRef({
    pageNum: 1,
    pageSize: 200,
    total: 0,
    appname: '',
    keyType: ''
  })

  const apikeyForm = useRef({
    id: '',
    keyType: '标准模式',
    appname: '',
    apikey: '',
    remark: '',
    createTime: '',
    description: '',
    modelId: '',
    componentIds: [],
    knowledgeFlag: 1,
    knowledgeId: '',
    knowledgeReturn: 10,
    milvusType: '',
    promptVal: ''
  })

  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const currentApiKey = useAppSelector((state) => state.llm.providers.find((p) => p.id === providerId)?.apiKey)

  const currentKeys = useMemo(() => {
    if (!currentApiKey) return []
    return Array.from(new Set(splitApiKeyString(formatApiKeys(currentApiKey))))
  }, [currentApiKey])

  let timer: any = null

  const columns: TableProps<any>['columns'] = [
    {
      title: '名称',
      dataIndex: 'appname',
      key: 'appname',
      render: (text, record) => {
        if (record.isEditing) {
          return (
            <Input
              value={editingData.appname}
              autoFocus={true}
              placeholder={t('settings.provider.api.key.new_key.name_placeholder')}
              onChange={(e) => setEditingData({ ...editingData, appname: e.target.value })}
            />
          )
        }
        return text
      }
    },
    {
      title: 'API KEY',
      dataIndex: 'apikey',
      key: 'apikey',
      render: (text, record) => {
        if (record.isEditing && record.isNew) {
          return '-'
        }
        const isCurrent = currentKeys.includes(text)
        return (
          <Flex align="center" gap={6}>
            <Typography.Text style={{ color: 'blue' }} copyable={{ text }}>
              {maskApiKey(text)}
            </Typography.Text>
            {isCurrent && (
              <Tag color="success" bordered={false}>
                {t('settings.provider.api.key.list.in_use')}
              </Tag>
            )}
          </Flex>
        )
      }
    },
    {
      title: `${t('settings.translate.custom.table.action.title')}`,
      key: 'action',
      align: 'center',
      render: (_, record) => (
        <>
          {record.isEditing ? (
            <Flex align="center" gap={10} justify="center">
              <Tooltip title={t('settings.provider.api.key.new_key.confirm')}>
                <Button icon={<Check size={14} />} onClick={() => handleConfirm(record)} loading={addLoading} />
              </Tooltip>
              <Tooltip title={t('settings.provider.api.key.new_key.cancel')}>
                <Button icon={<X size={14} />} onClick={() => handleCancelEdit(record)} />
              </Tooltip>
            </Flex>
          ) : (
            <>
              {providerId && !currentKeys.includes(record.apikey) && (
                <>
                  <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleUseKey(record)}>
                    {t('settings.provider.api.key.list.use')}
                  </Button>
                  <Divider type="vertical" />
                </>
              )}
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
              <Divider type="vertical" />
              <DeleteOutlined style={{ fontSize: '16px', color: 'red' }} onClick={() => handleDelete(record)} />
            </>
          )}
        </>
      )
    }
  ]

  const handleEdit = (record: any) => {
    // 检查是否已有编辑中的行
    if (editingId) {
      window.toast.warning(t('settings.provider.api.key.new_key.editing_tip'))
      return
    }

    // 设置当前行为编辑状态
    const newList = apiKeyList.map((item) => ({
      ...item,
      isEditing: item.id === record.id
    }))
    setApiKeyList(newList)
    setEditingId(record.id)
    setEditingData({
      appname: record.appname
    })
    setOriginalData({
      appname: record.appname
    })
  }

  const handleCancelEdit = (record: any) => {
    if (record.isNew) {
      // 如果是新增行，直接删除
      setApiKeyList(apiKeyList.filter((item) => item.id !== record.id))
    } else {
      // 如果是编辑行，恢复原状态
      setApiKeyList(apiKeyList.map((item) => (item.id === record.id ? { ...item, isEditing: false } : item)))
    }
    setEditingId(null)
    setEditingData({ appname: '' })
  }

  // 新增
  const fetchApiKeyAdd = async () => {
    apikeyForm.current.appname = editingData.appname
    const res = await addApikey(apikeyForm.current)
    if (res.code === 200) {
      window.toast.success(t('common.add_success'))
      await fetchData()
    }
  }

  // 编辑
  const fetchApiKeyEdit = async (record: any) => {
    apikeyForm.current.appname = editingData.appname
    apikeyForm.current.id = record.id
    const res = await updateApikey(apikeyForm.current)
    if (res.code === 200) {
      window.toast.success(t('common.save_success'))
      await fetchData()
    }
  }

  // 保存确认
  const handleConfirm = async (record: any) => {
    if (!editingData.appname.trim()) {
      window.toast.error(t('settings.provider.api.key.new_key.name_placeholder'))
      return
    }

    setAddLoading(true)

    try {
      if (record.isNew) {
        await fetchApiKeyAdd()
        await fetchData()
      } else {
        // 检查是否有修改，没修改就不调接口
        if (editingData.appname === originalData.appname) {
          // 没有修改，直接退出编辑状态
          setApiKeyList(apiKeyList.map((item) => (item.id === record.id ? { ...item, isEditing: false } : item)))
        } else {
          // 有修改，调用更新接口
          await fetchApiKeyEdit(record)
          await fetchData()
        }
      }
      setEditingId(null)
      setEditingData({ appname: '' })
      setOriginalData({ appname: '' })
    } catch (error) {
      throw error
    } finally {
      setAddLoading(false)
    }
  }

  const handleDelete = (record) => {
    Modal.confirm({
      title: t('common.delete_confirm'),
      onOk: () => {
        toDel(record)
      }
    })
  }

  const toDel = async (record: any) => {
    const res = await deleteApikeyById({ id: record?.id })
    if (res.code === 200) {
      window.toast.success(t('common.delete_success'))
    }
    await fetchData()
  }

  // 点击密钥直接切换为当前供应商使用的密钥
  const handleUseKey = (record: any) => {
    if (!record?.apikey) {
      return
    }
    if (!providerId) {
      window.toast.warning(t('settings.provider.api.key.list.use_no_provider'))
      return
    }
    if (currentKeys.length === 1 && currentKeys[0] === record.apikey) {
      window.toast.info(t('settings.provider.api.key.list.already_in_use'))
      return
    }
    dispatch(updateProvider({ id: providerId, apiKey: record.apikey }))
    window.toast.success(t('settings.provider.api.key.list.switch_success', { name: record.appname }))
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getApikeyList(query.current)
      setApiKeyList(res.rows)
      query.current.total = res.total
      setShowAdd(res.total < query.current.pageSize)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAdd = () => {
    if (apiKeyList.length >= query.current.pageSize) {
      setShowAdd(false)
      return
    }

    // 检查是否已有编辑中的行
    if (editingId) {
      window.toast.warning(t('settings.provider.api.key.new_key.editing_tip'))
      return
    }

    const newRow = {
      id: `new_${Date.now()}`,
      appname: '',
      apikey: '',
      isEditing: true,
      isNew: true
    }
    setApiKeyList([newRow, ...apiKeyList])
    setEditingId(newRow.id)
    setEditingData({ appname: '' })
  }

  const onCancel = () => {
    setOpen(false)
    timer && clearTimeout(timer)
    timer = null
  }

  const onClose = () => {
    resolve(null)
  }

  const Footer = showAdd ? (
    <Button size="large" type="primary" onClick={handleAdd} icon={<PlusOutlined />} block={true} loading={addLoading}>
      {t('common.add')}
    </Button>
  ) : (
    <Typography.Text type="warning" style={{ fontSize: 12, padding: 0 }}>
      （{t('settings.provider.api_key.max_tip')}）
    </Typography.Text>
  )

  return (
    <Modal
      title={t('settings.provider.api.key.list.title')}
      open={open}
      onCancel={onCancel}
      afterClose={onClose}
      transitionName="animation-move-down"
      centered
      width={600}
      footer={Footer}>
      <Table
        className="apikey-list-table"
        rowClassName={(record) => (currentKeys.includes(record.apikey) ? 'apikey-row-in-use' : '')}
        dataSource={apiKeyList}
        columns={columns}
        pagination={false}
        loading={loading}
        rowKey="id"
      />
    </Modal>
  )
}

const TopViewKey = 'ApiKeyListPopup'

export default class ApiKeyListPopup {
  static topviewId = 0

  static hide() {
    TopView.hide(TopViewKey)
  }

  static show(providerId?: string) {
    return new Promise<any>((resolve) => {
      TopView.show(
        <PopupContainer
          providerId={providerId}
          resolve={(v) => {
            resolve(v)
            TopView.hide(TopViewKey)
          }}
        />,
        TopViewKey
      )
    })
  }
}
