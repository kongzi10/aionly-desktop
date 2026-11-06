import { loggerService } from '@logger'
import { useFetchAndSetupModels } from '@renderer/hooks/useAiOnlyModels'
import AiOnlyAddModelPopup from '@renderer/pages/settings/ProviderSettings/AiOnlyModel/add/AddModelPopup'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('OpenModelButton')

interface OpenModelButtonProps {
  /** 开通成功并刷新全局模型列表后的回调（如选择模型弹窗刷新自身列表） */
  onSuccess?: () => void
}

/**
 * 首页无可用模型时替换发送按钮的「开通模型」入口。
 * 交互与公告「立即开通」CTA 一致：打开添加模型弹窗，开通成功后刷新模型列表，
 * 列表更新后输入框自动解禁、本按钮自动隐藏。
 */
const OpenModelButton: FC<OpenModelButtonProps> = ({ onSuccess }) => {
  const { t } = useTranslation()
  const setupModels = useFetchAndSetupModels()
  const [opening, setOpening] = useState(false)

  const handleOpen = useCallback(async () => {
    if (opening) return

    setOpening(true)
    try {
      const result = await AiOnlyAddModelPopup.show({})
      if (result?.success) {
        await setupModels(10)
        onSuccess?.()
      }
    } catch (error) {
      logger.error('Failed to open model popup', { error })
    } finally {
      setOpening(false)
    }
  }, [opening, setupModels, onSuccess])

  const label = t('homeLanding.modelGuide.action')

  return (
    <OpenButton type="button" disabled={opening} aria-label={label} title={label} onClick={() => void handleOpen()}>
      <span>{label}</span>
    </OpenButton>
  )
}

/**
 * 方案一 · 墨黑经典扫光（btn-12 机制）
 * 浅色主题：深底 + 白光带；深色主题：浅底 + 深光带。
 * 文字恒为 #fff，由 mix-blend-mode: difference 保证在两种底色与光带上都清晰可读。
 */
const OpenButton = styled.button`
  --kb-bg: #111111;
  --kb-fg: #ffffff;
  --kb-border: #ffffff;
  --kb-sweep: #ffffff;

  body.dark &,
  body[theme-mode='dark'] & {
    --kb-bg: #f2f6ff;
    --kb-border: rgb(17 17 17 / 35%);
    --kb-sweep: #0b1020;
  }

  -webkit-tap-highlight-color: transparent;
  -webkit-appearance: button;
  -webkit-mask-image: -webkit-radial-gradient(#000, #fff);

  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 30px;
  padding: 0 18px;
  overflow: hidden;
  border: 2px solid var(--kb-border);
  border-radius: 99rem;
  background-color: var(--kb-bg);
  color: var(--kb-fg);
  font-family: inherit;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.5px;
  white-space: nowrap;
  cursor: pointer;

  span {
    position: relative;
    z-index: 1;
    mix-blend-mode: difference;
  }

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      var(--kb-sweep) 25%,
      transparent 0,
      transparent 50%,
      var(--kb-sweep) 0,
      var(--kb-sweep) 75%,
      transparent 0
    );
    transform: translateY(var(--progress, 100%));
    transition: transform 0.2s ease;
    z-index: 0;
  }

  &::after {
    --progress: -100%;
    background: linear-gradient(
      90deg,
      transparent 0,
      transparent 25%,
      var(--kb-sweep) 0,
      var(--kb-sweep) 50%,
      transparent 0,
      transparent 75%,
      var(--kb-sweep) 0
    );
    z-index: -1;
  }

  &:hover:not(:disabled)::before,
  &:hover:not(:disabled)::after {
    --progress: 0;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.75;
    cursor: default;
  }

  @media (prefers-reduced-motion: reduce) {
    &::before,
    &::after {
      transition: none;
    }
  }
`

export default OpenModelButton
