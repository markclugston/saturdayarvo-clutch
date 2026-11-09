import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import type { ThemeMode } from '@/lib/api/schemas'

type ThemeContextValue = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>('Light')

  useEffect(() => {
    const root = document.documentElement
    if (mode !== 'System') {
      root.classList.toggle('dark', mode === 'Dark')
      return
    }

    if (typeof window.matchMedia !== 'function') {
      root.classList.remove('dark')
      return
    }

    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
    const updateColorScheme = () => root.classList.toggle('dark', colorScheme.matches)
    updateColorScheme()
    colorScheme.addEventListener('change', updateColorScheme)
    return () => colorScheme.removeEventListener('change', updateColorScheme)
  }, [mode])

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider.')
  }

  return context
}
