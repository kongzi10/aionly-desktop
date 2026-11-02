import { DownOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { useExternalApps } from '@renderer/hooks/useExternalApps'
import { buildEditorUrl, getEditorIcon } from '@renderer/utils/editorUtils'
import type { ExternalAppInfo } from '@shared/externalApp/types'
import { Button, Dropdown, type MenuProps, Space, Tooltip } from 'antd'
import { ChevronDown } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('OpenExternalAppButton')

type OpenExternalAppButtonProps = {
  workdir: string
  className?: string
  /**
   * - `default`：顶栏形态，带边框的按钮组
   * - `compact`：输入框底栏形态，无边框图标键，与工具按钮同一行
   */
  variant?: 'default' | 'compact'
}

const OpenExternalAppButton = ({ workdir, className, variant = 'default' }: OpenExternalAppButtonProps) => {
  const { t } = useTranslation()
  const { data: externalApps } = useExternalApps()
  const availableEditors = useMemo(() => {
    if (!externalApps) {
      return []
    }
    return externalApps.filter((app) => app.tags.includes('code-editor'))
  }, [externalApps])

  const openInEditor = useCallback(
    (app: ExternalAppInfo) => {
      switch (app.id) {
        case 'vscode':
        case 'cursor':
        case 'zed':
          window.open(buildEditorUrl(app, workdir))
          break
        default:
          logger.error(`Unexpected Error: External app not found: ${app.id}`)
          window.toast.error(`Unexpected Error: External app not found: ${app.id}`)
      }
    },
    [workdir]
  )

  // TODO: migrate it to preferences in v2
  const [selectedEditorId, setSelectedEditorId] = useState<string | null>(null)

  const selectedEditor = useMemo(() => {
    return availableEditors.find((app) => app.id === selectedEditorId) ?? availableEditors[0]
  }, [availableEditors, selectedEditorId])

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    const config = availableEditors.find((app) => app.id === e.key)
    if (!config) {
      logger.error(`Unexpected Error: External app not found: ${e.key}`)
      window.toast.error(`Unexpected Error: External app not found: ${e.key}`)
      return
    }
    setSelectedEditorId(config.id)
    openInEditor(config)
  }

  const items: MenuProps['items'] = useMemo(() => {
    return availableEditors.map((app) => ({ label: app.name, key: app.id, icon: getEditorIcon(app) }))
  }, [availableEditors])

  const menuProps = {
    items,
    onClick: handleMenuClick
  }

  if (availableEditors.length === 0 || !selectedEditor) {
    return null
  }

  if (variant === 'compact') {
    const openLabel = t('common.open_in', { name: selectedEditor.name })

    return (
      <CompactGroup className={className}>
        <Tooltip title={openLabel} mouseEnterDelay={0.5}>
          <CompactButton type="button" onClick={() => openInEditor(selectedEditor)} aria-label={openLabel}>
            {getEditorIcon(selectedEditor)}
          </CompactButton>
        </Tooltip>
        <Dropdown menu={menuProps} placement="topRight">
          <CompactButton type="button" aria-label={t('common.select')} aria-haspopup="menu">
            <ChevronDown size={12} />
          </CompactButton>
        </Dropdown>
      </CompactGroup>
    )
  }

  return (
    <ExternalAppButtonGroup className={className}>
      <Tooltip title={t('common.open_in', { name: selectedEditor.name })} mouseEnterDelay={0.5}>
        <Button onClick={() => openInEditor(selectedEditor)} icon={getEditorIcon(selectedEditor)} />
      </Tooltip>
      <Dropdown menu={menuProps} placement="bottomRight">
        <Button icon={<DownOutlined />} />
      </Dropdown>
    </ExternalAppButtonGroup>
  )
}

const ExternalAppButtonGroup = styled(Space.Compact)`
  .ant-btn {
    border-color: var(--color-border) !important;
  }

  .ant-btn-compact-first-item {
    border-inline-end-width: 0 !important;
  }

  .ant-btn-compact-item:not(.ant-btn-compact-first-item) {
    margin-inline-start: 0 !important;
    border-inline-start-width: 0 !important;
  }
`

const CompactGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`

const CompactButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: var(--base-border-radius);
  background: transparent;
  color: var(--color-icon);
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--color-gray-5);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }
`

export default OpenExternalAppButton
