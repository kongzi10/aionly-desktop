/**
 * API 密钥管理弹窗样式（布局来源：docs/APIKey禁启用适配与样式重设计/样式方案V3-玻璃拟态卡片.html · 第二轮重设计版）。
 *
 * 结构：头部 → 告警条 → 四格统计条（可切换状态查询）→ 工具条（搜索/排序/添加）→ 三列卡片网格 → 分页底栏。
 * 配色与桌面端整体色调对齐：主色走 --color-primary（#1677ff）体系，浅色为浅蓝灰底 + 白卡片 + 发丝边框，
 * 暗色经 `[theme-mode='dark']` 局部覆盖；局部变量统一 `--ak-` 前缀。
 */

import styled from 'styled-components'

/** 弹窗根容器：定义局部主题变量（明暗两套）+ 浅蓝氛围装饰背景 */
export const GlassRoot = styled.div`
  --ak-brand: var(--color-primary);
  --ak-brand-2: var(--color-primary-light);
  --ak-card: #ffffff;
  --ak-card-brd: var(--color-border);
  --ak-glass-2: rgba(0, 0, 0, 0.03);
  --ak-ok: #16a34a;
  --ak-ok-soft: rgba(22, 163, 74, 0.12);
  --ak-danger: var(--color-error);
  --ak-danger-soft: rgba(255, 77, 80, 0.12);
  --ak-warn: #ad6800;
  --ak-warn-soft: rgba(250, 173, 20, 0.14);
  --ak-warn-glass: #fffbe6;
  --ak-warn-brd: rgba(250, 173, 20, 0.35);
  --ak-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);

  position: relative;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 120px);
  border-radius: 14px;
  overflow: hidden;
  background: var(--color-background-opacity);

  [theme-mode='dark'] & {
    --ak-card: #1f1f1f;
    --ak-glass-2: rgba(255, 255, 255, 0.06);
    --ak-ok: #4ade80;
    --ak-ok-soft: rgba(74, 222, 128, 0.16);
    --ak-danger-soft: rgba(255, 77, 80, 0.16);
    --ak-warn: #faad14;
    --ak-warn-soft: rgba(250, 173, 20, 0.14);
    --ak-warn-glass: rgba(250, 173, 20, 0.1);
    --ak-warn-brd: rgba(250, 173, 20, 0.3);
    --ak-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    background: var(--modal-background);
  }

  /* 浅蓝氛围层（呼应设置页顶部横幅的淡蓝渐变） */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(420px 240px at 6% 0%, rgba(22, 119, 255, 0.07), transparent 60%),
      radial-gradient(460px 280px at 98% 100%, rgba(22, 119, 255, 0.05), transparent 62%);
  }
  [theme-mode='dark'] &::before {
    background:
      radial-gradient(420px 240px at 6% 0%, rgba(22, 119, 255, 0.1), transparent 60%),
      radial-gradient(460px 280px at 98% 100%, rgba(22, 119, 255, 0.07), transparent 62%);
  }

  > * {
    position: relative;
    z-index: 1;
  }

  /* Spin 包裹层不打断 flex 滚动链（列表区仍可独立滚动） */
  > .ant-spin-nested-loading {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;

    > .ant-spin-container {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
  }
`

/* ===================== 头部：Orb + 标题 + 配额 ===================== */

export const HeadRow = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 16px 22px 10px;

  .orb {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: linear-gradient(135deg, var(--ak-brand), var(--ak-brand-2));
    box-shadow: 0 6px 16px rgba(22, 119, 255, 0.3);
  }
  .titles {
    flex: 1;
    min-width: 0;
  }
  .titles h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.2px;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .quota {
    font-size: 12px;
    color: var(--color-text-3);
    margin-top: 2px;

    b {
      font-weight: 700;
      color: var(--ak-brand);
    }
  }
  .close {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ak-glass-2);
    border: 1px solid var(--ak-card-brd);
    color: var(--color-text-2);
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s;

    &:hover {
      color: var(--color-text);
      background: var(--ak-card);
    }
  }
`

/* ===================== 使用中密钥被禁用的告警条 ===================== */

export const WarnBar = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 22px 10px;
  padding: 9px 13px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ak-warn);
  background: var(--ak-warn-glass);
  border: 1px solid var(--ak-warn-brd);

  .warn-icon {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }
  .warn-text {
    flex: 1;
    min-width: 0;
  }
  .warn-action {
    flex: 0 0 auto;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    color: var(--ak-warn);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`

/* ===================== 四格统计条（可点击切换状态查询） ===================== */

export const StatsRow = styled.div`
  flex: 0 0 auto;
  display: flex;
  gap: 10px;
  padding: 0 22px 10px;

  .stat {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 7px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--ak-card);
    border: 1px solid var(--ak-card-brd);
    appearance: none;
    text-align: left;
    font-family: inherit;
    cursor: pointer;
    transition:
      border-color 0.15s,
      box-shadow 0.15s,
      background 0.15s;

    &:hover {
      border-color: var(--ak-brand);
    }
    &.act {
      border-color: var(--ak-brand);
      background: rgba(22, 119, 255, 0.06);
      box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12);
    }
  }
  .stat .n {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.4px;
    color: var(--color-text);
    line-height: 1.1;
  }
  .stat .l {
    font-size: 11px;
    color: var(--color-text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stat.g .n {
    color: var(--ak-ok);
  }
  .stat.a .n {
    color: var(--ak-warn);
  }
  .stat.p .n {
    color: var(--ak-brand);
  }
`

/* ===================== 工具条：搜索 + 排序 + 添加 ===================== */

export const ToolRow = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 22px 10px;

  .search {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 11px;
    border-radius: 10px;
    background: var(--ak-card);
    border: 1px solid var(--ak-card-brd);
    transition:
      border-color 0.15s,
      box-shadow 0.15s;

    &:focus-within {
      border-color: var(--ak-brand);
      box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12);
    }
    .sic {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      color: var(--color-text-3);
    }
    input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--color-text);
      font-size: 12.5px;

      &::placeholder {
        color: var(--color-text-3);
      }
    }
    .clr {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      border: 0;
      background: none;
      padding: 0;
      color: var(--color-text-3);
      cursor: pointer;

      &:hover {
        color: var(--color-text);
      }
    }
  }

  .sortsel {
    flex: 0 0 auto;
    width: 112px;
  }
  .sortsel .ant-select-selector {
    border-radius: 10px !important;
    background: var(--ak-card) !important;
    border-color: var(--ak-card-brd) !important;
  }
  .sortsel .ant-select-selection-item {
    font-size: 12px;
    color: var(--color-text-2);
  }
`

/** 工具条右侧的主色「添加」按钮 */
export const AddBtn = styled.button`
  flex: 0 0 auto;
  height: 32px;
  padding: 0 15px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  color: #fff;
  font-size: 12.5px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, var(--ak-brand), var(--ak-brand-2));
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.3);
  transition:
    filter 0.15s,
    transform 0.15s;

  &:hover {
    filter: brightness(1.07);
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }
`

/* ===================== 卡片网格滚动区 ===================== */

export const ListBody = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 22px 8px;

  /* 仅当手动切换到大每页条数时才出现细滚动条，默认不占视觉 */
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 126, 150, 0.35) transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(120, 126, 150, 0.35);

    &:hover {
      background: rgba(120, 126, 150, 0.55);
    }
  }
`

/** 三列卡片网格（视口收窄时降为双列/单列） */
export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }
  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`

/** 单把钥匙卡片（纵向三段式）：白卡 + 发丝边框 + 使用中主色描边 + 悬停顶部高光线 + 禁用降透明度 */
export const KeyCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 11px 13px;
  border-radius: 12px;
  background: var(--ak-card);
  border: 1px solid var(--ak-card-brd);
  overflow: hidden;
  transition:
    transform 0.15s,
    box-shadow 0.15s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--ak-shadow);
  }

  /* 悬停顶部高光线 */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--ak-brand), var(--ak-brand-2));
    opacity: 0;
    transition: opacity 0.15s;
    pointer-events: none;
  }
  &:hover::after {
    opacity: 1;
  }

  /* 使用中：主色描边 */
  &.inuse::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 12px;
    border: 1.5px solid transparent;
    background: linear-gradient(120deg, rgba(22, 119, 255, 0.55), rgba(74, 144, 255, 0.3), rgba(22, 119, 255, 0.5))
      border-box;
    -webkit-mask:
      linear-gradient(#fff 0 0) padding-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  &.disabled {
    opacity: 0.62;

    .ava {
      filter: grayscale(1);
    }
  }

  /* --- 第一段：头像 + 名称/徽标 + 状态开关 --- */
  .c1 {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ava {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: linear-gradient(135deg, var(--ak-brand), var(--ak-brand-2));
  }
  .cn {
    flex: 1;
    min-width: 0;
  }
  .cn .t {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cn .s {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 3px;
    min-width: 0;
  }
  .cn .s .tag {
    font-size: 10.5px;
    color: var(--ak-brand);
    background: rgba(22, 119, 255, 0.1);
    border-radius: 5px;
    padding: 1px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cn .s .inuse {
    flex: 0 0 auto;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--ak-warn);
    background: var(--ak-warn-soft);
    border-radius: 5px;
    padding: 1px 6px;
  }
  .cn .edit-input {
    border-radius: 8px;
  }

  /* 状态开关：启用为语义绿 */
  .ant-switch {
    flex: 0 0 auto;
    background: rgba(120, 126, 150, 0.35);
  }
  .ant-switch.ant-switch-checked {
    background: var(--ak-ok);
  }

  /* --- 第二段：密钥 + 复制 --- */
  .c2 {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 9px;
    border-radius: 8px;
    background: var(--ak-glass-2);
    border: 1px solid var(--ak-card-brd);
    min-width: 0;
  }
  .c2 .mono {
    flex: 1;
    min-width: 0;
    font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
    font-size: 11.5px;
    color: var(--color-text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .c2 .mono.strike {
    text-decoration: line-through;
    text-decoration-color: var(--ak-danger);
  }
  .c2 .copy-ctl {
    flex: 0 0 auto;
    margin: 0;
    line-height: 1;
  }
  .c2 .copy-ctl .ant-typography-copy {
    color: var(--color-text-3);
    transition: color 0.15s;

    &:hover {
      color: var(--ak-brand);
    }
    .anticon {
      font-size: 12px;
    }
  }

  /* --- 第三段：状态文本 + 操作按钮 --- */
  .c3 {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--color-text-3);
  }
  .c3 .st {
    font-weight: 600;
  }
  .c3 .st.on {
    color: var(--ak-ok);
  }
  .c3 .st.off {
    color: var(--color-text-3);
  }
  .c3 .sp {
    flex: 1;
  }
  .c3 .ops {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
`

/** 胶囊操作按钮（使用/编辑/删除、确认/取消） */
export const OpBtn = styled.button`
  font-size: 11.5px;
  color: var(--color-text-2);
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--ak-glass-2);
  border: 1px solid var(--ak-card-brd);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;

  &:hover {
    color: var(--ak-brand);
    border-color: var(--ak-brand);
  }
  &.danger:hover {
    color: var(--ak-danger);
    border-color: var(--ak-danger);
  }
  &.primary {
    color: var(--ak-brand);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;

    &:hover {
      color: var(--color-text-2);
      border-color: var(--ak-card-brd);
    }
    &.danger:hover {
      color: var(--color-text-2);
      border-color: var(--ak-card-brd);
    }
  }
`

/* ===================== 底栏：上限提示 + 分页 ===================== */

export const FooterBar = styled.div`
  flex: 0 0 auto;
  padding: 8px 22px 12px;
  border-top: 1px solid var(--ak-card-brd);

  .maxtip {
    text-align: center;
    font-size: 12px;
    color: var(--color-status-warning);
    margin-bottom: 6px;
  }

  .ant-pagination {
    display: flex;
    width: 100%;
    font-size: 12px;
  }
  .ant-pagination-total-text {
    flex: 1;
    color: var(--color-text-3);
  }
  .ant-pagination .ant-pagination-item,
  .ant-pagination .ant-pagination-prev .ant-pagination-item-link,
  .ant-pagination .ant-pagination-next .ant-pagination-item-link {
    background: var(--ak-card);
    border-color: var(--ak-card-brd);
    border-radius: 8px;
  }
  .ant-pagination .ant-pagination-item a {
    color: var(--color-text-2);
  }
  .ant-pagination .ant-pagination-item:hover a {
    color: var(--ak-brand);
  }
  .ant-pagination .ant-pagination-item-active {
    background: var(--ak-brand);
    border-color: transparent;
  }
  .ant-pagination .ant-pagination-item-active a {
    color: #fff !important;
  }
  .ant-pagination .ant-pagination-item-ellipsis {
    color: var(--color-text-3) !important;
  }
  .ant-pagination .ant-select-selector {
    background: var(--ak-card) !important;
    border-color: var(--ak-card-brd) !important;
    border-radius: 8px !important;
  }
`

/* ===================== 空态 ===================== */

export const EmptyState = styled.div`
  padding: 46px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;

  .empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ak-brand);
    background: rgba(22, 119, 255, 0.1);
  }
  .empty-text {
    font-size: 13px;
    color: var(--color-text-3);
  }
  .empty-reset {
    margin-top: 2px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--ak-card-brd);
    background: var(--ak-card);
    color: var(--ak-brand);
    border-radius: 10px;
    padding: 6px 16px;
    font-size: 12px;
    cursor: pointer;

    &:hover {
      border-color: var(--ak-brand);
    }
  }
`
