import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SendMessageButton from '../SendMessageButton'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('SendMessageButton', () => {
  it('switches the same button from send to stop while replying', () => {
    const sendMessage = vi.fn()
    const onStop = vi.fn()
    const { rerender } = render(<SendMessageButton disabled={false} sendMessage={sendMessage} onStop={onStop} />)

    fireEvent.click(screen.getByRole('button', { name: 'chat.input.send' }))
    expect(sendMessage).toHaveBeenCalledOnce()

    rerender(<SendMessageButton disabled sendMessage={sendMessage} isLoading onStop={onStop} />)

    const stopButton = screen.getByRole('button', { name: 'chat.input.stop' })
    expect(stopButton).toBeEnabled()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(stopButton)
    expect(onStop).toHaveBeenCalledOnce()
    expect(sendMessage).toHaveBeenCalledOnce()
  })
})
