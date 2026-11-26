/**
 * 切换身份右侧抽屉面板样式（视觉规格来源：docs/切换身份改造/样式方案V2-右侧抽屉面板.html）。
 *
 * 亮色对齐 V2 原稿调色板；暗色经 `[theme-mode='dark']` 局部覆盖（对齐 V2 dark 模式），
 * 品牌色统一走全局 --color-primary / --color-primary-light。
 */

import styled from 'styled-components'

/** V2 头像渐变调色板（按账号稳定散列取色） */
export const AVATAR_GRADS: Array<[string, string]> = [
  ['#2E6BFF', '#7B5AFF'],
  ['#FF7A45', '#FF4D6D'],
  ['#00B578', '#0FB9B1'],
  ['#F59E0B', '#F5533D'],
  ['#8A2BE2', '#4A90FF'],
  ['#0EA5E9', '#2E6BFF']
]

export const pickAvatarGrad = (seed: string, index: number): [string, string] => {
  const list = AVATAR_GRADS
  let h = 0
  for (let i = 0; i < (seed || '').length; i++) h = (h * 131 + seed.charCodeAt(i)) % 997
  return list[(h + index) % list.length]
}

/** 抽屉根容器：定义局部主题变量（明暗两套），铺满 Drawer body */
export const IdentityRoot = styled.div`
  --is-card-bg: #ffffff;
  --is-card-brd: #e6e8ee;
  --is-line2: #7a839a;
  --is-green: #18a058;
  --is-tag-main-bg: rgba(46, 107, 255, 0.08);
  --is-tag-main-color: #2e6bff;
  --is-tag-sub-bg: rgba(255, 122, 69, 0.1);
  --is-tag-sub-color: #ff7a45;
  --is-skl-from: #eef1f6;
  --is-skl-to: #f7f9fc;

  [theme-mode='dark'] & {
    --is-card-bg: rgba(255, 255, 255, 0.045);
    --is-card-brd: rgba(255, 255, 255, 0.09);
    --is-line2: #8a93a6;
    --is-green: #4ade80;
    --is-tag-main-bg: rgba(74, 144, 255, 0.18);
    --is-tag-main-color: #9dbcff;
    --is-tag-sub-bg: rgba(255, 122, 69, 0.18);
    --is-tag-sub-color: #ffb38a;
    --is-skl-from: rgba(255, 255, 255, 0.05);
    --is-skl-to: rgba(255, 255, 255, 0.09);
    background: #222222;
  }

  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f7f8fc;
  overflow: hidden;
`

/* ============ 顶部：标题行 + 当前身份卡（方案C 极简线框 · 信息分层） ============ */
/* 视觉规格来源：docs/切换身份改造/当前身份卡片重设计/方案C-极简线框分层卡.html */

export const HeroHead = styled.div`
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 12px;

  .hero-title {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 0.4px;
    color: var(--color-text);
  }
`

export const HeroCloseBtn = styled.button`
  background: transparent;
  border: none;
  color: var(--color-gray-1);
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  flex: 0 0 auto;

  &:hover {
    background: rgba(120, 130, 150, 0.14);
    color: var(--color-text);
  }
`

/** 当前身份卡：发丝边框 + 左侧品牌色标 + 三段信息分层（标签行 / 身份行 / 凭证行） */
export const MeCard = styled.div`
  position: relative;
  flex: 0 0 auto;
  margin: 0 16px 8px;
  background: var(--is-card-bg);
  border: 1px solid var(--is-card-brd);
  border-radius: 12px;
  padding: 12px 16px 10px 19px;
  transition:
    border-color 0.18s,
    box-shadow 0.18s,
    transform 0.18s;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: linear-gradient(180deg, var(--color-primary), var(--color-primary-light));
    transition:
      top 0.18s,
      bottom 0.18s;
  }
  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 6px 18px rgba(20, 30, 60, 0.07);
    transform: translateY(-1px);
  }
  &:hover::before {
    top: 8px;
    bottom: 8px;
  }

  .mc-r1 {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .mc-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.4px;
    color: var(--is-line2);
    text-transform: uppercase;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mc-badge {
    flex: 0 0 auto;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--is-tag-main-color);
    background: var(--is-tag-main-bg);
    border: 1px solid var(--is-tag-main-color);
    border-radius: 6px;
    padding: 1.5px 8px;
    letter-spacing: 0.3px;
  }
  .mc-badge.is-sub {
    color: var(--is-tag-sub-color);
    background: var(--is-tag-sub-bg);
    border-color: var(--is-tag-sub-color);
  }

  .mc-r2 {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .mc-mid {
    flex: 1;
    min-width: 0;
  }
  .mc-name {
    font-size: 15.5px;
    font-weight: 700;
    letter-spacing: 0.2px;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mc-acc {
    font-size: 12.5px;
    color: var(--is-line2);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.4px;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mc-r3 {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-top: 11px;
    padding-top: 9px;
    border-top: 1px solid var(--is-card-brd);
  }
  .mc-id {
    font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
    font-size: 12px;
    color: var(--is-line2);
    letter-spacing: 0.6px;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    b {
      color: var(--color-text);
      font-weight: 600;
      margin-right: 6px;
    }
  }
  .mc-status {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--is-green);
  }
  .mc-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--is-green);
  }
`

/** 当前身份头像：44px 圆角方形，与历史列表的圆形头像形成形态区分 */
export const MeAvatar = styled.div<{ $g: [string, string] }>`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: #fff;
  background: linear-gradient(135deg, ${(p) => p.$g[0]}, ${(p) => p.$g[1]});
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

/* ===================== 列表区 ===================== */

export const Body = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 20px 20px 8px;
  display: flex;
  flex-direction: column;
`

export const SectionHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;

  .sh-title {
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--color-text);
  }
  .sh-title::before {
    content: '';
    width: 3px;
    height: 14px;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--color-primary), var(--color-primary-light));
  }
`

/** 管理文字按钮：替代原开关，点击进入/退出管理模式 */
export const ManageBtn = styled.button<{ $on: boolean }>`
  background: ${(p) => (p.$on ? 'var(--is-tag-main-bg)' : 'transparent')};
  border: none;
  color: var(--color-primary);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 4px 10px;
  border-radius: 7px;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
  flex: 0 0 auto;

  &:hover {
    background: ${(p) => (p.$on ? 'var(--is-tag-main-bg)' : 'rgba(120, 130, 150, 0.12)')};
  }
`

export const CountRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin: -6px 0 14px;
  font-size: 11.5px;
  color: var(--color-gray-1);
  padding-left: 1px;
`

export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
`

/* ===================== 账号卡片 ===================== */

export const Card = styled.div`
  background: var(--is-card-bg);
  border: 1.5px solid var(--is-card-brd);
  border-radius: 14px;
  padding: 13px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition:
    transform 0.18s cubic-bezier(0.34, 1.2, 0.64, 1),
    box-shadow 0.18s,
    border-color 0.18s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(20, 30, 60, 0.08);
    border-color: var(--color-primary);
  }
`

export const CardAvatar = styled.div<{ $g: [string, string] }>`
  width: 42px;
  height: 42px;
  border-radius: 50%;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: #fff;
  background: linear-gradient(135deg, ${(p) => p.$g[0]}, ${(p) => p.$g[1]});
  overflow: hidden;
  box-shadow: 0 3px 8px rgba(20, 30, 60, 0.16);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const CardInfo = styled.div`
  flex: 1;
  min-width: 0;

  .line1 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .acc {
    font-size: 14.5px;
    font-weight: 700;
    letter-spacing: 0.3px;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text);
  }
  .tag {
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 6px;
    letter-spacing: 0.3px;
  }
  .tag-main {
    background: var(--is-tag-main-bg);
    color: var(--is-tag-main-color);
  }
  .tag-sub {
    background: var(--is-tag-sub-bg);
    color: var(--is-tag-sub-color);
  }
  .line2 {
    font-size: 12px;
    color: var(--is-line2);
    display: flex;
    align-items: center;
    gap: 5px;
    overflow: hidden;
  }
  .line2 span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const CardRight = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
`

export const SwitchBtn = styled.button`
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  border: none;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition:
    opacity 0.2s,
    transform 0.15s;
  box-shadow: 0 2px 8px rgba(46, 107, 255, 0.32);

  svg {
    color: #fff;
  }

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`

export const DeleteBtn = styled.button`
  background: rgba(245, 83, 61, 0.09);
  border: none;
  color: #f5533d;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.15s;

  &:hover {
    background: rgba(245, 83, 61, 0.16);
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`

/* ===================== 骨架屏 / 空态 / 错误条 ===================== */

export const SklCard = styled.div`
  background: var(--is-card-bg);
  border: 1.5px solid var(--is-card-brd);
  border-radius: 14px;
  padding: 13px 14px;
  display: flex;
  align-items: center;
  gap: 12px;

  .skl-circle {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex: 0 0 auto;
  }
  .skl-lines {
    flex: 1;
  }
  .skl-line {
    height: 11px;
    border-radius: 6px;
  }
  .skl-line.w60 {
    width: 60%;
    margin-bottom: 8px;
  }
  .skl-line.w40 {
    width: 40%;
  }
  .skl-pill {
    width: 58px;
    height: 30px;
    border-radius: 8px;
    flex: 0 0 auto;
  }

  .skl-anim {
    background: linear-gradient(90deg, var(--is-skl-from) 25%, var(--is-skl-to) 50%, var(--is-skl-from) 75%);
    background-size: 200% 100%;
    animation: skl-shimmer 1.4s ease-in-out infinite;
  }

  @keyframes skl-shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`

export const Empty = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 0;
  text-align: center;

  .empty-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(46, 107, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary);
  }
  .empty-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-text);
  }
  .empty-desc {
    font-size: 13px;
    color: var(--color-gray-1);
    line-height: 1.5;
    max-width: 240px;
  }
`

export const NoOthers = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gray-1);
  font-size: 13px;
  padding: 30px 0;
`

export const ErrorBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -6px 0 12px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  background: rgba(245, 83, 61, 0.08);
  color: #f5533d;
  border: 1px solid rgba(245, 83, 61, 0.2);

  .err-text {
    flex: 1;
  }
  .err-retry {
    background: none;
    border: none;
    color: var(--color-primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }
`

/* ===================== 底部：登录其他账号 ===================== */

export const Footer = styled.div`
  padding: 12px 20px 18px;
`

export const LoginOtherBtn = styled.button`
  width: 100%;
  background: rgba(46, 107, 255, 0.05);
  border: 1.5px dashed rgba(46, 107, 255, 0.4);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition:
    background 0.2s,
    border-color 0.2s;

  &:hover {
    background: rgba(46, 107, 255, 0.1);
    border-color: var(--color-primary);
  }
`
