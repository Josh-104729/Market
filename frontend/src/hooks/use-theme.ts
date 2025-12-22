import * as React from "react"

export type Theme = "light" | "dark"

const STORAGE_KEY = "theme"
const USER_SET_KEY = "theme_user_set"

function getInitialTheme(): Theme {
  // Default to LIGHT unless the user explicitly chose a theme.
  const userSet = localStorage.getItem(USER_SET_KEY) === "1"
  if (userSet) {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "dark" || stored === "light") return stored
  }
  return "light"
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") root.classList.add("dark")
  else root.classList.remove("dark")
}

export function useTheme() {
  const [theme, setThemeState] = React.useState<Theme>(() => getInitialTheme())

  React.useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = React.useCallback((t: Theme) => {
    localStorage.setItem(USER_SET_KEY, "1")
    setThemeState(t)
  }, [])
  const toggleTheme = React.useCallback(
    () => {
      localStorage.setItem(USER_SET_KEY, "1")
      setThemeState((t) => (t === "dark" ? "light" : "dark"))
    },
    []
  )

  return { theme, setTheme, toggleTheme }
}


