import { loggerService } from '@logger'
import { updateSubPwdFirstLoginApi } from '@renderer/api/login'
import { TopView } from '@renderer/components/TopView'
import i18n from '@renderer/i18n'
import { Alert, Button, Form, Input, Modal, Popover } from 'antd'
import { Check, KeyRound, Lock, Shield, ShieldCheck, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('ForceUpdatePwdModal')

/** 强制改密弹窗结果：success=改密成功可进入；switch=用户选择切换账号 */
export type ForceUpdatePwdResult = 'success' | 'switch'

export interface ForceUpdatePwdShowParams {
  /** 子账号名（登录页表单，非「父账号_子账号」展示态） */
  username: string
  /** 主账号标识（手机号/邮箱/用户名） */
  phoneNumber: string
}

/** 后端锁定：连续失败达上限（错误次数计数 24h TTL），文案含「锁定/错误次数」 */
const isLockMsg = (msg: string) => /锁定|错误次数|locked|too many attempts/i.test(msg)
/** 后端频控/防重复提交：文案含「频繁/重复提交」 */
const isFrequentMsg = (msg: string) => /频繁|重复提交|frequen|repeat|rate.?limit/i.test(msg)

// ====== 前端校验规则（对齐后端 updateSubPwdFirstLogin） ======
const ruleLength = (v: string) => /^.{8,32}$/.test(v)
const ruleCombo = (v: string) => /\d/.test(v) && /[a-zA-Z]/.test(v)
const ruleIllegal = (v: string) => !/[<>"'|\\]/.test(v)
const ruleDiff = (newPwd: string, oldPwd: string) => newPwd.length > 0 && newPwd !== oldPwd
const ruleMatch = (newPwd: string, confirm: string) => newPwd.length > 0 && confirm.length > 0 && newPwd === confirm

interface RuleDef {
  key: string
  label: string
  ok: boolean
}

const ForceUpdatePwdInner = ({
  resolve,
  username,
  phoneNumber
}: ForceUpdatePwdShowParams & { resolve: (r: ForceUpdatePwdResult) => void }) => {
  const [form] = Form.useForm()
  const [open, setOpen] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [locked, setLocked] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [alert, setAlert] = useState<{ type: 'error' | 'warning' | 'success'; msg: string } | null>(null)
  const [switchOpen, setSwitchOpen] = useState(false)
  const resultRef = useRef<ForceUpdatePwdResult>('switch')
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const oldPwd = Form.useWatch('oldPassword', form) || ''
  const newPwd = Form.useWatch('newPassword', form) || ''
  const confirmPwd = Form.useWatch('confirmPassword', form) || ''

  const t = (key: string) => i18n.t(`login.sub_account.force_update_pwd.${key}`)

  const rules = useMemo<RuleDef[]>(
    () => [
      { key: 'length', label: t('rule_length'), ok: ruleLength(newPwd) },
      { key: 'combo', label: t('rule_combo'), ok: ruleCombo(newPwd) },
      { key: 'illegal', label: t('rule_illegal'), ok: ruleIllegal(newPwd) },
      { key: 'diff', label: t('rule_diff'), ok: ruleDiff(newPwd, oldPwd) },
      { key: 'match', label: t('rule_match'), ok: ruleMatch(newPwd, confirmPwd) }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [newPwd, oldPwd, confirmPwd, i18n.language]
  )
  const allRulesOk = rules.every((r) => r.ok)

  const clearCooldown = useCallback(() => {
    if (cooldownTimer.current) {
      clearInterval(cooldownTimer.current)
      cooldownTimer.current = null
    }
  }, [])

  // 组件卸载兜底清理冷却定时器，避免泄漏
  useEffect(() => () => clearCooldown(), [clearCooldown])

  const startCooldown = useCallback(
    (seconds: number) => {
      clearCooldown()
      setCooldown(seconds)
      cooldownTimer.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearCooldown()
            return 0
          }
          return c - 1
        })
      }, 1000)
    },
    [clearCooldown]
  )

  const finish = useCallback((result: ForceUpdatePwdResult) => {
    resultRef.current = result
    setOpen(false)
  }, [])

  const handleAfterClose = useCallback(() => {
    clearCooldown()
    resolve(resultRef.current)
    ForceUpdatePwdModal.hide()
  }, [resolve, clearCooldown])

  /** 解析后端/网络异常，映射为行内提示与锁定/频控态 */
  const handleFailure = useCallback(
    (e: unknown) => {
      logger.error('子账号首登强制改密 fail', e as any)
      // 业务错误被拦截器 reject 为 msg 字符串；网络/超时为 Error 对象
      const bizMsg = typeof e === 'string' ? e : ((e as any)?.response?.data?.msg ?? (e as any)?.msg ?? '')
      if (bizMsg) {
        if (isLockMsg(bizMsg)) {
          setLocked(true)
          setAlert({ type: 'warning', msg: bizMsg })
        } else if (isFrequentMsg(bizMsg)) {
          setAlert({ type: 'warning', msg: bizMsg })
          startCooldown(3)
        } else {
          // 原密码错误等：msg 透传展示
          setAlert({ type: 'error', msg: bizMsg })
        }
      } else {
        setAlert({ type: 'error', msg: t('err_network') })
      }
    },

    [startCooldown]
  )

  const onSubmit = useCallback(async () => {
    if (submitting || locked || cooldown > 0) return
    // 前端拦截，避免无效请求命中后端频控
    if (!oldPwd) {
      setAlert({ type: 'error', msg: t('err_old_pwd_required') })
      return
    }
    if (!confirmPwd) {
      setAlert({ type: 'error', msg: t('err_confirm_required') })
      return
    }
    if (!allRulesOk) {
      setAlert({ type: 'error', msg: t('err_rule_fail') })
      return
    }
    setSubmitting(true)
    setAlert(null)
    logger.info('子账号首登强制改密 submit', { username })
    try {
      await updateSubPwdFirstLoginApi({
        username,
        phoneNumber,
        oldPassword: oldPwd,
        newPassword: newPwd
      })
      logger.info('子账号首登强制改密 success', { username })
      setAlert({ type: 'success', msg: t('success') })
      window.toast?.success(t('success'))
      setTimeout(() => finish('success'), 400)
    } catch (e) {
      handleFailure(e)
    } finally {
      setSubmitting(false)
    }
  }, [
    submitting,
    locked,
    cooldown,
    oldPwd,
    confirmPwd,
    allRulesOk,
    newPwd,
    username,
    phoneNumber,
    handleFailure,
    finish
  ])

  const submitDisabled = locked || cooldown > 0
  const submitText = submitting ? t('submitting') : cooldown > 0 ? `${t('submit')} (${cooldown}s)` : t('submit')

  const switchContent = (
    <SwitchConfirm>
      <div className="sc-text">{t('switch_confirm_content')}</div>
      <div className="sc-actions">
        <Button size="small" onClick={() => setSwitchOpen(false)}>
          {t('switch_confirm_cancel')}
        </Button>
        <Button
          size="small"
          type="primary"
          onClick={() => {
            setSwitchOpen(false)
            logger.info('子账号首登强制改密 switch_account', { username })
            finish('switch')
          }}>
          {t('switch_confirm_ok')}
        </Button>
      </div>
    </SwitchConfirm>
  )

  return (
    <Modal
      open={open}
      centered
      width={480}
      maskClosable={false}
      keyboard={false}
      closable={false}
      footer={null}
      destroyOnClose
      afterClose={handleAfterClose}
      styles={{ body: { maxHeight: 'calc(92vh - 100px)', overflowY: 'auto', paddingRight: 4 } }}>
      <Wrap>
        <NoCloseBadge>
          <Lock size={11} />
          <span>{t('no_close')}</span>
        </NoCloseBadge>

        <Head>
          <ShieldIcon>
            <ShieldCheck size={22} />
          </ShieldIcon>
          <div className="head-text">
            <div className="head-title">{t('title')}</div>
            <p className="head-desc">{t('desc')}</p>
          </div>
        </Head>

        <AccountsBar>
          <AccountCard>
            <span className="acc-label">
              <Users size={13} /> {t('main_account_label')}
            </span>
            <span className="acc-value">{phoneNumber}</span>
          </AccountCard>
          <AccountCard>
            <span className="acc-label">
              <KeyRound size={13} /> {t('account_label')}
            </span>
            <span className="acc-value">{username}</span>
          </AccountCard>
        </AccountsBar>

        <Form form={form} layout="vertical" requiredMark={false} autoComplete="off">
          <Form.Item name="oldPassword" label={<FieldLabel>{t('old_pwd')}</FieldLabel>}>
            <Input.Password
              size="large"
              autoComplete="new-password"
              placeholder={t('old_pwd_placeholder')}
              disabled={locked}
              onChange={() => alert && setAlert(null)}
            />
          </Form.Item>
          <Form.Item name="newPassword" label={<FieldLabel>{t('new_pwd')}</FieldLabel>}>
            <Input.Password
              size="large"
              autoComplete="new-password"
              placeholder={t('new_pwd_placeholder')}
              disabled={locked}
              onChange={() => alert && setAlert(null)}
            />
          </Form.Item>
          <Form.Item name="confirmPassword" label={<FieldLabel>{t('confirm_pwd')}</FieldLabel>}>
            <Input.Password
              size="large"
              autoComplete="new-password"
              placeholder={t('confirm_pwd_placeholder')}
              disabled={locked}
              onChange={() => alert && setAlert(null)}
            />
          </Form.Item>
        </Form>

        <RulesBox>
          {rules.map((r) => (
            <RuleRow key={r.key} $ok={r.ok}>
              <span className="rule-icon">{r.ok ? <Check size={11} /> : <span className="rule-dot" />}</span>
              <span className="rule-text">{r.label}</span>
            </RuleRow>
          ))}
        </RulesBox>

        {alert && (
          <AlertBox>
            <Alert
              type={alert.type}
              showIcon
              icon={alert.type === 'warning' ? <Lock size={14} /> : undefined}
              message={alert.msg}
            />
          </AlertBox>
        )}

        <Footer>
          <SubmitButton
            type="primary"
            block
            size="large"
            loading={submitting}
            disabled={submitDisabled}
            onClick={onSubmit}>
            {submitText}
          </SubmitButton>
          <SwitchRow>
            <Popover
              open={switchOpen}
              onOpenChange={setSwitchOpen}
              trigger="click"
              placement="top"
              content={switchContent}>
              <SwitchLink type="link" disabled={submitting}>
                <Shield size={13} /> {t('switch_account')}
              </SwitchLink>
            </Popover>
          </SwitchRow>
        </Footer>
      </Wrap>
    </Modal>
  )
}

export default class ForceUpdatePwdModal {
  static TopViewKey = 'ForceUpdatePwdModal'

  /**
   * 弹出不可关闭的强制改密弹窗。
   * @returns 'success' 改密成功（可落 token 进入）；'switch' 用户选择切换账号（不落 token）
   */
  static show(params: ForceUpdatePwdShowParams): Promise<ForceUpdatePwdResult> {
    return new Promise((resolve) => {
      TopView.show(<ForceUpdatePwdInner {...params} resolve={resolve} />, this.TopViewKey)
    })
  }

  static hide() {
    TopView.hide(this.TopViewKey)
  }
}

// ==================== styled-components ====================
const Wrap = styled.div`
  position: relative;
  padding-top: 4px;
`

const NoCloseBadge = styled.div`
  position: absolute;
  top: -2px;
  right: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #0f766e;
  background: #ccfbf1;
  padding: 3px 10px;
  border-radius: 999px;
  z-index: 2;

  [theme-mode='dark'] & {
    color: #5eead4;
    background: rgba(13, 148, 136, 0.16);
  }
`

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
  padding-right: 96px;

  .head-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text-1);
    margin-bottom: 4px;
  }
  .head-desc {
    font-size: 12.5px;
    color: var(--color-text-3);
    line-height: 1.5;
    margin: 0;
  }
`

const ShieldIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(15, 118, 110, 0.1);
  color: #0f766e;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  [theme-mode='dark'] & {
    background: rgba(13, 148, 136, 0.18);
    color: #5eead4;
  }
`

const AccountsBar = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
`

const AccountCard = styled.div`
  background: var(--color-gray-5);
  border-radius: 8px;
  padding: 10px 12px;
  min-width: 0;

  .acc-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--color-text-3);
    margin-bottom: 3px;
  }
  .acc-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-1);
    font-family: var(--code-font-family);
    word-break: break-all;
  }
`

const FieldLabel = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
`

const RulesBox = styled.div`
  background: var(--color-gray-5);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
`

const RuleRow = styled.div<{ $ok: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  padding: 3px 0;
  color: ${({ $ok }) => ($ok ? '#16a34a' : 'var(--color-text-3)')};
  transition: color 0.18s;

  .rule-icon {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: ${({ $ok }) => ($ok ? 'rgba(22,163,74,0.14)' : 'transparent')};
  }
  .rule-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-text-3);
    opacity: 0.6;
  }
`

const AlertBox = styled.div`
  margin-top: 12px;

  .ant-alert {
    font-size: 13px;
    border-radius: 8px;
  }
`

const Footer = styled.div`
  margin-top: 18px;
`

const SubmitButton = styled(Button)`
  &.ant-btn {
    height: 42px;
    font-size: 14px;
    font-weight: 600;
    border: none;
  }
  &.ant-btn-primary:not(:disabled) {
    background: linear-gradient(135deg, #0f766e, #0d9488);
  }
  &.ant-btn-primary:not(:disabled):hover {
    background: linear-gradient(135deg, #0d9488, #14b8a6) !important;
  }
`

const SwitchRow = styled.div`
  text-align: center;
  margin-top: 12px;
`

const SwitchLink = styled(Button)`
  &.ant-btn {
    font-size: 12.5px;
    color: var(--color-text-3);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    height: auto;
  }
  &.ant-btn:not(:disabled):hover {
    color: var(--color-primary) !important;
    background: transparent !important;
  }
`

const SwitchConfirm = styled.div`
  max-width: 240px;

  .sc-text {
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-2);
    margin-bottom: 12px;
  }
  .sc-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
`
