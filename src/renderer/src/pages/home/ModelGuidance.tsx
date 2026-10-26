import { Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  modelsReady: boolean
  hasModel: boolean
  onOpenModels: () => void
}

const ModelGuidance: FC<Props> = ({ modelsReady, hasModel, onOpenModels }) => {
  const { t } = useTranslation()
  if (!modelsReady || hasModel) return null

  return (
    <Container role="status">
      <Sparkles size={18} aria-hidden="true" />
      <div>
        <strong>{t('homeLanding.modelGuide.title')}</strong>
        <p>{t('homeLanding.modelGuide.description')}</p>
      </div>
      <button type="button" onClick={onOpenModels}>
        {t('homeLanding.modelGuide.action')}
      </button>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  margin-top: 18px;
  padding: 6px 10px;
  color: var(--color-text-2);
  font-size: 12px;

  svg {
    flex-shrink: 0;
    color: var(--color-primary);
  }

  div {
    min-width: 0;
  }

  p {
    margin: 2px 0 0;
    color: var(--color-text-2);
  }

  button {
    flex-shrink: 0;
    border: 0;
    padding: 4px 2px;
    background: transparent;
    color: var(--color-primary);
    font-weight: 600;
    cursor: pointer;
  }
`

export default ModelGuidance
