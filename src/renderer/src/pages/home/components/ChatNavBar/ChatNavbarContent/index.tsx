import type { FC } from 'react'

import TopicContent from './TopicContent'

const ChatNavbarContent: FC = () => {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between">
      <TopicContent />
    </div>
  )
}

export default ChatNavbarContent
