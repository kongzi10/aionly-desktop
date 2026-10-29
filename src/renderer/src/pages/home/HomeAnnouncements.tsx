import { Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { HomePushItem } from './homeContent'

interface Props {
  items: HomePushItem[]
}

const HomeAnnouncements: FC<Props> = ({ items }) => {
  const { t } = useTranslation()
  if (items.length === 0) return null

  const renderItem = (item: HomePushItem, key: string) => (
    <NoticeRow key={key}>
      <Sparkles size={13} aria-hidden="true" />
      <span>{item.content}</span>
    </NoticeRow>
  )

  return (
    <Viewport aria-label={t('homeLanding.announcements')} $count={items.length}>
      <Track $count={items.length}>
        {items.map((item) => renderItem(item, item.id))}
        {items.length > 1 && (
          <div aria-hidden="true" className="repeat">
            {items.map((item) => renderItem(item, `repeat-${item.id}`))}
          </div>
        )}
      </Track>
    </Viewport>
  )
}

const Viewport = styled.section<{ $count: number }>`
  width: min(100%, 340px);
  height: ${({ $count }) => ($count > 1 ? '70px' : '31px')};
  overflow: hidden;
  ${({ $count }) =>
    $count > 1 &&
    `mask-image: linear-gradient(to bottom, transparent, black 13px, black calc(100% - 13px), transparent);`}
`

const Track = styled.div<{ $count: number }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: ${({ $count }) => ($count > 1 ? `push-scroll ${$count * 5}s linear infinite` : 'none')};

  &:hover {
    animation-play-state: paused;
  }

  .repeat {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @keyframes push-scroll {
    to {
      transform: translateY(calc(-50% - 4px));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const NoticeRow = styled.div`
  display: flex;
  flex: 0 0 31px;
  align-items: center;
  gap: 7px;
  box-sizing: border-box;
  width: 100%;
  min-height: 31px;
  padding: 5px 11px;
  border: 1px solid rgb(129 174 237 / 23%);
  border-radius: 100px;
  background: rgb(235 245 255 / 68%);
  color: #44618a;
  font-size: 12px;
  white-space: nowrap;

  svg {
    flex-shrink: 0;
    color: #5c7cff;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

export default HomeAnnouncements
