import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store/store'
import App from './App.tsx'
import './index.css'
import { notificationService } from './services/notificationService'

// Initialize notification service
if ('serviceWorker' in navigator && 'Notification' in window) {
  notificationService.initialize().catch(console.error);
}

// Apply persisted theme ASAP to avoid UI flash.
try {
  const userSet = localStorage.getItem("theme_user_set") === "1"
  const theme = localStorage.getItem("theme")

  // Default LIGHT unless user explicitly chose a theme.
  if (userSet && theme === "dark") {
    document.documentElement.classList.add("dark")
  } else {
    document.documentElement.classList.remove("dark")
    localStorage.setItem("theme", "light")
  }
} catch {
  // no-op
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
)

