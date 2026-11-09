import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from './ThemeProvider'
import { ThemeSelector } from './ThemeSelector'

const { saveThemePreference, saveFailure } = vi.hoisted(() => ({
  saveThemePreference: vi.fn(),
  saveFailure: {
    shouldFail: false,
    occurred: false,
  },
}))

vi.mock('@/features/preferences/api', () => ({
  useThemePreference: () => ({
    data: { mode: 'Light' },
    isError: false,
    isSuccess: true,
  }),
  useSaveThemePreference: () => ({
    error: saveFailure.occurred ? new Error('Save failed.') : null,
    isError: saveFailure.occurred,
    mutate: (mode: string) => {
      saveThemePreference(mode)
      if (saveFailure.shouldFail) {
        saveFailure.occurred = true
      }
    },
  }),
}))

describe('ThemeSelector', () => {
  beforeEach(() => {
    saveThemePreference.mockClear()
    saveFailure.shouldFail = false
    saveFailure.occurred = false
  })

  it('exposes exactly three labeled options and changes the selected mode by keyboard', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeSelector userId="user-1" />
      </ThemeProvider>,
    )

    const selector = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Theme' })
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Light', 'Dark', 'System'])
    expect(selector).toHaveValue('Light')

    selector.focus()
    await user.keyboard('{ArrowDown}')
    selector.value = 'Dark'
    selector.dispatchEvent(new Event('change', { bubbles: true }))

    expect(selector).toHaveValue('Dark')
    expect(saveThemePreference).toHaveBeenCalledWith('Dark')
  })

  it('resets the current mode when the authenticated account changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <ThemeProvider>
        <ThemeSelector userId="user-1" />
      </ThemeProvider>,
    )
    const selector = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Theme' })

    await user.selectOptions(selector, 'Dark')
    expect(selector).toHaveValue('Dark')

    rerender(
      <ThemeProvider>
        <ThemeSelector userId="user-2" />
      </ThemeProvider>,
    )

    expect(selector).toHaveValue('Light')
  })

  it('keeps the selected appearance and shows an error when saving fails', async () => {
    const user = userEvent.setup()
    saveFailure.shouldFail = true
    render(
      <ThemeProvider>
        <ThemeSelector userId="user-1" />
      </ThemeProvider>,
    )
    const selector = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Theme' })

    await user.selectOptions(selector, 'Dark')

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Your selection remains active for this visit.')
    expect(selector).toHaveValue('Dark')
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
  })
})
