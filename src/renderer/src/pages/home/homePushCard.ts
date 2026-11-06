import { useEffect, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'

export const SLIDE_INTERVAL = 4000

// 多条推送自动轮播：悬停卡片暂停，保证按钮可点；单条或减少动效偏好下不轮播
export function usePushCarousel(count: number) {
  const [index, setIndex] = useState(0)
  const pausedRef = useRef(false)

  useEffect(() => {
    setIndex((i) => (count ? i % count : 0))
  }, [count])

  useEffect(() => {
    if (count < 2) return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const timer = window.setInterval(() => {
      if (!pausedRef.current) setIndex((i) => (i + 1) % count)
    }, SLIDE_INTERVAL)
    return () => window.clearInterval(timer)
  }, [count])

  return { index, setIndex, pausedRef }
}

// 推送卡片基础样式：浅色为白底毛玻璃，深色主题切换为深蓝底 + 提亮描边
export const PushCardBase = styled.div`
  box-sizing: border-box;
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 12px;
  background: rgb(255 255 255 / 93%);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 32px #17233b26;
  color: #152b54;
  font-size: 12px;

  body.dark & {
    border-color: rgb(120 160 230 / 22%);
    background: rgb(23 32 51 / 92%);
    box-shadow: 0 12px 32px rgb(0 0 0 / 45%);
    color: #e8f0ff;
  }
`

// 关闭按钮：默认隐藏，悬停卡片时淡入；focus 时同样可见
export const PushCloseButton = styled.button`
  position: absolute;
  z-index: 2;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #7d8496;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 180ms ease,
    background-color 180ms ease,
    color 180ms ease;

  ${PushCardBase}:hover &,
  &:focus-visible {
    opacity: 1;
  }

  &:hover {
    background: rgb(120 140 175 / 16%);
    color: #33415c;
  }

  body.dark & {
    color: #8b9dbb;

    &:hover {
      background: rgb(255 255 255 / 10%);
      color: #c6d4ea;
    }
  }
`

// 轮播视口：高度由处于文档流中的激活 slide 自然撑开（文案 1-2 行时卡片收矮不留空白，
// 更长时最多 3 行，见 PushSlide 的 line-clamp）；非激活 slide 绝对定位叠放做交叉淡入淡出
export const PushViewport = styled.div`
  position: relative;
  overflow: hidden;
`

export const PushSlide = styled.div<{ $active: boolean }>`
  position: ${({ $active }) => ($active ? 'relative' : 'absolute')};
  ${({ $active }) => !$active && 'top: 0; right: 0; left: 0;'}
  opacity: ${({ $active }) => ($active ? 1 : 0)};
  transform: translateY(${({ $active }) => ($active ? 0 : 4)}px);
  transition:
    opacity 420ms ease,
    transform 420ms ease;
  pointer-events: ${({ $active }) => ($active ? 'auto' : 'none')};

  strong {
    display: block;
    padding-right: 18px;
    font-size: clamp(11px, 1vw, 12.5px);
  }

  p {
    margin: 6px 0 0;
    color: #667b9d;
    font-size: clamp(10px, 0.92vw, 11.5px);
    line-height: 1.55;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  body.dark & p {
    color: #8b9dbb;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const PushCardFoot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: clamp(6px, 0.7vw, 9px);
`

export const PushDots = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;

  /* 视觉为 5px 小圆点；点击热区通过 ::before 外扩，不影响观感 */
  button {
    position: relative;
    width: 5px;
    height: 5px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgb(120 150 200 / 35%);
    cursor: pointer;
    transition:
      width 250ms ease,
      background-color 250ms ease;

    &::before {
      content: '';
      position: absolute;
      inset: -6px;
    }

    &:hover {
      background: rgb(22 119 255 / 55%);
    }

    &.active {
      width: 14px;
      border-radius: 3px;
      background: var(--color-primary);
    }
  }

  body.dark & button {
    background: rgb(140 170 220 / 28%);

    &:hover {
      background: rgb(64 150 255 / 60%);
    }

    &.active {
      background: var(--color-primary);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
`

// 行动按钮：默认浅色底，悬停时蓝色斜切面板滑入填充、文字翻滚换色（btn-17 动效）
const moveUpAlternate = keyframes`
  0% { transform: translateY(0); }
  50% { transform: translateY(80%); }
  51% { transform: translateY(-80%); }
  100% { transform: translateY(0); }
`

// 文字翻滚被遮挡的间隙切换颜色，实现浅底深字 → 蓝底白字
const textSwap = keyframes`
  0%, 50% { color: var(--btn-fg); }
  51%, 100% { color: var(--btn-fg-on); }
`

export const PushActionButton = styled.button`
  --btn-bg: #eef1f6;
  --btn-fg: #152b54;
  --btn-fg-on: #fff;
  --btn-fill: var(--color-primary);

  position: relative;
  z-index: 0;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  padding: clamp(5px, 0.6vw, 7px) clamp(10px, 1.2vw, 16px);
  background: var(--btn-bg);
  color: var(--btn-fg);
  font-size: clamp(10px, 0.95vw, 12px);
  font-weight: 600;
  cursor: pointer;

  body.dark & {
    --btn-bg: rgb(255 255 255 / 10%);
    --btn-fg: #c6d4ea;
    --btn-fill: #3f8dff;
  }

  /* 上下两片斜切蓝色面板，悬停时对向滑入铺满按钮 */
  &::before,
  &::after {
    --skew: 0.2;
    content: '';
    position: absolute;
    display: block;
    width: 100%;
    height: 102%;
    left: calc(-50% - 50% * var(--skew));
    top: -104%;
    background: var(--btn-fill);
    transform: skew(calc(150deg * var(--skew))) translateY(var(--progress, 0));
    transition: transform 200ms ease;
    pointer-events: none;
  }

  &::after {
    --progress: 0%;
    left: calc(50% + 50% * var(--skew));
    top: 102%;
    z-index: -1;
  }

  &:hover::before {
    --progress: 100%;
  }

  &:hover::after {
    --progress: -102%;
  }

  .text-container {
    display: block;
    position: relative;
    overflow: hidden;
  }

  .text {
    display: block;
    position: relative;
    transition: color 200ms ease;
  }

  &:hover .text {
    animation:
      ${moveUpAlternate} 300ms forwards,
      ${textSwap} 300ms forwards;
  }

  @media (prefers-reduced-motion: reduce) {
    &::before,
    &::after {
      transition: none;
    }

    &:hover .text {
      animation: none;
      color: var(--btn-fg-on);
    }
  }
`
