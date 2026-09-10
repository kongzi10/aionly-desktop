import { getIndexTokenPlanPageListApi } from '@renderer/api/balance'
import { TopView } from '@renderer/components/TopView'
import { useProvider } from '@renderer/hooks/useProvider'
import useUserTokenPlan from '@renderer/hooks/useUserTokenPlan'
import { useAppSelector } from '@renderer/store'
import { selectUserInfo } from '@renderer/store/user'
import { LOCAL_USER_SECRET_KEY } from '@shared/config/constant'
import type { TableProps } from 'antd'
import { Input, Modal, Progress, Select, Switch, Table } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  resolve: (value: any) => void
}

/**
 * API Key 列表弹窗容器组件
 */
const PopupContainer: React.FC<Props> = ({ resolve }) => {
  const [open, setOpen] = useState(true)
  const [tokenPlanList, setTokenPlanList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const userInfo: any = useAppSelector(selectUserInfo)
  const { getUserEnabledPlan, setUserEnabledPlan, clearUserEnabledPlan } = useUserTokenPlan(userInfo.userId)
  const { updateProvider } = useProvider('aionly')

  // 当前启用的套餐（全局唯一，持久化到 localStorage）
  const [enabledPlan, setEnabledPlan] = useState<any>(() => getUserEnabledPlan())

  const { t } = useTranslation()

  // 查询条件（驱动 UI，必须用 state）
  const [queryParams, setQueryParams] = useState<any>({
    pageNum: 1,
    pageSize: 10,
    planName: '',
    status: 2
  })

  // 输入框的即时值，防抖后再同步到 queryParams
  const [total, setTotal] = useState(0)

  // 分页配置
  const pagination = {
    current: queryParams.pageNum,
    pageSize: queryParams.pageSize,
    total: total,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => `${t('common.pagination.total', { total })}`,
    onChange: (page: number, pageSize: number) => {
      setQueryParams((prev) => ({ ...prev, pageNum: page, pageSize }))
    }
  }

  const timerRef = useRef<any>(null)

  const mapPriceType = (record: any) => {
    if (record.priceType == 'custom' && record.customDay) {
      return `${record.customDay || '--'}${t('settings.provider.api_key.token_plan.custom')}`
    } else if (record.priceType != 'custom') {
      const text = `settings.provider.api_key.token_plan.${record.priceType}`
      return t(text)
    } else {
      return '--'
    }
  }

  const getUsagePercent = (record: any) => {
    const { creditsRest, creditsTotal, status, paymentStatus } = record
    if (status == 3 || paymentStatus == '1') return 0
    const safeTotal = Number(creditsTotal) || 0
    const safeRest = Number(creditsRest) || 0
    if (!safeTotal) return 0
    // 计算剩余额度百分比：剩余额度 / 总额度 * 100
    // 保留两位小数以提高精度
    const percent = (safeRest / safeTotal) * 100
    return Math.max(0, Math.min(Math.round(percent * 100) / 100, 100))
  }

  // 启用/禁用套餐--存储逻辑
  const onChangeEnabled = (record: any, checked: boolean) => {
    if (checked) {
      window.modal.confirm({
        title: t('settings.provider.api_key.token_plan.confirm_enable_title'),
        content: <TipText>{t('settings.provider.api_key.token_plan.confirm_enable_content')}</TipText>,
        onOk: () => {
          setEnabledPlan(record)
          setUserEnabledPlan(record)
          // 同步 aionly provider 的 apiKey，保证 agents/主进程侧使用当前套餐的 key
          if (record.apikey) {
            updateProvider({ apiKey: record.apikey })
          }
          resolve({
            ...record,
            enabled: true
          })
        }
      })
    } else {
      window.modal.confirm({
        title: t('settings.provider.api_key.token_plan.confirm_disable_title'),
        content: <TipText>{t('settings.provider.api_key.token_plan.confirm_disable_content')}</TipText>,
        onOk: () => {
          setEnabledPlan(null)
          clearUserEnabledPlan()
          // 禁用套餐后回退到用户基础 apiKey（与登录流程 saveUserInfo 的逻辑保持一致）
          updateProvider({ apiKey: localStorage.getItem(LOCAL_USER_SECRET_KEY) ?? '' })
          resolve({
            ...record,
            enabled: false
          })
        }
      })
    }
  }

  const columns: TableProps<any>['columns'] = [
    {
      title: t('settings.provider.api_key.token_plan.columns.planName'),
      dataIndex: 'planName',
      key: 'planName',
      width: 140,
      render: (text, record) => {
        return (
          <ColumNameCell>
            <div className="name">{text}</div>
            <div className="tag-classify">{record.classifyName || '--'}</div>
          </ColumNameCell>
        )
      }
    },
    {
      title: t('settings.provider.api_key.token_plan.columns.totalAmount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 100,
      align: 'center',
      render: (text, record) => {
        return (
          <div className="total-amount">
            <b className="price-type" style={{ color: 'var(--color-error)' }}>
              {t('settings.provider.api_key.token_plan.price_type')}
              {text}
            </b>
            /{mapPriceType(record)}
          </div>
        )
      }
    },
    {
      title: t('settings.provider.api_key.token_plan.columns.status'),
      key: 'status',
      align: 'center',
      width: 100,
      render: (_, record: any) => (
        <ColumStatusCell>
          {/*待付款*/}
          {record.status == 1 && (
            <span className="status wait-pay">{t('settings.provider.api_key.token_plan.status.wait_pay')}</span>
          )}
          {/*生效中*/}
          {record.status == 2 && (
            <span className="status enabled">{t('settings.provider.api_key.token_plan.status.enabled')}</span>
          )}
          {/*已失效*/}
          {record.status == 3 && (
            <span className="status disabled">{t('settings.provider.api_key.token_plan.status.disabled')}</span>
          )}
        </ColumStatusCell>
      )
    },
    {
      title: t('settings.provider.api_key.token_plan.columns.creditsRest'),
      key: 'creditsRest',
      align: 'center',
      width: 120,
      render: (_, record) => (
        <ColumCreditsRestCell>
          <Progress
            percent={getUsagePercent(record)}
            status="normal"
            size="small"
            showInfo={false}
            style={{ width: '100%', maxWidth: 160 }}
          />
          <div className="usage-text">
            {t('settings.provider.api_key.token_plan.remaining')}
            {record.paymentStatus == '1' ? 0 : record.creditsRest || 0}/
            {t('settings.provider.api_key.token_plan.total')}
            {record.paymentStatus == '1' ? 0 : record.creditsTotal || 0}
          </div>
        </ColumCreditsRestCell>
      )
    },
    {
      title: t('settings.provider.api_key.token_plan.columns.effective'),
      key: 'effective',
      align: 'center',
      render: (_, record) => (
        <ColumEffectiveCell>
          {record.effectiveStartTime || record.effectiveEndTime ? (
            <>
              <div className="date-row num">
                <span className="date-tag start">{t('settings.provider.api_key.token_plan.effective_s')}</span>
                {record.paymentStatus == '2' ? record.effectiveStartTime || '--' : '--'}
              </div>
              <div className="date-row num">
                <span className="date-tag end">{t('settings.provider.api_key.token_plan.effective_e')}</span>
                {record.paymentStatus === '2' ? record.effectiveEndTime || '--' : '--'}
              </div>
            </>
          ) : (
            '--'
          )}
        </ColumEffectiveCell>
      )
    },
    {
      title: t('settings.provider.api_key.token_plan.columns.action'),
      key: 'action',
      align: 'center',
      width: 80,
      render: (_, record) => {
        return record.status == 2 ? (
          <Switch checked={enabledPlan?.id === record.id} onChange={(checked) => onChangeEnabled(record, checked)} />
        ) : null
      }
    }
  ]

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getIndexTokenPlanPageListApi(queryParams)
      const list = res?.rows || []
      setTokenPlanList(list)
      setTotal(res?.total || 0)
    } finally {
      setLoading(false)
    }
  }

  // 查询条件变化（含首次挂载）时重新拉取数据
  useEffect(() => {
    fetchData().then()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams])

  const changePlanName = (e: any) => {
    const planName = e.target.value || ''
    // 防抖 300ms，避免每次输入都请求
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setQueryParams((prev: any) => ({ ...prev, planName, pageNum: 1 }))
    }, 300)
  }

  const changeStatus = (val?: number) => {
    setQueryParams((prev: any) => ({ ...prev, status: val || undefined, pageNum: 1 }))
  }

  const onCancel = () => {
    setOpen(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const onClose = () => {
    resolve(null)
  }

  return (
    <StyledModal
      title={t('settings.provider.api_key.token_plan.model_title')}
      open={open}
      onCancel={onCancel}
      afterClose={onClose}
      transitionName="animation-move-down"
      centered
      width="80%"
      footer={null}>
      <SearchContainer>
        <Input
          value={queryParams.planName}
          placeholder={t('settings.provider.api_key.token_plan.search.planName')}
          allowClear={true}
          onChange={changePlanName}
          className="popup-input"
        />
        <Select
          value={queryParams.status}
          options={[
            { label: t('settings.provider.api_key.token_plan.status.enabled'), value: 2 },
            { label: t('settings.provider.api_key.token_plan.status.disabled'), value: 3 }
            // { label: t('settings.provider.api_key.token_plan.status.wait_pay'), value: '1' },
          ]}
          placeholder={t('settings.provider.api_key.token_plan.search.status_placeholder')}
          allowClear={true}
          onChange={changeStatus}
          className="popup-select"
        />
      </SearchContainer>
      <Table
        size="small"
        dataSource={tokenPlanList}
        columns={columns}
        pagination={pagination}
        loading={loading}
        rowKey="id"
        scroll={{ y: `calc(100vh - 310px)` }}
      />
    </StyledModal>
  )
}

const TopViewKey = 'TokenPlanPopup'

export default class TokenPlanPopup {
  static topviewId = 0

  static hide() {
    TopView.hide(TopViewKey)
  }

  static show() {
    return new Promise<any>((resolve) => {
      TopView.show(
        <PopupContainer
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

const ColumNameCell = styled.div`
  .name {
    font-weight: 500;
  }
  .tag-classify{
    width: fit-content;
    padding: 0 6px;
    background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
    border-radius: var(--base-border-radius);
    font-size: 12px;
    line-height: 18px;
  }
`
const ColumStatusCell = styled.div`
  .status{

    &::before{
      content: "";
      display: inline-block;
      width: 6px;
      height: 6px;
      margin-right: 4px;
      border-radius: 50%;
      background-color: var(--color-primary);
    }
    &.enabled{
      color: var(--color-primary);
      font-size: 12px;
      &::before{
        background-color: var(--color-primary);
      }
    }
    &.disabled{
      color: var(--color-text-3);
      font-size: 12px;
      &::before{
        background-color: var(--color-gray-3);
      }
    }
    &.wait-pay{
      color: var(--color-status-warning);
      font-size: 12px;
      &::before{
        background-color: var(--color-status-warning);
      }
    }
  }
`

const ColumCreditsRestCell = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
`
const ColumEffectiveCell = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  .date-tag{
    display: inline-block;
    padding: 1px 6px;
    text-align: center;
    font-size: 11px;
    line-height: 16px;
    border-radius: 4px;
    margin-right: 4px;
    &.start{
      color: var(--color-primary);
      background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
    }
    &.end{
      color: var(--color-status-warning);
      background-color: color-mix(in srgb, var(--color-status-warning) 14%, transparent);
    }
  }
`
const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  .popup-input {
    width: 360px;
  }
  .popup-select {
    width: 140px;
  }
`

const TipText = styled.strong`
    font-size: 14px;
    color: var(--color-error);
`

/**
 * 弹窗容器：风格对齐 agent 路由弹窗（RouteFormModal）
 * 12px 圆角 / 24px 内容内边距 / 16px·650 标题 / footer 顶部边框分隔线
 */
const StyledModal = styled(Modal)`
  &&& .ant-modal-content {
    padding: 24px;
    border-radius: 12px;
  }
  &&& .ant-modal-content .ant-modal-header {
    padding: 0;
    margin: 0 0 24px;
  }
  &&& .ant-modal-content .ant-modal-body {
    padding: 0;
  }
  .ant-modal-title {
    font-size: 16px;
    font-weight: 650;
  }
  &&& .ant-modal-content .ant-modal-footer {
    margin: 24px 0 0;
    padding: 16px 0 0;
    border-top: 1px solid var(--color-border);
  }
  /* 表单控件：36px 高、8px 圆角、soft 底色（对齐 RouteFormModal / StyledEditModal） */
  .ant-input {
    height: 36px;
    border-radius: 8px;
    background: var(--color-background-soft);
  }
  .ant-select-single {
    height: 36px;
  }
  .ant-select-selector {
    border-radius: 8px !important;
    background: var(--color-background-soft) !important;
  }
  /* 表格：行 hover 背景与表头对齐 agent 路由列表 */
  .ant-table-wrapper .ant-table {
    border-radius: 10px;
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .ant-table-wrapper .ant-table-thead > tr > th {
    background: var(--color-background-soft);
    font-weight: 600;
  }
  .ant-table-wrapper .ant-table-tbody > tr:hover > td {
    background: color-mix(in srgb, var(--color-primary) 6%, var(--color-background));
  }
`
