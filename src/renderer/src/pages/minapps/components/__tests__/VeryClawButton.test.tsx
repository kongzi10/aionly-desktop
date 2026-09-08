import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import VeryClawButton from '../VeryClawButton'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const open = vi.fn()
const confirm = vi.fn()
const error = vi.fn()
const download = vi.fn().mockResolvedValue({ status: 'started' })

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(window, { api: { veryclaw: { open, download } }, modal: { confirm }, toast: { error } })
})

describe('VeryClaw toolbox button', () => {
  it('keeps the install dialog open when this architecture has no published package', async () => {
    download.mockResolvedValueOnce({ status: 'unavailable' })
    open.mockResolvedValue({ status: 'not-installed' })
    render(<VeryClawButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    await expect(confirm.mock.calls[0][0].onOk()).rejects.toThrow()
    expect(error).toHaveBeenCalledWith('minapp.veryclaw.download_unavailable')
  })
  it('asks to restart AiOnly when the running preload has not loaded the new API', async () => {
    Object.assign(window, { api: {} })
    render(<VeryClawButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(error).toHaveBeenCalledWith('minapp.veryclaw.restart_required'))
  })
  it('requests the platform installer only after confirmation', async () => {
    open.mockResolvedValue({ status: 'not-installed' })
    render(<VeryClawButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    expect(download).not.toHaveBeenCalled()
    await confirm.mock.calls[0][0].onOk()
    expect(download).toHaveBeenCalledOnce()
  })

  it('reports a download failure and keeps the dialog open', async () => {
    download.mockRejectedValueOnce(new Error('Browser unavailable'))
    open.mockResolvedValue({ status: 'not-installed' })
    render(<VeryClawButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    await expect(confirm.mock.calls[0][0].onOk()).rejects.toThrow()
    expect(error).toHaveBeenCalledWith('minapp.veryclaw.download_failed')
  })

  it('does not offer installation on unsupported platforms', async () => {
    open.mockResolvedValue({ status: 'unsupported' })
    render(<VeryClawButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(error).toHaveBeenCalledWith('minapp.veryclaw.unsupported'))
    expect(confirm).not.toHaveBeenCalled()
  })
  it('opens the installed application and uses a bundled icon', async () => {
    open.mockResolvedValue({ status: 'opened' })
    render(<VeryClawButton />)
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('veryclaw.png'))
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(open).toHaveBeenCalledOnce())
    expect(confirm).not.toHaveBeenCalled()
  })

  it('shows installation guidance when the application is absent', async () => {
    open.mockResolvedValue({ status: 'not-installed' })
    render(<VeryClawButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'minapp.veryclaw.install_title'
        })
      )
    )
  })

  it('shows launch errors without suggesting a reinstall', async () => {
    open.mockRejectedValue(new Error('Access denied'))
    render(<VeryClawButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(error).toHaveBeenCalledWith('minapp.veryclaw.open_failed'))
    expect(confirm).not.toHaveBeenCalled()
  })

  it('prevents repeated launches while detection is pending', async () => {
    open.mockReturnValue(new Promise(() => {}))
    render(<VeryClawButton />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    fireEvent.click(button)
    expect(open).toHaveBeenCalledOnce()
    expect(button).toBeDisabled()
  })
})
