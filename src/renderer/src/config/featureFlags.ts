/**
 * 渲染进程功能开关：新增能力的一键回滚点（见 docs/模型限时折扣标签开发方案.md §10）
 */

/** 模型列表「限时折扣」标签（模型名称后、VIP 标签之后展示） */
export const FEATURE_LIMITED_DISCOUNT_TAG = true

/** 模型列表「推荐标签」（人气模型/最新推荐等，模型名称后、VIP 标签之后展示；见 docs/模型推荐标签开发方案.md） */
export const FEATURE_MODEL_LABEL_TAGS = true

/** 头像浮窗默认规则：新上架模型开通提示（无运营 avatar_overlay 推送时兜底展示，全部开通后不显示；见 docs/头像浮窗新上架模型开通提示需求开发文档.md） */
export const FEATURE_AVATAR_NEW_MODEL_PUSH = true
