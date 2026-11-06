import { getModelLogoById } from '@renderer/config/models/logo'
import AiOnlyAddModelPopup from '@renderer/pages/settings/ProviderSettings/AiOnlyModel/add/AddModelPopup'
import { Sparkles } from 'lucide-react'
import type { AnimationEvent, FC } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { css, keyframes } from 'styled-components'

import type { HomePushItem } from './homeContent'

interface Props {
  items: HomePushItem[]
}

interface AnnouncementEntry {
  id: string
  content: string
  logo?: string
}

const ROW_HEIGHT = 20
const MAX_ROW_WIDTH = 380
const SPIN_INTERVAL = 2600
// 滚轮窗口在行高/行宽之外预留的光晕余量：CTA 呼吸光晕在 overflow:hidden 的
// 窗口内绘制，若无余量会被裁出直边（“方框”），余量需 >= 光晕最大扩散半径
const GLOW_SLACK_X = 4
const GLOW_SLACK_Y = 4
// 行距 = 行高 + 上下光晕余量：静止时下一条公告需完整落在窗口裁剪区之外，
// 否则其顶部会从胶囊下方漏出半截；滚动位移也按该行距整行推进
const ROW_PITCH = ROW_HEIGHT + GLOW_SLACK_Y * 2

// 整行内容（logo + 完整文案）直接来自接口推送并参与轮播；
// 仅用文案中“已上架/上架了/…”之前的部分匹配模型 logo，匹配不到时回退为完整内容
const NAME_PATTERN = /^(.*?)(?:已上架|上架了|is now live|now available|has been released)/i

// 高亮行动标签（立即开通）显隐判定：
// 1) 文案需包含明确的“开通 / 体验 / 模型服务”类动作词（“上架”单独出现不代表可开通，
//    如“tokenplan 上架了，订阅套餐更灵活”属于订阅套餐公告，不应出现开通入口）；
// 2) 同时排除订阅/套餐/会员/价格类文案，避免误展示
const ENABLE_PATTERN = /开通|体验|模型服务|enable|activate/i
const DISABLE_PATTERN = /订阅|套餐|会员|价格|充值|plan|subscription|pricing|price/i

function toEntry(item: HomePushItem): AnnouncementEntry {
  const content = (item.content ?? '').trim()
  const name = content.match(NAME_PATTERN)?.[1]?.trim() || content
  return { id: item.id, content, logo: getModelLogoById(name) }
}

function isEnableEntry(entry?: AnnouncementEntry): boolean {
  if (!entry) return false
  return ENABLE_PATTERN.test(entry.content) && !DISABLE_PATTERN.test(entry.content)
}

const reelSpin = keyframes`
  0% {
    transform: translateY(0);
    filter: blur(0);
  }
  25% {
    filter: blur(2.5px);
  }
  60% {
    filter: blur(1.2px);
  }
  82% {
    transform: translateY(-${ROW_PITCH + 2}px);
    filter: blur(0);
  }
  100% {
    transform: translateY(-${ROW_PITCH}px);
    filter: blur(0);
  }
`

const HomeAnnouncements: FC<Props> = ({ items }) => {
  const { t } = useTranslation()
  const entries = useMemo(() => items.map(toEntry), [items])
  const count = entries.length
  const [index, setIndex] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const pausedRef = useRef(false)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [rowWidths, setRowWidths] = useState<Record<string, number>>({})

  const rows = count > 1 ? [entries[index % count], entries[(index + 1) % count]] : count === 1 ? [entries[0]] : []

  // 测量每行自然宽度（滚轮宽度为 max-content，行宽不受窗口宽度影响），
  // 供胶囊窗口宽度跟随当前行自适应
  useLayoutEffect(() => {
    setRowWidths((prev) => {
      let changed = false
      const next = { ...prev }
      for (const row of rows) {
        const el = rowRefs.current[row.id]
        if (!el) continue
        const w = el.offsetWidth
        if (next[row.id] !== w) {
          next[row.id] = w
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [rows])

  // 首页「立即开通」直接复用设置-模型服务中的添加模型弹窗，
  // 功能与模型分组排序与其保持完全一致
  const handleActivate = useCallback(() => {
    void AiOnlyAddModelPopup.show({})
  }, [])

  useEffect(() => {
    setIndex((i) => (count ? i % count : 0))
  }, [count])

  // 轮播仅触发滚轮动画，与内容渲染分离：文字刷新不会打断当前滚动
  useEffect(() => {
    if (count < 2) return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    const timer = window.setInterval(() => {
      if (!pausedRef.current) setSpinning(true)
    }, SPIN_INTERVAL)
    return () => window.clearInterval(timer)
  }, [count])

  if (count === 0) return null

  // 窗口宽度跟随当前展示行；滚动期间同步过渡到下一行宽度，避免胶囊残留空白
  const currentWidth = rowWidths[rows[0]?.id ?? '']
  const nextWidth = rows[1] ? rowWidths[rows[1].id] : currentWidth
  const targetWidth = spinning ? (nextWidth ?? currentWidth) : currentWidth
  const windowWidth = targetWidth ? Math.min(targetWidth, MAX_ROW_WIDTH) + GLOW_SLACK_X * 2 : undefined

  const handleSpinEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    setSpinning(false)
    setIndex((i) => (i + 1) % count)
  }

  return (
    <Viewport
      aria-label={t('homeLanding.announcements')}
      onMouseEnter={() => {
        pausedRef.current = true
      }}
      onMouseLeave={() => {
        pausedRef.current = false
      }}>
      <Pill>
        <Window $width={windowWidth}>
          <Reel $spinning={spinning} onAnimationEnd={handleSpinEnd}>
            {rows.map((row) => (
              <Row
                key={row.id}
                ref={(el) => {
                  rowRefs.current[row.id] = el
                }}>
                {row.logo ? <Logo src={row.logo} alt="" /> : <Sparkles size={13} aria-hidden="true" />}
                <Text title={row.content}>{row.content}</Text>
                {isEnableEntry(row) && (
                  <ActivateTag
                    type="button"
                    onClick={handleActivate}
                    aria-label={t('homeLanding.announcementActivate')}>
                    <Sparkles size={10} aria-hidden="true" />
                    {t('homeLanding.announcementActivate')}
                  </ActivateTag>
                )}
              </Row>
            ))}
          </Reel>
        </Window>
      </Pill>
    </Viewport>
  )
}

// 布局盒：单行胶囊，水平居中
const Viewport = styled.section`
  display: flex;
  justify-content: center;
  width: 100%;
  min-width: 0;
`

const Pill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  box-sizing: border-box;
  max-width: 100%;
  height: 31px;
  padding: 5px 11px;
  border: 1px solid rgb(129 174 237 / 23%);
  border-radius: 100px;
  background: rgb(235 245 255 / 68%);
  color: #44618a;
  font-size: 12px;
  white-space: nowrap;
  backdrop-filter: blur(6px);
  box-shadow: 0 2px 10px rgb(92 124 255 / 6%);
`

// 整行滚轮窗口：宽度跟随当前展示行（滚动时同步过渡到下一行宽度），
// 未测量完成前回退 max-content；超长时截断，避免胶囊无限拉伸。
// 窗口四周预留光晕余量（padding + 加高），避免 overflow:hidden 把
// CTA 呼吸光晕裁出直边方框；加高后的总高（28px）仍落在胶囊 padding box
// （29px）内，保证光晕与滚动内容都不会画出胶囊外
const Window = styled.div<{ $width?: number }>`
  position: relative;
  flex: 0 1 auto;
  box-sizing: border-box;
  width: ${({ $width }) => ($width ? `${$width}px` : 'max-content')};
  max-width: ${MAX_ROW_WIDTH + GLOW_SLACK_X * 2}px;
  height: ${ROW_PITCH}px;
  padding: 0 ${GLOW_SLACK_X}px;
  overflow: hidden;
  transition: width 620ms cubic-bezier(0.3, 0.75, 0.35, 1);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Reel = styled.div<{ $spinning: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: max-content;
  margin-top: ${GLOW_SLACK_Y}px;
  will-change: transform, filter;

  ${({ $spinning }) =>
    $spinning &&
    css`
      animation: ${reelSpin} 620ms cubic-bezier(0.3, 0.75, 0.35, 1) forwards;
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Row = styled.div`
  display: flex;
  flex: 0 0 ${ROW_HEIGHT}px;
  align-items: center;
  gap: 5px;
  height: ${ROW_HEIGHT}px;
  max-width: ${MAX_ROW_WIDTH}px;
  /* 行距撑到 ROW_PITCH：静止时下一行完整位于窗口裁剪区之外，不会漏出半截 */
  margin-bottom: ${GLOW_SLACK_Y * 2}px;

  svg {
    flex-shrink: 0;
    color: #5c7cff;
  }
`

const Logo = styled.img`
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  object-fit: contain;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgb(20 40 90 / 25%);
`

const Text = styled.span`
  flex: 1 1 auto;
  overflow: hidden;
  min-width: 0;
  color: #2b4a86;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`

// 呼吸光晕扩散半径收敛在窗口光晕余量（4px）内，避免被裁出直边
const tagBreathe = keyframes`
  0%, 100% {
    box-shadow: 0 0 3px rgb(76 125 255 / 40%);
  }
  50% {
    box-shadow: 0 0 4px rgb(76 125 255 / 60%);
  }
`

// 高亮行动标签：随所在滚动行同帧进出；仅当该行公告为“模型开通体验”类时渲染，
// 点击跳转并弹出开通弹窗
const ActivateTag = styled.button`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 19px;
  margin-left: 2px;
  padding: 0 9px;
  border: 0;
  border-radius: 100px;
  background: linear-gradient(135deg, #4c7dff, #7e9bff);
  color: #fff;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 0 3px rgb(76 125 255 / 45%);
  animation: ${tagBreathe} 1.8s ease-in-out infinite;
  transition: transform 0.1s;

  svg {
    color: #fff;
  }

  &:hover {
    filter: brightness(1.07);
  }

  &:active {
    transform: scale(0.95);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export default HomeAnnouncements
