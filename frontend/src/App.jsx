import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { AnimatePresence } from 'framer-motion'
import LoginModal from './components/modals/LoginModal'
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8 relative overflow-hidden">
      {/* Background Light Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-[100px]" />
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          },
        }}
      />

      <AnimatePresence>
        {showLogin && <LoginModal onLogin={handleLogin} />}
      </AnimatePresence>

      {!showLogin && (
        <div className="max-w-6xl mx-auto relative z-10">
          <Header onLogout={handleLogout} showLogout={true} apiKey={apiKey} />
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
