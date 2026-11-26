/**
 * 群聊「模型 × 角色独立绑定」内存特性开关。
 * - true（默认）：发送链路写 RoundtableMention[]，弹窗为双栏（模型 + 角色分配）
 * - false：回退旧行为（mentions 写 Model[]，弹窗为纯模型多选）
 *
 * 仅内存态（重启恢复默认），不落盘；读取侧始终以 normalizeRoundtableMentions 兼容两种格式，
 * 因此开关切换不产生数据迁移。
 */
let roundtableRoleBindingEnabled = true

export const isRoundtableRoleBindingEnabled = (): boolean => roundtableRoleBindingEnabled

export const setRoundtableRoleBindingEnabled = (enabled: boolean): void => {
  roundtableRoleBindingEnabled = enabled
}
