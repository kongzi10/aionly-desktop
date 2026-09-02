import { SearchOutlined, SelectOutlined } from '@ant-design/icons'
import { Checkbox, Empty, Input } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { RouteModel } from '../hooks/useAgentRouterSources'
import { RouteFormModal } from './RouteFormModal'

type Props = {
  id?: string
  models: RouteModel[]
  value?: string[]
  onChange?: (value: string[]) => void
  disabled?: boolean
  loading?: boolean
}

export const ModelIdSelect = ({ id, models, value = [], onChange, disabled, loading }: Props) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<string[]>([])
  const query = search.trim().toLowerCase()
  const filtered = models.filter((model) => model.id.toLowerCase().includes(query))
  return (
    <>
      <Trigger
        id={id}
        type="button"
        disabled={disabled || loading}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setDraft([...value])
          setSearch('')
          setOpen(true)
        }}>
        <span>
          {value.length ? t('agentRouter.selectedModels', { count: value.length }) : t('agentRouter.selectModels')}
        </span>
        <SelectOutlined />
      </Trigger>
      {value.length ? (
        <SelectedModels>
          {value.map((modelId) => (
            <ModelTag key={modelId} title={modelId}>
              {modelId}
            </ModelTag>
          ))}
        </SelectedModels>
      ) : null}
      <RouteFormModal
        open={open}
        title={t('agentRouter.selectModels')}
        centered
        width={600}
        destroyOnHidden
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onCancel={() => setOpen(false)}
        onOk={() => {
          onChange?.(draft)
          setOpen(false)
        }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('agentRouter.searchModelId')}
          value={search}
          allowClear
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectionCount>{t('agentRouter.selectedModels', { count: draft.length })}</SelectionCount>
        <ModelList>
          {filtered.length ? (
            filtered.map((model) => (
              <ModelOption key={model.id} $selected={draft.includes(model.id)}>
                <Checkbox
                  checked={draft.includes(model.id)}
                  onChange={(event) =>
                    setDraft((current) =>
                      event.target.checked ? [...current, model.id] : current.filter((item) => item !== model.id)
                    )
                  }>
                  {model.id}
                </Checkbox>
              </ModelOption>
            ))
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </ModelList>
      </RouteFormModal>
    </>
  )
}

const Trigger = styled.button`
  width: 100%; min-height: 36px; padding: 7px 11px; display: flex; align-items: center; justify-content: space-between;
  gap: 12px; border: 1px solid var(--color-border, #d9d9d9); border-radius: 8px;
  background: var(--color-background-soft, #f5f5f5); color: var(--color-text, #333); font: inherit; text-align: left; cursor: pointer;
  &:hover:not(:disabled), &:focus-visible { border-color: var(--color-primary, #1677ff); }
  &:focus-visible { outline: 2px solid var(--color-primary, #1677ff); outline-offset: 2px; }
  &:disabled { color: var(--color-text-3, #aaa); cursor: not-allowed; }
  > .anticon { color: var(--color-text-3, #888); }
`
const SelectedModels = styled.div`display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;max-height:100px;overflow:auto;`
const ModelTag = styled.span`max-width:100%;padding:3px 7px;border-radius:5px;background:var(--color-background-soft, #f5f5f5);color:var(--color-text-2, #555);font-size:12px;line-height:18px;overflow-wrap:anywhere;`
const SelectionCount = styled.div`margin:14px 0 10px;color:var(--color-text-3, #888);font-size:12px;`
const ModelList = styled.div`height:320px;max-height:45vh;overflow:auto;display:flex;flex-direction:column;gap:6px;`
const ModelOption = styled.div<{ $selected: boolean }>`
  border:1px solid ${({ $selected }) => ($selected ? 'var(--color-primary, #1677ff)' : 'var(--color-border, #eee)')};
  border-radius:8px;background:${({ $selected }) => ($selected ? 'var(--color-primary-soft, #e6f4ff)' : 'transparent')};
  .ant-checkbox-wrapper { display:flex;align-items:center;width:100%;padding:11px 12px;margin:0;font-size:13px;overflow-wrap:anywhere; }
  .ant-checkbox + span { min-width:0; }
`
