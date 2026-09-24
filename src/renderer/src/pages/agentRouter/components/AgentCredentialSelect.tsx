import { DownOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { Select } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { AgentRouterCredential } from '../hooks/useAgentRouterSources'

const HIDDEN_API_KEY = '••••••••••••••••••••••••'

interface Props {
  value?: string
  credentials: AgentRouterCredential[]
  placeholder?: string
  onChange: (value: string) => void
}

export const AgentCredentialSelect = ({ value, credentials, placeholder, onChange }: Props) => {
  const { t } = useTranslation()
  const [showKey, setShowKey] = useState(false)

  return (
    <Select
      value={value}
      optionLabelProp="selectedLabel"
      options={credentials.map((credential) => ({
        value: credential.id,
        label: credential.label,
        selectedLabel: showKey ? credential.value : HIDDEN_API_KEY
      }))}
      onChange={(nextValue) => {
        setShowKey(false)
        onChange(nextValue)
      }}
      placeholder={placeholder}
      suffixIcon={
        <SuffixControls>
          <KeyVisibility
            type="button"
            aria-label={t('agentRouter.toggleApiKeyVisibility')}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation()
              setShowKey((current) => !current)
            }}>
            {showKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          </KeyVisibility>
          <DownOutlined />
        </SuffixControls>
      }
    />
  )
}

const SuffixControls = styled.span`
  height: 100%; display: inline-flex; align-items: center; gap: 8px; pointer-events: auto;
`
const KeyVisibility = styled.button`
  padding: 0; display: inline-flex; align-items: center; border: 0; background: transparent;
  color: var(--color-text-3); cursor: pointer;
`
