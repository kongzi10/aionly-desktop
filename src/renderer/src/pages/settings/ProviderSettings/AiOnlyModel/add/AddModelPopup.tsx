import './AddModelPop.css'

import { batchAddModelPayLaterApi } from '@renderer/api/balance'
import { listUnopenedPayLaterModelsApi } from '@renderer/api/openManagement'
import vipImg from '@renderer/assets/images/vipSign.png'
import CustomCollapse from '@renderer/components/CustomCollapse'
import DiscountTag from '@renderer/components/Tags/Model/DiscountTag'
import ModelLabelTags from '@renderer/components/Tags/Model/ModelLabelTags'
import { TopView } from '@renderer/components/TopView'
import { useModelLabels } from '@renderer/hooks/useModelLabels'
import { isHiddenOmniOrDecisionModel } from '@renderer/hooks/useNewShelfModelPush'
import { usePublishPriceDiscount } from '@renderer/hooks/usePublishPriceDiscount'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import type { Provider } from '@renderer/types'
import { Button, Checkbox, Empty, Flex, Input, message, Modal, Radio, Spin } from 'antd'
import type { CheckboxGroupProps } from 'antd/es/checkbox'
import { Search } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface ShowParams {
  // 弹窗内仅按 modelType + 搜索词拉取未开通模型列表，provider 暂未参与筛选，故设为可选
  provider?: Provider
  modelType?: 'text_model' | 'image_generation'
}

interface Props extends ShowParams {
  resolve: (data: any) => void
}

const PopupContainer: React.FC<Props> = ({ resolve, modelType }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  const [curTabValue, setCurTabValue] = useState<string>(modelType || 'text_model')
  const [modelList, setModelList] = useState<any[]>([])
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // 限时折扣活动：ModelVo.id 即 ai_model.id，作为活动 map 的合并键
  const { getDiscount } = usePublishPriceDiscount(modelList, (m: any) => m.id)
  // 推荐标签（人气模型/最新推荐等）：UnopenedPayLaterModelVo 透传 recommendLabel/modelLabel
  const { getLabelItems } = useModelLabels()
  const tabOptions: CheckboxGroupProps<string>['options'] = [
    { label: t('settings.models.text_model'), value: 'text_model' },
    { label: t('settings.models.image_model'), value: 'image_generation' }
  ]

  const fetchModels = useCallback(() => {
    setLoading(true)
    setSelectedModelIds([])
    listUnopenedPayLaterModelsApi()
      .then((res: any) => {
        const data = res?.data
        if (data && data.length > 0 && Array.isArray(res.data)) {
          setModelList(res.data)
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  /** 无 VIP 或调用权限的模型不可选（灰置） */
  const modelDisabled = (item: any) => {
    if (item.hasCallPermission === false) return true
    if (item.memberSpecial === '1' && item.hasVipPermission === false) return true
    return false
  }

  const keyword = searchText.trim().toLowerCase()
  const filteredModels = modelList.filter(
    (model) =>
      // 全模态模型（omniModality=1）与决策模型（omniModality=2）屏蔽不展示
      !isHiddenOmniOrDecisionModel(model) &&
      model.modelAttribute === curTabValue &&
      (!keyword ||
        String(model.modelName || '')
          .toLowerCase()
          .includes(keyword) ||
        String(model.serviceName || '')
          .toLowerCase()
          .includes(keyword))
  )

  // 按 serviceName 分组
  const groupedModels = filteredModels.reduce(
    (acc, model) => {
      const serviceName = model.serviceName || '未分类'
      if (!acc[serviceName]) {
        acc[serviceName] = []
      }
      acc[serviceName].push(model)
      return acc
    },
    {} as Record<string, any[]>
  )

  // 转换为数组格式
  const groupModels = Object.entries(groupedModels).map(([groupName, models]) => ({
    groupName,
    models
  }))

  const handleModelClick = (model: any) => {
    if (modelDisabled(model)) {
      return
    }
    setSelectedModelIds((prev) =>
      prev.includes(model.id) ? prev.filter((id) => id !== model.id) : [...prev, model.id]
    )
  }

  // 组全选逻辑
  const handleGroupSelectAll = (groupModels: any[]) => {
    const selectableModels = groupModels.filter((model) => !modelDisabled(model))
    const selectableIds = selectableModels.map((model) => model.id)
    const allSelected = selectableIds.every((id) => selectedModelIds.includes(id))

    if (allSelected) {
      // 取消选中该组的所有模型
      setSelectedModelIds((prev) => prev.filter((id) => !selectableIds.includes(id)))
    } else {
      // 选中该组的所有模型
      setSelectedModelIds((prev) => [...new Set([...prev, ...selectableIds])])
    }
  }

  // 判断组的选中状态
  const getGroupCheckState = (groupModels: any[]) => {
    const selectableModels = groupModels.filter((model) => !modelDisabled(model))
    const selectableIds = selectableModels.map((model) => model.id)
    const selectedCount = selectableIds.filter((id) => selectedModelIds.includes(id)).length

    return {
      checked: selectedCount === selectableIds.length && selectableIds.length > 0,
      indeterminate: selectedCount > 0 && selectedCount < selectableIds.length
    }
  }

  /** 开通模型 **/
  const handleActivateModel = async () => {
    setConfirmLoading(true)
    try {
      const res = await batchAddModelPayLaterApi({
        modelIds: selectedModelIds,
        autoOpenNewModel: false
      })
      if (res.code === 200 || res.code === 0) {
        message.success('开通成功')
        setOpen(false)
        // 广播开通成功事件：头像浮窗「新上架模型开通提示」默认规则据此实时移除并轮播补位
        void EventEmitter.emit(EVENT_NAMES.MODEL_PAY_LATER_ACTIVATED, { modelIds: selectedModelIds })
        resolve({ success: true, modelIds: selectedModelIds })
      }
    } catch (e) {
    } finally {
      setConfirmLoading(false)
    }
  }

  const onOk = useCallback(() => setOpen(false), [])

  const onCancel = useCallback(() => setOpen(false), [])

  const onClose = useCallback(() => resolve({}), [resolve])

  const handleSearch = useCallback(() => {
    setSearchText((prev) => prev.trim())
  }, [])

  return (
    <Modal
      wrapClassName="add-model-popup"
      width="800px"
      title={t('settings.models.manage.add_model')}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      afterClose={onClose}
      destroyOnHidden
      centered
      footer={() => (
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            disabled={selectedModelIds.length === 0}
            loading={confirmLoading}
            onClick={handleActivateModel}>
            {t('settings.models.add.activate_model')}
          </Button>
        </>
      )}>
      <div className="tab-nav">
        <div className="tab-layout">
          <Radio.Group
            block
            value={curTabValue}
            options={tabOptions}
            optionType="button"
            buttonStyle="solid"
            onChange={(e) => {
              setCurTabValue(e.target.value)
              setSelectedModelIds([])
            }}
          />
        </div>
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          placeholder={t('settings.models.add.search_placeholder')}
          suffix={<Search size={12} onClick={handleSearch} />}
          onPressEnter={handleSearch}
          style={{ width: '50%' }}
        />
      </div>
      <div className="desc">
        {t('settings.models.add.activate_desc')}
        <span className="color-red">{t('settings.models.add.tips')}</span>
      </div>
      <div className="model-wrapper">
        <div className="list">
          {loading ? (
            <div className="loading">
              <Spin>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </Spin>
            </div>
          ) : (
            <CustomCollapseWrapper>
              {groupModels.length === 0 && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.no_results')} />
              )}
              {groupModels.map((groupItem: any) => {
                const groupCheckState = getGroupCheckState(groupItem.models)
                return (
                  <CustomCollapse
                    key={groupItem.groupName}
                    defaultActiveKey={['1']}
                    label={
                      <Flex align="center" gap={10}>
                        <span style={{ fontWeight: 'bold' }}>{groupItem.groupName}</span>
                      </Flex>
                    }
                    extra={
                      <Checkbox
                        indeterminate={groupCheckState.indeterminate}
                        checked={groupCheckState.checked}
                        onChange={(e) => {
                          e.stopPropagation()
                          handleGroupSelectAll(groupItem.models)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    }
                    styles={{
                      header: {
                        padding: '10px 16px',
                        background: 'var(--color-gray-5)'
                      }
                    }}>
                    {groupItem.models.map((model: any) => (
                      <div
                        key={model.id}
                        className={`item ${modelDisabled(model) ? 'disabled' : ''} ${selectedModelIds.includes(model.id) ? 'selected' : ''}`}
                        onClick={() => handleModelClick(model)}>
                        <div className="left">
                          <img className="model-img" src={model.modelFileUrl} alt={model.modelName} />
                          <span>{model.modelName}</span>
                          {/* 免费标签：与网站模型广场口径一致（ai_model.free_flag，后端 listUnopenedPayLaterModels 透传） */}
                          {model.freeFlag == '1' && <span className="free-tag">{t('models.type.free')}</span>}
                          {model.memberSpecial == '1' && <span className="vip-tag">VIP</span>}
                          {model.memberSpecial == '1' && <img className="vip-img" src={vipImg} alt="" />}
                          <ModelLabelTags items={getLabelItems(model)} />
                          <DiscountTag activity={getDiscount(model)} />
                        </div>
                        <Checkbox
                          checked={selectedModelIds.includes(model.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => {
                            handleModelClick(model)
                          }}
                        />
                      </div>
                    ))}
                  </CustomCollapse>
                )
              })}
            </CustomCollapseWrapper>
          )}
        </div>
      </div>
    </Modal>
  )
}

const TopViewKey = 'AiOnlyAddModelPopup'

export default class AddModelPopup {
  static hide() {
    TopView.hide(TopViewKey)
  }

  static show(props: ShowParams) {
    return new Promise<any>((resolve) => {
      TopView.show(
        <PopupContainer
          {...props}
          resolve={(v) => {
            resolve(v)
            this.hide()
          }}
        />,
        TopViewKey
      )
    })
  }
}

const CustomCollapseWrapper = styled.div`
  .toolbar-item {
    transform: translateZ(0);
    will-change: opacity;
    opacity: 0;
    transition: opacity 0.2s;
  }
  &:hover .toolbar-item {
    opacity: 1;
  }

  /* 移除 collapse 的 padding，转而在 scroller 内部调整 */
  .ant-collapse-content-box {
    padding: 0 !important;
  }
`
