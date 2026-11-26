/**
 * 切换身份 · 右侧抽屉面板（样式方案 V2；顶部当前身份卡为方案C「极简线框 · 信息分层卡」）。
 *
 * 结构：标题行 + 当前身份卡 → 历史登录号码列表（管理模式可移除）→ 底部「登录其他账号」。
 * 入口：侧边栏 / UserAvatar 菜单「切换身份」（FEATURE_IDENTITY_SWITCH 开启时替换原退出登录确认弹窗）。
 */

import type { AccountView } from '@shared/profile'
import { MAX_HISTORY_ACCOUNTS } from '@shared/profile'
import { Drawer } from 'antd'
import { ArrowLeftRight, Info, Plus, RotateCw, Trash2, Users, X } from 'lucide-react'
import type { FC } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Body,
  Card,
  CardAvatar,
  CardInfo,
  CardRight,
  CountRow,
  DeleteBtn,
  Empty,
  ErrorBar,
  Footer,
  HeroCloseBtn,
  HeroHead,
  IdentityRoot,
  List,
  LoginOtherBtn,
  ManageSwitch,
  MeAvatar,
  MeCard,
  NoOthers,
  pickAvatarGrad,
  SectionHead,
  SklCard,
  SwitchBtn
} from './IdentitySwitch.styles'
import { useIdentitySwitch } from './useIdentitySwitch'

interface IdentitySwitchDrawerProps {
  open: boolean
  onClose: () => void
}

/** 卡片展示名：掩码优先，缺失时回退昵称 */
const displayName = (account: AccountView): string => account.accountMasked || account.nickName || '-'

const IdentitySwitchDrawer: FC<IdentitySwitchDrawerProps> = ({ open, onClose }) => {
  const { t } = useTranslation()
  const identity = useIdentitySwitch(open)
  const {
    loading,
    error,
    accounts,
    activeProfileId,
    managing,
    setManaging,
    switchingId,
    removingId,
    refresh,
    switchTo,
    removeAccount,
    loginOther
  } = identity

  // 关闭抽屉时重置管理模式（V2 行为）
  useEffect(() => {
    if (!open) setManaging(false)
  }, [open, setManaging])

  const current = accounts.find((a) => a.profileId === activeProfileId)
  const history = accounts.filter((a) => a.profileId !== activeProfileId)

  const confirmSwitch = (account: AccountView) => {
    window.modal.confirm({
      title: t('identity.title'),
      content: t('identity.switchConfirmContent', { account: displayName(account) }),
      centered: true,
      width: 420,
      okText: t('identity.ok'),
      cancelText: t('identity.cancel'),
      onOk: () => switchTo(account)
    })
  }

  const confirmRemove = (account: AccountView) => {
    window.modal.confirm({
      title: t('identity.removeRecordTitle'),
      content: t('identity.removeRecordContent', { account: displayName(account) }),
      centered: true,
      width: 420,
      okText: t('identity.ok'),
      okButtonProps: { danger: true },
      cancelText: t('identity.cancel'),
      onOk: () => removeAccount(account)
    })
  }

  const renderHero = () => {
    const nick = current?.nickName || ''
    const masked = current?.accountMasked || ''
    // 昵称缺失（子账号常见）时回退掩码账号，避免展示 "-"
    const name = nick || masked || '-'
    const accountId = current?.accountId
    const isSub = current?.accountType === 'sub'
    const typeLabel = isSub ? t('identity.typeSub') : t('identity.typeMain')
    const grad = pickAvatarGrad(current?.profileId ?? 'me', 0)
    const initial = (name.trim()[0] || 'U').toUpperCase()
    return (
      <>
        <HeroHead>
          <div className="hero-title">{t('identity.drawerTitle')}</div>
          <HeroCloseBtn onClick={onClose} aria-label={t('identity.close')}>
            <X size={16} />
          </HeroCloseBtn>
        </HeroHead>
        <MeCard>
          <div className="mc-r1">
            <span className="mc-label">{t('identity.currentLabel')}</span>
            <span className={isSub ? 'is-sub mc-badge' : 'mc-badge'}>{typeLabel}</span>
          </div>
          <div className="mc-r2">
            <MeAvatar $g={grad}>
              {current?.avatarUrl ? <img src={current.avatarUrl} alt="" referrerPolicy="no-referrer" /> : initial}
            </MeAvatar>
            <div className="mc-mid">
              <div className="mc-name">{name}</div>
              {nick && masked ? <div className="mc-acc">{masked}</div> : null}
            </div>
          </div>
          <div className="mc-r3">
            <span className="mc-id">
              <b>ID</b>
              {accountId || '-'}
            </span>
            <span className="mc-status">
              <i className="mc-dot" />
              {t('identity.currentLogin')}
            </span>
          </div>
        </MeCard>
      </>
    )
  }

  const renderSkeleton = () => (
    <List>
      {[0, 1, 2].map((i) => (
        <SklCard key={i}>
          <div className="skl-circle skl-anim" />
          <div className="skl-lines">
            <div className="skl-line w60 skl-anim" />
            <div className="skl-line w40 skl-anim" />
          </div>
          <div className="skl-pill skl-anim" />
        </SklCard>
      ))}
    </List>
  )

  const renderCards = () => (
    <List>
      {history.map((account) => {
        const grad = pickAvatarGrad(account.profileId, 1)
        const nick = account.nickName || ''
        const initial = ((nick || account.accountMasked || 'U').trim()[0] || 'U').toUpperCase()
        const switching = switchingId === account.profileId
        const removing = removingId === account.profileId
        return (
          <Card key={account.profileId}>
            <CardAvatar $g={grad}>
              {account.avatarUrl ? <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" /> : initial}
            </CardAvatar>
            <CardInfo>
              <div className="line1">
                <span className="acc">{displayName(account)}</span>
                <span className={`tag ${account.accountType === 'sub' ? 'tag-sub' : 'tag-main'}`}>
                  {account.accountType === 'sub' ? t('identity.typeSub') : t('identity.typeMain')}
                </span>
              </div>
              <div className="line2">
                {account.accountId ? (
                  <>
                    <span>ID: {account.accountId}</span>
                    {nick ? <span>· {nick}</span> : null}
                  </>
                ) : (
                  <span>{nick || account.accountMasked || '-'}</span>
                )}
              </div>
            </CardInfo>
            <CardRight>
              {managing ? (
                <DeleteBtn
                  type="button"
                  disabled={removing || switchingId !== null}
                  title={t('identity.removeRecord')}
                  onClick={() => confirmRemove(account)}>
                  <Trash2 size={15} />
                </DeleteBtn>
              ) : (
                <SwitchBtn
                  type="button"
                  disabled={switching || removingId !== null}
                  onClick={() => confirmSwitch(account)}>
                  <ArrowLeftRight size={13} />
                  {switching ? t('identity.switching') : t('identity.switch')}
                </SwitchBtn>
              )}
            </CardRight>
          </Card>
        )
      })}
    </List>
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={400}
      placement="right"
      closable={false}
      styles={{ body: { padding: 0 }, content: { background: 'transparent' } }}
      rootClassName="identity-switch-drawer">
      <IdentityRoot>
        {renderHero()}
        <Body>
          <SectionHead>
            <span className="sh-title">{t('identity.historyTitle')}</span>
            <ManageSwitch
              type="button"
              $on={managing}
              aria-label={t('identity.manage')}
              aria-pressed={managing}
              onClick={() => setManaging(!managing)}>
              <span className="knob" />
            </ManageSwitch>
          </SectionHead>
          <CountRow>
            <Info size={13} />
            <span>{t('identity.countTip', { count: accounts.length, max: MAX_HISTORY_ACCOUNTS })}</span>
          </CountRow>
          {error ? (
            <ErrorBar role="alert">
              <span className="err-text">{error}</span>
              <button type="button" className="err-retry" onClick={() => void refresh()}>
                <RotateCw size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
                {t('identity.retry')}
              </button>
            </ErrorBar>
          ) : null}
          {loading ? (
            renderSkeleton()
          ) : history.length === 0 ? (
            accounts.length > 0 ? (
              <NoOthers>{t('identity.noOthers')}</NoOthers>
            ) : (
              <Empty>
                <div className="empty-icon">
                  <Users size={26} />
                </div>
                <div className="empty-title">{t('identity.emptyTitle')}</div>
                <div className="empty-desc">{t('identity.emptyDesc', { max: MAX_HISTORY_ACCOUNTS })}</div>
                <LoginOtherBtn type="button" onClick={() => void loginOther()}>
                  <Plus size={15} />
                  {t('identity.loginOther')}
                </LoginOtherBtn>
              </Empty>
            )
          ) : (
            renderCards()
          )}
        </Body>
        {!loading && history.length > 0 ? (
          <Footer>
            <LoginOtherBtn type="button" onClick={() => void loginOther()}>
              <Plus size={15} />
              {t('identity.loginOther')}
            </LoginOtherBtn>
          </Footer>
        ) : null}
      </IdentityRoot>
    </Drawer>
  )
}

export default IdentitySwitchDrawer
