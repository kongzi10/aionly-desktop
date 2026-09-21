import './AddModelPop.css'

import { batchAddModelPayLaterApi } from '@renderer/api/balance'
import { listUnopenedPayLaterModelsApi } from '@renderer/api/openManagement'
import vipImg from '@renderer/assets/images/vipSign.png'
import CustomCollapse from '@renderer/components/CustomCollapse'
import { TopView } from '@renderer/components/TopView'
import type { Provider } from '@renderer/types'
import { Button, Checkbox, Empty, Flex, Input, message, Modal, Radio, Spin } from 'antd'
import type { CheckboxGroupProps } from 'antd/es/checkbox'
import { Search } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface ShowParams {
  provider: Provider
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
        message.success(res.msg || '开通成功')
        setOpen(false)
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
                        className={`item ${modelDisabled(model) ? 'disabled' : ''} ${selectedModelIds.includes(model.id) ? 'selected' : ''}`}>
                        <div className="left">
                          <img className="model-img" src={model.modelFileUrl} alt={model.modelName} />
                          <span>{model.modelName}</span>
                          {model.memberSpecial == '1' && <img className="vip-img" src={vipImg} alt="" />}
                        </div>
                        <Checkbox
                          checked={selectedModelIds.includes(model.id)}
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
