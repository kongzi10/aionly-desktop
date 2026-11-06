import { Modal } from 'antd'
import { css, styled } from 'styled-components'

/**
 * Select / Tooltip 的浮层默认挂在 body 上，会绕开弹窗内的作用域样式，
 * 造成「弹窗是中性灰、下拉却还是品牌蓝」。统一挂进所在弹窗里，
 * 让浮层与弹窗共用同一套灰阶规则。
 * 注意必须挂到 .ant-modal-content 而不是 .ant-modal：antd 给 .ant-modal
 * 设置了 pointer-events: none（仅 content 恢复 auto），挂在外层会让
 * 下拉浮层整体不可点击（能展开但点选项无反应）。
 */
export const getModalPopupContainer = (trigger: HTMLElement): HTMLElement =>
  (trigger.closest('.ant-modal-content') as HTMLElement | null) ?? document.body

/**
 * 弹窗外壳：全部 Agent 路由弹窗共用。
 * 以中性灰阶打底（描边、底色、分割线），只保留一处克制的强调色：
 * 主操作按钮、选中态、焦点光环、标题识别条。强调色不铺面积、
 * 不做大面积染色，因此不会回到「满屏品牌蓝」的观感。
 */
const modalShell = css`
  &&& {
    /* 强调色（浅色模式）：比品牌蓝更沉一点，降低饱和度，避免弹窗里过于跳 */
    --ar-accent: rgb(56 108 222);
    --ar-accent-strong: rgb(38 86 196);
    --ar-accent-ink: #ffffff;
    --ar-accent-tint: rgb(56 108 222 / 7%);
    --ar-accent-tint-strong: rgb(56 108 222 / 13%);
    --ar-accent-border: rgb(56 108 222 / 32%);
    --ar-accent-ring: rgb(56 108 222 / 15%);
    --ar-shadow: 0 18px 44px rgb(0 0 0 / 10%);
  }

  body.dark &&& {
    /* 深色模式下强调色要提亮，并用深色字压在浅蓝底上保证对比度 */
    --ar-accent: rgb(104 150 255);
    --ar-accent-strong: rgb(132 172 255);
    --ar-accent-ink: rgb(10 14 24);
    --ar-accent-tint: rgb(104 150 255 / 12%);
    --ar-accent-tint-strong: rgb(104 150 255 / 20%);
    --ar-accent-border: rgb(104 150 255 / 38%);
    --ar-accent-ring: rgb(104 150 255 / 18%);
    --ar-shadow: 0 20px 52px rgb(0 0 0 / 46%);
  }

  &&& .ant-modal-content {
    padding: 20px;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: var(--modal-background);
    box-shadow: var(--ar-shadow);
  }

  &&& .ant-modal-content .ant-modal-header {
    margin: 0 0 16px;
    padding: 0 0 12px;
    border-bottom: 1px solid var(--color-border-soft);
    background: transparent;
  }

  /* 标题左侧一条 3px 竖色条：全弹窗唯一常驻的有色元素，用于识别层级 */
  &&& .ant-modal-content .ant-modal-title {
    position: relative;
    padding-right: 24px;
    padding-left: 11px;
    color: var(--color-text-1);
    font-size: 15px;
    font-weight: 650;
    letter-spacing: 0.01em;
  }

  &&& .ant-modal-content .ant-modal-title::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    width: 3px;
    height: 13px;
    border-radius: 999px;
    background: var(--ar-accent);
    opacity: 0.8;
    transform: translateY(-50%);
  }

  &&& .ant-modal-content .ant-modal-body {
    padding: 0;
  }

  &&& .ant-modal-content .ant-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin: 16px 0 0;
    padding: 12px 0 0;
    border-top: 1px solid var(--color-border-soft);
  }

  &&& .ant-modal-close {
    inset-inline-end: 12px;
    top: 13px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    color: var(--color-text-3);
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  &&& .ant-modal-close:hover {
    background: var(--color-background-soft);
    color: var(--color-text-1);
  }

  /* 胶囊按钮：默认款是中性描边，主操作是墨色实心，危险操作保留红色语义 */
  &&& .ant-btn {
    height: 30px;
    padding: 0 15px;
    border-radius: 999px;
    font-size: 12.5px;
    font-weight: 600;
    box-shadow: none;
  }

  &&& .ant-btn-default {
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-2);
  }

  &&& .ant-btn-default:not(:disabled):hover {
    border-color: var(--color-text-3);
    background: var(--color-background-soft);
    color: var(--color-text-1);
  }

  &&& .ant-btn-primary {
    border-color: transparent;
    background: var(--ar-accent);
    color: var(--ar-accent-ink);
  }

  &&& .ant-btn-primary:not(:disabled):hover {
    background: var(--ar-accent-strong);
    color: var(--ar-accent-ink);
  }

  &&& .ant-btn-dangerous.ant-btn-primary {
    background: var(--color-error);
    color: #fff;
    opacity: 1;
  }

  &&& .ant-btn-dangerous.ant-btn-default {
    border-color: rgb(255 77 80 / 32%);
    background: transparent;
    color: var(--color-error);
  }

  &&& .ant-btn-dangerous.ant-btn-default:not(:disabled):hover {
    border-color: rgb(255 77 80 / 52%);
    background: rgb(255 77 80 / 8%);
    color: var(--color-error);
  }

  &&& .ant-btn:disabled,
  &&& .ant-btn.ant-btn-disabled {
    border-color: var(--color-border) !important;
    background: var(--color-background-soft) !important;
    color: var(--color-text-3) !important;
    opacity: 1;
  }

  &&& .ant-btn:focus-visible {
    outline: 2px solid var(--color-text-3);
    outline-offset: 2px;
  }

  /* 输入类控件：统一 10px 圆角 + 表面色底 + 中性描边，聚焦只用灰阶光环 */
  &&& .ant-input,
  &&& .ant-input-affix-wrapper,
  &&& .ant-input-number,
  &&& .ant-select .ant-select-selector {
    border: 1px solid var(--color-border) !important;
    border-radius: 10px !important;
    background: var(--color-background) !important;
    box-shadow: none !important;
  }

  &&& .ant-input-affix-wrapper > .ant-input {
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  &&& .ant-input:focus,
  &&& .ant-input-focused,
  &&& .ant-input-affix-wrapper-focused,
  &&& .ant-select-focused .ant-select-selector {
    border-color: var(--ar-accent-border) !important;
    box-shadow: 0 0 0 3px var(--ar-accent-ring) !important;
  }

  &&& .ant-select-single {
    height: 32px;
    width: 100%;
  }

  &&& .ant-select-arrow,
  &&& .ant-select-clear {
    color: var(--color-text-3);
  }

  /* 单选 / 复选 / 开关：勾选态用低饱和强调色，未选中仍是中性描边 */
  &&& .ant-radio-wrapper {
    color: var(--color-text-2);
    font-size: 12.5px;
  }

  &&& .ant-radio-wrapper .ant-radio-inner {
    border-color: var(--color-border);
    background: transparent;
  }

  &&& .ant-radio-wrapper-checked .ant-radio-inner {
    border-color: var(--ar-accent);
    background: var(--ar-accent);
  }

  &&& .ant-radio-wrapper-checked .ant-radio-inner::after {
    background: var(--ar-accent-ink);
  }

  &&& .ant-checkbox .ant-checkbox-inner {
    border-color: var(--color-border);
    border-radius: 5px;
    background: var(--color-background);
  }

  &&& .ant-checkbox-checked .ant-checkbox-inner {
    border-color: var(--ar-accent);
    background: var(--ar-accent);
  }

  &&& .ant-checkbox-checked .ant-checkbox-inner::after {
    border-color: var(--ar-accent-ink);
  }

  &&& .ant-switch.ant-switch-checked {
    background: var(--ar-accent);
  }

  /* 加载中的旋转点也是灰阶，不引入品牌蓝 */
  &&& .ant-spin .ant-spin-dot-item {
    background-color: var(--color-text-2);
  }

  /* 下拉浮层跟随弹窗（见 getModalPopupContainer），悬停保持中性、仅选中态着色 */
  &&& .ant-select-dropdown {
    padding: 4px;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--modal-background);
    box-shadow: 0 13px 32px rgb(0 0 0 / 12%);
  }

  &&& .ant-select-item {
    border-radius: 8px;
    font-size: 12.5px;
  }

  &&& .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
    background: var(--color-background-soft);
  }

  &&& .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
    background: var(--ar-accent-tint-strong);
    color: var(--ar-accent-strong);
    font-weight: 600;
  }
`

export const RouteFormModal = styled(Modal)`
  ${modalShell}

  .ant-form-item {
    margin-bottom: 12px;
  }

  .ant-form-item:last-child {
    margin-bottom: 0;
  }

  .ant-form-item-row {
    flex-wrap: nowrap;
    align-items: flex-start;
  }

  .ant-form-item-label {
    flex: 0 0 86px;
    padding: 0;
  }

  .ant-form-item-label > label {
    height: 32px;
    color: var(--color-text-2);
    font-size: 12.5px;
    font-weight: 600;
  }

  .ant-form-item-control {
    min-width: 0;
    flex: 1;
  }

  .ant-form-item-explain-error {
    margin-top: 4px;
    font-size: 11.5px;
  }

  .ant-radio-group {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    min-height: 32px;
  }
`

/** 弹窗内的次级说明文案 */
export const ModalHint = styled.p`
  margin: 0 0 12px;
  color: var(--color-text-3);
  font-size: 11.5px;
  line-height: 1.55;
`

/** 统一的二次确认弹窗：短标题 + 一行说明 + 右对齐胶囊按钮 */
export const ConfirmDialog = styled(Modal).attrs({ centered: true, width: 380 })`
  ${modalShell}

  &&& .ant-modal-content .ant-modal-header {
    margin: 0 0 10px;
  }

  &&& .ant-modal-content .ant-modal-body {
    color: var(--color-text-2);
    font-size: 13px;
    line-height: 1.6;
  }
`
