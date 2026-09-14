import { ReloadOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { loginApi, qrcodeGenerateApi, qrcodeStatusApi } from '@renderer/api/login'
import { getScanLoginUrl } from '@renderer/config/constant'
import i18n from '@renderer/i18n'
import { Button, Spin } from 'antd'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

/** 客户端状态机：loading / failed 为本地态，其余与后端 status 一一对应 */
type QrcodeLoginStatus = 'loading' | 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'failed'

type QrcodeServerStatus = 'WAIT_SCAN' | 'SCANNED' | 'CONFIRMED' | 'CANCELED' | 'EXPIRED'

const POLL_INTERVAL = 2000
/** 连续失败容忍次数，避免单次网络抖动就销毁二维码 */
const POLL_ERROR_TOLERANCE = 3

interface QrcodeLoginProps {
  /** 页签激活状态，未激活时暂停轮询 */
  active: boolean
  onSuccess?: () => void
  setLoading?: (loading: boolean) => void
}

const logger = loggerService.withContext('QrcodeLogin')

const Container = styled.div`
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
`

const Card = styled.div`
  width: 200px;
  height: 200px;
  box-sizing: border-box;
  border-radius: 12px;
  border: 1px solid var(--color-border);
`

/** 固定白底，保证暗黑模式下可识别 */
const QrcodeWrap = styled(Card)`
  position: relative;
  padding: 10px;
  background: #ffffff;
  overflow: hidden;
`

const CenterCard = styled(Card)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 16px;
  text-align: center;
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-2);
`

const QrcodeImage = styled(QRCodeSVG)<{ $dimmed: boolean }>`
  width: 100%;
  height: 100%;
  opacity: ${({ $dimmed }) => ($dimmed ? 0.12 : 1)};
  transition: opacity 0.2s ease;
`

const Overlay = styled.div<{ $clickable?: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 18px;
  box-sizing: border-box;
  text-align: center;
  font-size: 12px;
  line-height: 18px;
  color: #060a26;
  background: rgba(255, 255, 255, 0.92);
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
`

const OverlayTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
`

/** 固定高度，避免状态切换时抖动 */
const Hint = styled.div`
  min-height: 20px;
  margin-top: 14px;
  font-size: 13px;
  text-align: center;
  color: var(--color-text-2);
`

/** 扫码登录：取 ticket -> 渲染二维码 -> 轮询 status -> CONFIRMED 后换取 token */
export const QrcodeLogin = ({ active, onSuccess, setLoading }: QrcodeLoginProps) => {
  const [status, setStatus] = useState<QrcodeLoginStatus>('loading')
  const [tip, setTip] = useState('')
  const [qrValue, setQrValue] = useState('')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ticketRef = useRef('')
  const failCountRef = useRef(0)
  const exchangingRef = useRef(false)
  const activeRef = useRef(active)
  // 回调与状态镜像，避免轮询闭包读到旧值
  const callbacksRef = useRef({ onSuccess, setLoading })
  const statusRef = useRef<QrcodeLoginStatus>('loading')
  const prevActiveRef = useRef(active)
  // 签发时间与后端下发有效期（120s），仅用于判断「尚未被扫」的票是否已死
  const issuedAtRef = useRef(0)
  const expireSecondsRef = useRef(120)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    callbacksRef.current = { onSuccess, setLoading }
  }, [onSuccess, setLoading])

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /** 手机端确认后，用 ticket 换取 token，复用普通登录链路 */
  const exchangeToken = useCallback(async (ticket: string) => {
    if (exchangingRef.current) return
    exchangingRef.current = true
    callbacksRef.current.setLoading?.(true)
    try {
      const res = await loginApi({
        tenantId: '000001',
        // 必须与会话 client 一致，否则后续业务请求会因「客户端ID与token不匹配」被判 401
        clientId: import.meta.env.VITE_APP_CLIENT_ID,
        userType: 'web_user',
        grantType: 'qrcode',
        ticket,
        loginUrl: window.location.href
      })
      const data = res?.data
      if (data?.access_token) {
        localStorage.setItem('token', data.access_token)
        await callbacksRef.current.onSuccess?.()
      } else {
        logger.error('no access_token in login response', { hasResponse: !!res, code: res?.code, msg: res?.msg })
        setStatus('expired')
        setTip(i18n.t('login.qrcode.confirm_failed'))
      }
    } catch (error) {
      logger.error('exchange token for qrcode login failed', {
        msg: (error as any)?.msg,
        httpStatus: (error as any)?.response?.status,
        detail: error instanceof Error ? error.message : String(error)
      })
      setStatus('expired')
      setTip(i18n.t('login.qrcode.confirm_failed'))
    } finally {
      exchangingRef.current = false
      callbacksRef.current.setLoading?.(false)
    }
  }, [])

  /** 轮询扫码状态 */
  const poll = useCallback(async () => {
    // 切到其它页签后暂停轮询
    if (!activeRef.current) return
    const ticket = ticketRef.current
    if (!ticket) return

    try {
      const { data } = await qrcodeStatusApi({ ticket })
      failCountRef.current = 0
      const serverStatus = data?.status as QrcodeServerStatus

      switch (serverStatus) {
        case 'SCANNED':
          setStatus('scanned')
          break
        case 'CONFIRMED':
          stopPolling()
          setStatus('confirmed')
          await exchangeToken(ticket)
          break
        case 'CANCELED':
          stopPolling()
          setStatus('expired')
          setTip(i18n.t('login.qrcode.canceled'))
          break
        case 'EXPIRED':
          stopPolling()
          setStatus('expired')
          setTip(i18n.t('login.qrcode.expired_hint'))
          break
        default:
          setStatus('waiting')
      }
    } catch (error) {
      failCountRef.current += 1
      logger.debug('poll qrcode status failed', { failCount: failCountRef.current, error })
      if (failCountRef.current >= POLL_ERROR_TOLERANCE) {
        stopPolling()
        setStatus('expired')
        setTip(i18n.t('login.qrcode.expired_hint'))
      }
    }
  }, [exchangeToken, stopPolling])

  /** 启动轮询（先清理旧定时器，未激活时不启动） */
  const startPolling = useCallback(() => {
    stopPolling()
    if (!activeRef.current) return
    timerRef.current = setInterval(poll, POLL_INTERVAL)
  }, [poll, stopPolling])

  /** 生成二维码并开始轮询 */
  const generate = useCallback(async () => {
    stopPolling()
    ticketRef.current = ''
    failCountRef.current = 0
    setQrValue('')
    setTip('')
    setStatus('loading')

    try {
      const { data } = await qrcodeGenerateApi()
      const ticket = data?.ticket ?? ''
      if (!ticket) throw new Error('empty ticket')

      ticketRef.current = ticket
      issuedAtRef.current = Date.now()
      expireSecondsRef.current = Number(data?.expireSeconds) > 0 ? Number(data.expireSeconds) : 120
      setQrValue(getScanLoginUrl(ticket))
      setStatus('waiting')
      startPolling()
    } catch (error) {
      const msg = String((error as any)?.response?.data?.msg ?? (error as any)?.msg ?? (error as any)?.message ?? '')
      // 未开启时后端返回「扫码登录未开启」
      const disabled = msg.includes('未开启')
      logger.error('generate qrcode failed', { msg })
      setStatus('failed')
      setTip(i18n.t(disabled ? 'login.qrcode.disabled_hint' : 'login.qrcode.generate_failed'))
    }
  }, [startPolling, stopPolling])

  /** ticket 是否已超出后端下发的有效期 */
  const isTicketExpired = useCallback(() => {
    if (!ticketRef.current || !issuedAtRef.current) return true
    return Date.now() - issuedAtRef.current >= expireSecondsRef.current * 1000
  }, [])

  // 页签首次激活时生成二维码，卸载时清理定时器
  useEffect(() => {
    generate()
    return stopPolling
  }, [generate, stopPolling])

  // 切走时停轮询；切回仅在失效 / 失败 / 待扫码超时时重取，未过期的码保持不变（不打断手机端确认）
  useEffect(() => {
    const wasActive = prevActiveRef.current
    prevActiveRef.current = active
    if (wasActive === active) return

    if (!active) {
      stopPolling()
      return
    }

    const current = statusRef.current
    if (current === 'confirmed') return

    // 已失效 / 取码失败 / 待扫码且本地超时 → 重取。
    // 注意 SCANNED 后后端会延长到 300s，绝不能按 120s 重取，否则会作废手机端正在确认的票。
    const deadByLocalTimer = (current === 'loading' || current === 'waiting') && isTicketExpired()
    if (current === 'expired' || current === 'failed' || deadByLocalTimer) {
      logger.debug('qrcode tab re-activated, regenerating qrcode', { status: current })
      generate()
      return
    }

    startPolling()
  }, [active, generate, isTicketExpired, startPolling, stopPolling])

  const renderCard = () => {
    if (status === 'loading') {
      return (
        <CenterCard>
          <Spin />
        </CenterCard>
      )
    }

    if (status === 'failed') {
      return (
        <CenterCard>
          <div>{tip}</div>
          <Button type="link" size="small" icon={<ReloadOutlined />} onClick={generate}>
            {i18n.t('login.qrcode.retry')}
          </Button>
        </CenterCard>
      )
    }

    return (
      <QrcodeWrap>
        <QrcodeImage value={qrValue} size={178} level="M" marginSize={1} $dimmed={status !== 'waiting'} />

        {status === 'scanned' && (
          <Overlay>
            <OverlayTitle>{i18n.t('login.qrcode.scanned')}</OverlayTitle>
            <div>{i18n.t('login.qrcode.scanned_hint')}</div>
          </Overlay>
        )}

        {status === 'confirmed' && (
          <Overlay>
            <Spin size="small" />
            <OverlayTitle>{i18n.t('login.qrcode.confirmed')}</OverlayTitle>
            <div>{i18n.t('login.qrcode.confirmed_hint')}</div>
          </Overlay>
        )}

        {status === 'expired' && (
          <Overlay $clickable onClick={generate}>
            <OverlayTitle>{tip || i18n.t('login.qrcode.expired')}</OverlayTitle>
            <div>{i18n.t('login.qrcode.expired_hint')}</div>
          </Overlay>
        )}
      </QrcodeWrap>
    )
  }

  const renderHint = () => {
    if (status === 'loading') return i18n.t('login.qrcode.loading')
    if (status === 'waiting') return i18n.t('login.qrcode.scan_hint')
    return ''
  }

  return (
    <Container>
      {renderCard()}
      <Hint>{renderHint()}</Hint>
    </Container>
  )
}
