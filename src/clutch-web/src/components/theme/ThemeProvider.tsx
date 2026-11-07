import { useEffect, type PropsWithChildren } from 'react'

export function ThemeProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
    const updateColorScheme = () => {
      document.documentElement.classList.toggle('dark', colorScheme.matches)
    }

    updateColorScheme()
    colorScheme.addEventListener('change', updateColorScheme)
    return () => colorScheme.removeEventListener('change', updateColorScheme)
  }, [])

  return children
}
