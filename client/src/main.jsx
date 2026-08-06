import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './AdminApp.jsx'

// Plain-URL routing (no router dependency): visiting /admin renders a fully
// separate admin experience with its own login, isolated from the chat app.
const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdminRoute ? <AdminApp /> : <App />}
  </StrictMode>,
)
