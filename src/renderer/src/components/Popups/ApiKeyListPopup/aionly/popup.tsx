import { loggerService } from '@logger'
import { addApikey, changeApikeyStatus, deleteApikeyById, getApikeyList, updateApikey } from '@renderer/api/apikey'
import { TopView } from '@renderer/components/TopView'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { updateProvider } from '@renderer/store/llm'
import { maskApiKey } from '@renderer/utils'
import { formatApiKeys, splitApiKeyString } from '@renderer/utils/api'
import { Modal, Pagination, Select, Spin, Switch, Tooltip, Typography } from 'antd'
import { Check, KeyRound, Pencil, Plus, Search, TriangleAlert, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AddBtn,
  EmptyState,
  FooterBar,
  GlassRoot,
  Grid,
  HeadRow,
  KeyCard,
  ListBody,
  OpBtn,
  StatsRow,
  ToolRow,
  WarnBar
} from './popup.styles'

const logger = loggerService.withContext('AiOnlyApiKeyListPopup')

/** 能力降级标记：老网关无 changeStatus 路由（404/405）时隐藏状态开关 */
const STATUS_SUPPORT_KEY = 'apikey.status.support'

/** 状态归一化：仅 '0' 视为禁用，null/undefined/'1' 均视为启用（兼容历史数据） */
const isEnabled = (row: any) => row?.status !== '0'

/** 状态过滤维度 */
type StatusFilter = 'all' | 'on' | 'off' | 'inuse'
/** 排序维度：名称 / 创建时间倒序 */
type SortBy = 'name' | 'created'

interface Props {
  resolve: (value: any) => void
  providerId?: string
}

/**
 * API Key 列表弹窗容器组件
 * （V3 精致玻璃卡片 · 第二轮 200 Key 规模重设计：统计条 + 搜索 + 状态胶囊过滤 + 排序 + 双列卡片网格 + 分页）
 * 视觉稿：docs/APIKey禁启用适配与样式重设计/样式方案V3-玻璃拟态卡片.html
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
  // 状态开关请求中的行 id（全局互斥，避免并发变更）
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null)
  // changeStatus 能力探测（懒探测 + 本地持久化降级）
  const [supportStatus, setSupportStatus] = useState(() => {
    try {
      return localStorage.getItem(STATUS_SUPPORT_KEY) !== '0'
    } catch {
      return true
    }
  })
  // 200 Key 规模查找能力：搜索 / 状态过滤 / 排序 / 分页（纯客户端，数据一次性拉取）
  const [searchQ, setSearchQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)

  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

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

  const isInUse = (row: any) => !!row?.apikey && currentKeys.includes(row.apikey)

  /** 使用中且已被控制台禁用的密钥（顶部告警条数据源） */
  const disabledInUseRow = useMemo(
    () => apiKeyList.find((r) => r.apikey && currentKeys.includes(r.apikey) && r.status === '0'),
    [apiKeyList, currentKeys]
  )

  /** 一键切换候选：首个启用中且未被使用的密钥 */
  const switchCandidate = useMemo(
    () => apiKeyList.find((r) => r.apikey && isEnabled(r) && !currentKeys.includes(r.apikey)),
    [apiKeyList, currentKeys]
  )

  /** 统计条数据（不含未保存的新增行） */
  const stats = useMemo(() => {
    const realRows = apiKeyList.filter((r) => !r.isNew)
    const total = realRows.length
    const on = realRows.filter(isEnabled).length
    return { total, on, off: total - on, inUse: realRows.filter(isInUse).length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyList, currentKeys])

  /** 搜索 + 状态过滤 + 排序后的完整结果集（编辑中的行始终保留可见；使用中密钥置顶，其余按排序维度排列） */
  const filteredList = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    let arr = apiKeyList.filter((r) => {
      if (statusFilter === 'on' && !isEnabled(r)) return false
      if (statusFilter === 'off' && (r.isNew || isEnabled(r))) return false
      if (statusFilter === 'inuse' && !isInUse(r)) return false
      if (q) {
        const hay = [r.appname, r.apikey, r.apikey ? maskApiKey(r.apikey) : '', r.keyType]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    arr = [...arr].sort((a, b) => {
      if (!!a.isNew !== !!b.isNew) return a.isNew ? -1 : 1
      // 使用中的密钥置顶，其余按原有排序规则
      const aInUse = isInUse(a)
      const bInUse = isInUse(b)
      if (aInUse !== bInUse) return aInUse ? -1 : 1
      if (sortBy === 'created') {
        return (
          String(b.createTime || '').localeCompare(String(a.createTime || '')) ||
          String(b.id).localeCompare(String(a.id))
        )
      }
      return String(a.appname || '').localeCompare(String(b.appname || ''))
    })
    if (editingId) {
      const editingRow = apiKeyList.find((r) => r.id === editingId)
      if (editingRow && !arr.some((r) => r.id === editingId)) {
        arr = [editingRow, ...arr]
      }
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyList, statusFilter, searchQ, sortBy, editingId, currentKeys])

  const pageCount = Math.max(1, Math.ceil(filteredList.length / pageSize))
  const curPage = Math.min(page, pageCount)
  const pageRows = useMemo(
    () => filteredList.slice((curPage - 1) * pageSize, curPage * pageSize),
    [filteredList, curPage, pageSize]
  )

  // 翻页 / 过滤变化时列表回到顶部
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 })
  }, [curPage, pageSize, statusFilter, searchQ, sortBy])

  // '/' 快捷键聚焦搜索框（输入态与编辑态不抢占）
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !editingId) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, editingId])

  let timer: any = null

  const resetFilters = () => {
    setSearchQ('')
    setStatusFilter('all')
    setSortBy('name')
    setPage(1)
  }

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
    // 需保留原记录中的 apikey/status 等字段，否则更新接口会将 key 清空
    const params = { ...record }
    delete params.isEditing
    delete params.isNew
    params.appname = editingData.appname
    const res = await updateApikey(params)
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

  const handleDelete = (record: any) => {
    if (currentKeys.includes(record?.apikey)) {
      window.toast.warning(t('settings.provider.api.key.list.in_use_delete_tip'))
      return
    }
    Modal.confirm({
      title: t('common.delete_confirm'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      centered: true,
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

  // 点击密钥直接切换为当前供应商使用的密钥（已禁用密钥不可使用）
  const handleUseKey = (record: any) => {
    if (!record?.apikey) {
      return
    }
    if (!isEnabled(record)) {
      window.toast.warning(t('settings.provider.api.key.list.disabled_use_tip'))
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

  /** 状态开关入口：禁用需二次确认（使用中升级为强警告），启用直接执行 */
  const handleToggleStatus = (record: any, checked: boolean) => {
    if (statusLoadingId || editingId) {
      return
    }
    if (checked) {
      doChangeStatus(record, '1')
      return
    }
    const inUse = isInUse(record)
    Modal.confirm({
      title: inUse
        ? t('settings.provider.api.key.list.disable_confirm_title_in_use')
        : t('settings.provider.api.key.list.disable_confirm_title'),
      content: inUse
        ? t('settings.provider.api.key.list.disable_confirm_content_in_use')
        : t('settings.provider.api.key.list.disable_confirm_content'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      centered: true,
      onOk: () => doChangeStatus(record, '0')
    })
  }

  const doChangeStatus = async (record: any, status: '0' | '1') => {
    const started = Date.now()
    setStatusLoadingId(String(record.id))
    try {
      await changeApikeyStatus({ id: record.id, status })
      logger.info('status.change.success', { id: record.id, status, duration: Date.now() - started })
      try {
        localStorage.setItem(STATUS_SUPPORT_KEY, '1')
      } catch {
        // ignore
      }
      window.toast.success(
        status === '0'
          ? t('settings.provider.api.key.list.disable_success')
          : t('settings.provider.api.key.list.enable_success')
      )
      await fetchData()
    } catch (error: any) {
      const httpStatus = error?.response?.status
      // 老网关无 changeStatus 路由 → 能力降级，隐藏状态开关
      if (httpStatus === 404 || httpStatus === 405) {
        logger.warn('status.change.degraded', { id: record.id, status: httpStatus })
        setSupportStatus(false)
        try {
          localStorage.setItem(STATUS_SUPPORT_KEY, '0')
        } catch {
          // ignore
        }
        return
      }
      // 业务失败：响应拦截器 reject 服务端 msg（string）→ toast + 刷新对齐服务端
      const bizMsg = typeof error === 'string' ? error : undefined
      logger.error('status.change.failed', { id: record.id, status, msg: bizMsg || error?.message })
      window.toast.error(
        t('settings.provider.api.key.list.status_change_failed', { msg: bizMsg || error?.message || '' })
      )
      if (bizMsg) {
        await fetchData()
      }
    } finally {
      setStatusLoadingId(null)
    }
  }

  /** 告警条一键切换：切到首个启用中的密钥 */
  const handleSwitchToEnabled = () => {
    if (switchCandidate) {
      handleUseKey(switchCandidate)
    }
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

    // 重置过滤条件，确保新增卡片在第一页可见
    setSearchQ('')
    setStatusFilter('all')
    setPage(1)

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

  const renderCard = (row: any) => {
    const isCurrent = isInUse(row)
    const enabled = isEnabled(row)
    const cardClass = [!row.isNew && !enabled ? 'disabled' : '', isCurrent ? 'inuse' : ''].filter(Boolean).join(' ')

    return (
      <KeyCard key={row.id} className={cardClass}>
        <div className="c1">
          <div className="ava">
            <KeyRound size={16} strokeWidth={2} className="lucide-custom" />
          </div>
          <div className="cn">
            {row.isEditing ? (
              <input
                className="edit-input"
                autoFocus
                value={editingData.appname}
                placeholder={t('settings.provider.api.key.new_key.name_placeholder')}
                onChange={(e) => setEditingData({ ...editingData, appname: e.target.value })}
                style={{
                  width: '100%',
                  border: '1px solid var(--ak-card-brd)',
                  borderRadius: 9,
                  background: 'var(--ak-glass-2)',
                  color: 'var(--color-text)',
                  fontSize: 12.5,
                  padding: '4px 9px',
                  outline: 'none'
                }}
              />
            ) : (
              <>
                <div className="t">{row.appname || '-'}</div>
                <div className="s">
                  {!row.isNew && row.keyType && <span className="tag">{row.keyType}</span>}
                  {isCurrent && <span className="inuse">{t('settings.provider.api.key.list.in_use')}</span>}
                </div>
              </>
            )}
          </div>
          {supportStatus && !row.isNew && !row.isEditing && (
            <Switch
              size="small"
              checked={enabled}
              loading={statusLoadingId === String(row.id)}
              disabled={statusLoadingId !== null || !!editingId}
              onChange={(checked) => handleToggleStatus(row, checked)}
            />
          )}
        </div>

        <div className="c2">
          {row.isNew || !row.apikey ? (
            <span className="mono">-</span>
          ) : (
            <>
              <span className={enabled ? 'mono' : 'mono strike'}>{maskApiKey(row.apikey)}</span>
              <Typography.Text className="copy-ctl" copyable={{ text: row.apikey, tooltips: false }} />
            </>
          )}
        </div>

        <div className="c3">
          {row.isEditing ? (
            <div className="ops">
              <OpBtn className="primary" disabled={addLoading} onClick={() => handleConfirm(row)}>
                <Check size={13} />
                {t('settings.provider.api.key.new_key.confirm')}
              </OpBtn>
              <OpBtn onClick={() => handleCancelEdit(row)}>
                <X size={13} />
                {t('settings.provider.api.key.new_key.cancel')}
              </OpBtn>
            </div>
          ) : (
            <>
              {supportStatus && !row.isNew && (
                <span className={enabled ? 'st on' : 'st off'}>
                  {enabled
                    ? t('settings.provider.api.key.list.status_enabled')
                    : t('settings.provider.api.key.list.status_disabled')}
                </span>
              )}
              <span className="sp" />
              <div className="ops">
                {providerId && !isCurrent && (
                  <Tooltip title={!enabled ? t('settings.provider.api.key.list.disabled_use_tip') : undefined}>
                    <OpBtn disabled={!enabled} onClick={() => handleUseKey(row)}>
                      {t('settings.provider.api.key.list.use')}
                    </OpBtn>
                  </Tooltip>
                )}
                <Tooltip title={t('common.edit')}>
                  <OpBtn onClick={() => handleEdit(row)}>
                    <Pencil size={12} />
                  </OpBtn>
                </Tooltip>
                {isCurrent ? (
                  <Tooltip title={t('settings.provider.api.key.list.in_use_delete_tip')}>
                    <OpBtn className="danger" disabled>
                      <X size={13} />
                    </OpBtn>
                  </Tooltip>
                ) : (
                  <Tooltip title={t('common.delete')}>
                    <OpBtn className="danger" onClick={() => handleDelete(row)}>
                      <X size={13} />
                    </OpBtn>
                  </Tooltip>
                )}
              </div>
            </>
          )}
        </div>
      </KeyCard>
    )
  }

  const hasKeys = apiKeyList.length > 0
  const noMatch = !loading && hasKeys && filteredList.length === 0

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      afterClose={onClose}
      transitionName="animation-move-down"
      centered
      width={900}
      closable={false}
      footer={null}
      styles={{ content: { padding: 0, borderRadius: 14, overflow: 'hidden' } }}>
      <GlassRoot>
        <HeadRow>
          <div className="orb">
            <KeyRound size={20} strokeWidth={1.9} className="lucide-custom" />
          </div>
          <div className="titles">
            <h3>{t('settings.provider.api.key.list.title')}</h3>
            <div className="quota">
              {t('settings.provider.api.key.list.quota_tip', {
                created: query.current.total,
                max: query.current.pageSize
              })}
            </div>
          </div>
          <button className="close" onClick={onCancel} aria-label={t('common.close')}>
            <X size={15} />
          </button>
        </HeadRow>

        {disabledInUseRow && (
          <WarnBar>
            <span className="warn-icon">
              <TriangleAlert size={14} />
            </span>
            <span className="warn-text">
              {t('settings.provider.api.key.list.in_use_disabled_alert', { name: disabledInUseRow.appname })}
            </span>
            {providerId && switchCandidate && (
              <button className="warn-action" onClick={handleSwitchToEnabled}>
                {t('settings.provider.api.key.list.switch_to_enabled')}
              </button>
            )}
          </WarnBar>
        )}

        {hasKeys && (
          <StatsRow>
            {(
              [
                ['all', stats.total, 'stat_total', 'p'],
                ['on', stats.on, 'status_enabled', 'g'],
                ['off', stats.off, 'status_disabled', ''],
                ['inuse', stats.inUse, 'in_use', 'a']
              ] as [StatusFilter, number, string, string][]
            ).map(([st, count, labelKey, tone]) => (
              <button
                key={st}
                type="button"
                className={['stat', tone, statusFilter === st ? 'act' : ''].filter(Boolean).join(' ')}
                onClick={() => {
                  setStatusFilter(st)
                  setPage(1)
                }}>
                <span className="n">{count}</span>
                <span className="l">{t(`settings.provider.api.key.list.${labelKey}`)}</span>
              </button>
            ))}
          </StatsRow>
        )}

        {hasKeys && (
          <ToolRow>
            <div className="search">
              <span className="sic">
                <Search size={13} />
              </span>
              <input
                ref={searchRef}
                value={searchQ}
                placeholder={t('settings.provider.api.key.list.search_placeholder')}
                onChange={(e) => {
                  setSearchQ(e.target.value)
                  setPage(1)
                }}
              />
              {searchQ && (
                <button
                  className="clr"
                  aria-label={t('common.close')}
                  onClick={() => {
                    setSearchQ('')
                    searchRef.current?.focus()
                  }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <Select<SortBy>
              className="sortsel"
              value={sortBy}
              onChange={(v) => {
                setSortBy(v)
                setPage(1)
              }}
              options={[
                { value: 'name', label: t('settings.provider.api.key.list.sort_name') },
                { value: 'created', label: t('settings.provider.api.key.list.sort_created') }
              ]}
            />
            <AddBtn
              onClick={handleAdd}
              disabled={addLoading || !!editingId || !showAdd}
              title={showAdd ? undefined : t('settings.provider.api_key.max_tip')}>
              <Plus size={14} strokeWidth={2.4} className="lucide-custom" />
              {t('common.add')}
            </AddBtn>
          </ToolRow>
        )}

        <Spin spinning={loading}>
          <ListBody ref={listRef}>
            {!loading && !hasKeys ? (
              <EmptyState>
                <div className="empty-icon">
                  <KeyRound size={24} strokeWidth={1.8} />
                </div>
                <div className="empty-text">{t('settings.provider.api.key.list.empty')}</div>
                {showAdd && (
                  <button className="empty-reset" onClick={handleAdd}>
                    <Plus size={13} strokeWidth={2.4} /> {t('common.add')}
                  </button>
                )}
              </EmptyState>
            ) : noMatch ? (
              <EmptyState>
                <div className="empty-icon">
                  <Search size={22} strokeWidth={1.8} />
                </div>
                <div className="empty-text">{t('settings.provider.api.key.list.no_match')}</div>
                <button className="empty-reset" onClick={resetFilters}>
                  {t('settings.provider.api.key.list.reset_filters')}
                </button>
              </EmptyState>
            ) : (
              <Grid>{pageRows.map(renderCard)}</Grid>
            )}
          </ListBody>
        </Spin>

        <FooterBar>
          {!showAdd && hasKeys && <div className="maxtip">（{t('settings.provider.api_key.max_tip')}）</div>}
          {filteredList.length > 0 && (
            <Pagination
              size="small"
              current={curPage}
              pageSize={pageSize}
              total={filteredList.length}
              showSizeChanger
              pageSizeOptions={['12', '24', '48']}
              showTotal={(total, range) =>
                t('settings.provider.api.key.list.range_info', { from: range[0], to: range[1], total })
              }
              onChange={(p, ps) => {
                setPage(p)
                setPageSize(ps)
              }}
            />
          )}
        </FooterBar>
      </GlassRoot>
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
