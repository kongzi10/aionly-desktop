import { loggerService } from '@logger'
import { useFetchAndSetupModels } from '@renderer/hooks/useAiOnlyModels'
import AiOnlyAddModelPopup from '@renderer/pages/settings/ProviderSettings/AiOnlyModel/add/AddModelPopup'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('OpenNewModelButton')

interface OpenNewModelButtonProps {
  /** 开通成功并刷新全局模型列表后的回调（如选择模型弹窗刷新自身列表） */
  onSuccess?: () => void
  /** 打开开通模型弹窗时默认选中的模型类型（如绘画页传 'image_generation'），默认文本模型 */
  modelType?: 'text_model' | 'image_generation'
}

const STAR_PATH =
  'M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z'

const Star: FC<{ className?: string }> = ({ className }) => (
  <div className={className} aria-hidden="true">
    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 784.11 815.53">
      <path className="fil0" d={STAR_PATH} />
    </svg>
  </div>
)

/**
 * 选择模型弹窗专用的「开通新模型」入口：星光飞散动画按钮。
 * 交互与输入框「开通模型」一致：打开添加模型弹窗，开通成功后刷新模型列表。
 * 注意：仅用于选择模型弹窗，输入框/对话框内仍使用 OpenModelButton。
 */
const OpenNewModelButton: FC<OpenNewModelButtonProps> = ({ onSuccess, modelType }) => {
  const { t } = useTranslation()
  const setupModels = useFetchAndSetupModels()
  const [opening, setOpening] = useState(false)

  const handleOpen = useCallback(async () => {
    if (opening) return

    setOpening(true)
    try {
      const result = await AiOnlyAddModelPopup.show({ modelType })
      if (result?.success) {
        await setupModels(10)
        onSuccess?.()
      }
    } catch (error) {
      logger.error('Failed to open add-model popup', { error })
    } finally {
      setOpening(false)
    }
  }, [opening, setupModels, onSuccess])

  const label = t('homeLanding.modelGuide.openNewAction')

  return (
    <StarButton type="button" disabled={opening} aria-label={label} title={label} onClick={() => void handleOpen()}>
      {label}
      <Star className="star-1" />
      <Star className="star-2" />
      <Star className="star-3" />
      <Star className="star-4" />
      <Star className="star-5" />
      <Star className="star-6" />
    </StarButton>
  )
}

/**
 * 星光飞散按钮：默认橙底黑字，hover 时底色透明、文字变橙并向外飞散出发光星芒。
 * 注意：按钮自身不能创建层叠上下文（不可加 z-index/opacity/transform/filter 等），
 * 否则初始状态下 z-index:-5 的星芒会绘制在按钮背景之上。
 */
const StarButton = styled.button`
  /* 浅色主题：暖橙星芒，保证在浅色弹窗背景上清晰可见 */
  --snb-bg: #fec195;
  --snb-fg: #181818;
  --snb-hover-fg: #c2410c;
  --snb-star: #ea580c;
  --snb-star-glow: rgb(234 88 12 / 80%);
  --snb-glow: rgb(254 193 149 / 55%);

  /* 深色主题：暖白星芒，保证在深色弹窗背景上清晰可见 */
  body.dark &,
  body[theme-mode='dark'] & {
    --snb-hover-fg: #fec195;
    --snb-star: #fffdef;
    --snb-star-glow: #fffdef;
    --snb-glow: rgb(254 193 149 / 45%);
  }

  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 7px 22px;
  background: var(--snb-bg);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  color: var(--snb-fg);
  white-space: nowrap;
  border: 2px solid var(--snb-bg);
  border-radius: 8px;
  box-shadow: 0 0 0 var(--snb-glow);
  transition: all 0.3s ease-in-out;
  cursor: pointer;

  .fil0 {
    fill: var(--snb-star);
  }

  .star-1,
  .star-2,
  .star-3,
  .star-4,
  .star-5,
  .star-6 {
    position: absolute;
    height: auto;
    filter: drop-shadow(0 0 0 var(--snb-star-glow));
    z-index: -5;

    svg {
      display: block;
      width: 100%;
      height: auto;
    }
  }

  .star-1 {
    top: 20%;
    left: 20%;
    width: 15px;
    transition: all 1s cubic-bezier(0.05, 0.83, 0.43, 0.96);
  }

  .star-2 {
    top: 45%;
    left: 45%;
    width: 9px;
    transition: all 1s cubic-bezier(0, 0.4, 0, 1.01);
  }

  .star-3 {
    top: 40%;
    left: 40%;
    width: 4px;
    transition: all 1s cubic-bezier(0, 0.4, 0, 1.01);
  }

  .star-4 {
    top: 20%;
    left: 40%;
    width: 6px;
    transition: all 0.8s cubic-bezier(0, 0.4, 0, 1.01);
  }

  .star-5 {
    top: 25%;
    left: 45%;
    width: 9px;
    transition: all 0.6s cubic-bezier(0, 0.4, 0, 1.01);
  }

  .star-6 {
    top: 5%;
    left: 50%;
    width: 4px;
    transition: all 0.8s ease;
  }

  &:hover:not(:disabled) {
    background: transparent;
    color: var(--snb-hover-fg);
    box-shadow: 0 0 25px var(--snb-glow);

    .star-1 {
      top: -80%;
      left: -30%;
      filter: drop-shadow(0 0 10px var(--snb-star-glow));
      z-index: 2;
    }

    .star-2 {
      top: -25%;
      left: 10%;
      filter: drop-shadow(0 0 10px var(--snb-star-glow));
      z-index: 2;
    }

    .star-3 {
      top: 55%;
      left: 25%;
      filter: drop-shadow(0 0 10px var(--snb-star-glow));
      z-index: 2;
    }

    .star-4 {
      top: 30%;
      left: 80%;
      filter: drop-shadow(0 0 10px var(--snb-star-glow));
      z-index: 2;
    }

    .star-5 {
      top: 25%;
      /* 略小于设计稿的 115%，避免超出弹窗右内边距被 Modal 裁剪 */
      left: 110%;
      filter: drop-shadow(0 0 10px var(--snb-star-glow));
      z-index: 2;
    }

    .star-6 {
      top: 5%;
      left: 60%;
      filter: drop-shadow(0 0 10px var(--snb-star-glow));
      z-index: 2;
    }
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  &:disabled {
    background: #fec195b3;
    border-color: #fec195b3;
    cursor: default;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    .star-1,
    .star-2,
    .star-3,
    .star-4,
    .star-5,
    .star-6 {
      transition: none;
    }
  }
`

export default OpenNewModelButton
