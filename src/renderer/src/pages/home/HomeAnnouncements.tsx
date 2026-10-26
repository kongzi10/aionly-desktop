import { Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { HomeContentAction, HomeContentItem } from './homeContent'

interface Props {
  ticker: HomeContentItem[]
  announcements: HomeContentItem[]
  onAction: (action: HomeContentAction) => void
}

const HomeAnnouncements: FC<Props> = ({ ticker, announcements, onAction }) => {
  const { t } = useTranslation()
  const [tickerIndex, setTickerIndex] = useState(0)
  const [announcementIndex, setAnnouncementIndex] = useState(0)

  useEffect(() => {
    if (ticker.length < 2) return
    const timer = window.setInterval(() => setTickerIndex((index) => (index + 1) % ticker.length), 5000)
    return () => window.clearInterval(timer)
  }, [ticker.length])

  useEffect(() => {
    if (announcements.length < 2) return
    const timer = window.setInterval(() => setAnnouncementIndex((index) => (index + 1) % announcements.length), 6000)
    return () => window.clearInterval(timer)
  }, [announcements.length])

  if (ticker.length === 0 && announcements.length === 0) return null

  const renderRow = (item: HomeContentItem) => {
    const content = (
      <>
        <Sparkles size={13} aria-hidden="true" />
        <strong>{item.title}</strong>
        {item.description && <small>{item.description}</small>}
      </>
    )

    return (
      <NoticeRow key={item.id} aria-live="polite">
        {item.action ? (
          <button type="button" onClick={() => onAction(item.action!)}>
            {content}
          </button>
        ) : (
          <span>{content}</span>
        )}
      </NoticeRow>
    )
  }

  return (
    <Container aria-label={t('homeLanding.announcements')}>
      {ticker.length > 0 && renderRow(ticker[tickerIndex % ticker.length])}
      {announcements.length > 0 && renderRow(announcements[announcementIndex % announcements.length])}
    </Container>
  )
}

const Container = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(100%, 340px);
  font-size: 12px;
`

const NoticeRow = styled.div`
  width: 100%;

  button,
  span {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    min-height: 31px;
    padding: 5px 11px;
    color: #44618a;
    background: rgb(235 245 255 / 68%);
    border: 1px solid rgb(129 174 237 / 23%);
    border-radius: 100px;
    text-align: left;
    white-space: nowrap;
  }

  button:hover {
    border-color: rgb(92 149 233 / 50%);
    background: rgb(225 239 255 / 88%);
  }

  svg {
    flex-shrink: 0;
    color: #5c7cff;
  }

  strong {
    flex-shrink: 0;
    font-weight: 500;
  }

  small {
    flex: 1;
    overflow: hidden;
    color: #667b9d;
    font-size: 11px;
    text-align: right;
    text-overflow: ellipsis;
  }
`

export default HomeAnnouncements
