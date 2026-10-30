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
        <SearchBar>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('agentRouter.searchModelId')}
            value={search}
            allowClear
            onChange={(event) => setSearch(event.target.value)}
          />
          <SelectionCount $active={draft.length > 0}>
            {t('agentRouter.selectedModels', { count: draft.length })}
          </SelectionCount>
        </SearchBar>
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
            <EmptyBox>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </EmptyBox>
          )}
        </ModelList>
      </RouteFormModal>
    </>
  )
}

const Trigger = styled.button`
  width: 100%;
  min-height: 32px;
  padding: 6px 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-background);
  color: var(--color-text-2);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;

  &:hover:not(:disabled) {
    border-color: var(--color-text-3);
    color: var(--color-text-1);
  }

  &:focus-visible {
    outline: 2px solid var(--ar-accent);
    outline-offset: 1px;
  }

  &:disabled {
    color: var(--color-text-3);
    /* 不用 not-allowed：这个按钮绝大多数时候是被上游（未选密钥）禁用，
       禁止光标会让人以为整个表单走不通，这里只用颜色弱化表达 */
    cursor: default;
  }

  > .anticon {
    color: var(--color-text-3);
  }
`

const SelectedModels = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  max-height: 100px;
  overflow: auto;
`

const ModelTag = styled.span`
  max-width: 100%;
  padding: 2px 9px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-background-soft);
  color: var(--color-text-2);
  font-size: 11px;
  line-height: 18px;
  overflow-wrap: anywhere;
`

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;

  .ant-input-affix-wrapper {
    flex: 1;
    min-width: 0;
    border-radius: 999px !important;
    background: var(--color-background) !important;
  }
`

const SelectionCount = styled.span<{ $active: boolean }>`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  border: 1px solid ${(props) => (props.$active ? 'transparent' : 'var(--color-border)')};
  border-radius: 999px;
  background: ${(props) => (props.$active ? 'var(--ar-accent)' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--ar-accent-ink)' : 'var(--color-text-3)')};
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
`

const ModelList = styled.div`
  height: 320px;
  max-height: 45vh;
  display: flex;
  flex-direction: column;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 12px;
`

const ModelOption = styled.div<{ $selected: boolean }>`
  background: ${(props) => (props.$selected ? 'var(--ar-accent-tint)' : 'transparent')};
  box-shadow: ${(props) => (props.$selected ? 'inset 2px 0 0 var(--ar-accent)' : 'none')};

  & + & {
    border-top: 1px solid var(--color-border-soft);
  }

  &:hover {
    background: var(--color-background-soft);
  }

  .ant-checkbox-wrapper {
    display: flex;
    align-items: center;
    width: 100%;
    margin: 0;
    padding: 10px 12px;
    font-size: 12.5px;
    overflow-wrap: anywhere;
  }

  .ant-checkbox + span {
    min-width: 0;
  }
`

const EmptyBox = styled.div`
  padding: 40px 0;
  border: 1px dashed var(--color-border);
  border-radius: 12px;
`
