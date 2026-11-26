/**
 * 渲染进程功能开关：新增能力的一键回滚点（见 docs/模型限时折扣标签开发方案.md §10）
 */

/** 模型列表「限时折扣」标签（模型名称后、VIP 标签之后展示） */
export const FEATURE_LIMITED_DISCOUNT_TAG = true

/** 模型列表「推荐标签」（人气模型/最新推荐等，模型名称后、VIP 标签之后展示；见 docs/模型推荐标签开发方案.md） */
export const FEATURE_MODEL_LABEL_TAGS = true

/** 头像浮窗默认规则：新上架模型开通提示（无运营 avatar_overlay 推送时兜底展示，全部开通后不显示；见 docs/头像浮窗新上架模型开通提示需求开发文档.md） */
export const FEATURE_AVATAR_NEW_MODEL_PUSH = true

/** 切换身份（历史登录账号快速切换，右侧抽屉面板 V2；见 docs/切换身份改造/切换身份功能改造开发文档.md §9。关闭时行为与改造前完全一致） */
export const FEATURE_IDENTITY_SWITCH = true

/** 子账号首登强制改密拦截闭环（登录成功后 check → 命中则弹不可关闭改密层；见 docs/子账号首登强制改密/子账号首登强制改密开发文档.md。关闭=应急回滚，直接走现状登录链路） */
export const FEATURE_SUB_FORCE_UPDATE_PWD = true

/** 选择模型弹窗双页签（按量付费/免费体验）+ 免费体验额度展示（V3 卡片环形样式；见 docs/选择模型弹窗免费体验改造/开发方案.md。关闭时行为与改造前完全一致） */
export const FEATURE_SELECT_MODEL_QUOTA_TABS = true
