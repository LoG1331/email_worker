import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'
import LoginModal from './components/modals/LoginModal'
import SettingsModal from './components/modals/SettingsModal'
import Header from './components/layout/Header'
import Tabs from './components/layout/Tabs'
import StarredEmailsTab from './components/tabs/GroupsTab'
import EmailsTab from './components/tabs/EmailsTab'
import ServicesTab from './components/tabs/ServicesTab'
import PermissionsTab from './components/tabs/PermissionsTab'
import './index.css'

const STORAGE_KEY = 'inbox_api_key'

function App() {
  const [apiKey, setApiKey] = useState(null)
  const [showLogin, setShowLogin] = useState(true)
  const [activeTab, setActiveTab] = useState('starred')
  const [allEmails, setAllEmails] = useState([])
  const [allServices, setAllServices] = useState([])
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEY)
    if (savedKey) {
      setApiKey(savedKey)
      setShowLogin(false)
    }
  }, [])

  const handleLogin = (key) => {
    localStorage.setItem(STORAGE_KEY, key)
    setApiKey(key)
    setShowLogin(false)
  }

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setApiKey(null)
    setShowLogin(true)
  }

  return (
    <div className="min-h-screen text-ink p-4 md:p-8 relative overflow-hidden">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(227,175,96,0.25),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(31,106,92,0.2),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_rgba(197,83,45,0.15),_transparent_50%)]" />
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#fff8ef',
            color: '#2a1f1a',
            border: '1px solid #e6d6c4',
            borderRadius: '18px',
            boxShadow: '0 18px 30px -25px rgba(42, 31, 26, 0.4)'
          },
        }}
      />

      <AnimatePresence>
        {showLogin && <LoginModal onLogin={handleLogin} />}
      </AnimatePresence>

      {!showLogin && (
        <div className="max-w-6xl mx-auto relative z-10">
          <Header onLogout={handleLogout} showLogout={true} apiKey={apiKey} onOpenSettings={() => setShowSettings(true)} />
          <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} apiKey={apiKey} />
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

          <AnimatePresence mode="wait">
            {activeTab === 'starred' && (
              <StarredEmailsTab key="starred" apiKey={apiKey} activeTab={activeTab} />
            )}
            {activeTab === 'emails' && (
              <EmailsTab key="emails" apiKey={apiKey} allEmails={allEmails} setAllEmails={setAllEmails} />
            )}
            {activeTab === 'services' && (
              <ServicesTab key="services" apiKey={apiKey} allServices={allServices} setAllServices={setAllServices} />
            )}
            {activeTab === 'permissions' && (
              <PermissionsTab key="permissions" apiKey={apiKey} />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export default App
