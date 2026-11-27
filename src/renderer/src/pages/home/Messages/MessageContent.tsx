import { getModelUniqId } from '@renderer/services/ModelService'
import { useAppSelector } from '@renderer/store'
import type { Message } from '@renderer/types/newMessage'
import { getMentionAssistantId, getMentionModel } from '@renderer/types/roundtable'
import { Flex } from 'antd'
import { isEmpty } from 'lodash'
import React from 'react'
import styled from 'styled-components'

import MessageBlockRenderer from './Blocks'
interface Props {
  message: Message
}

const MessageContent: React.FC<Props> = ({ message }) => {
  const assistants = useAppSelector((state) => state.assistants.assistants)
  return (
    <>
      {!isEmpty(message.mentions) && (
        <Flex gap="8px" wrap style={{ marginBottom: '10px' }}>
          {message.mentions?.map((mention) => {
            // 兼容旧格式裸 Model 与新格式 RoundtableMention（{ model, assistantId }）
            // 注意：aionly 的 Model 自身带 model 字符串字段，不能用 'model' in mention 判断格式
            const model = getMentionModel(mention)
            if (!model) {
              return null
            }
            const mentionAssistantId = getMentionAssistantId(mention)
            const role = mentionAssistantId ? assistants.find((item) => item.id === mentionAssistantId) : undefined
            return (
              <MentionTag key={getModelUniqId(model)}>
                {'@' + model.name}
                {role && <RoleName> · {role.name}</RoleName>}
              </MentionTag>
            )
          })}
        </Flex>
      )}
      <MessageBlockRenderer blocks={message.blocks} message={message} />
    </>
  )
}

const MentionTag = styled.span`
  color: var(--color-link);
`

const RoleName = styled.span`
  color: var(--color-primary);
  font-weight: 600;
`

// const SearchingText = styled.div`
//   font-size: 14px;
//   line-height: 1.6;
//   text-decoration: none;
//   color: var(--color-text-1);
// `

export default React.memo(MessageContent)
