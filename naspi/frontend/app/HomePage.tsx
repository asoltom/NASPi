'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import Dashboard from '@/components/dashboard'
import FileManager from '@/components/file-manager'
import SystemSettings from '@/components/system-settings'
import AppStore from '@/components/app-store'
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  Store,
  Moon,
  Sun,
  LogOut,
  Menu,
  User,
  Power
} from 'lucide-react'
import LoginForm from '@/components/LoginForm'
import Services from '@/components/services'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [theme, setTheme] = useState('light')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [showPowerModal, setShowPowerModal] = useState(false)
  const [powerState, setPowerState] = useState<'idle' | 'rebooting' | 'shuttingDown'>('idle')
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.classList.toggle('dark')
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const handleLogin = (userData: any) => {
    setUser(userData)
  }

  const handleLogout = () => {
    setUser(null)
    setActiveTab('dashboard')
  }

  const handlePowerAction = async (action: 'reboot' | 'shutdown') => {
    setPowerState(action === 'reboot' ? 'rebooting' : 'shuttingDown')
    try {
      await fetch(`http://naspi.local:5000/api/${action}`, { method: 'POST' })
      setTimeout(() => {
        window.location.reload()
      }, 6000) // 6 segundos
    } catch (error) {
      console.error(`Error al intentar ${action}:`, error)
    }
  }

  const renderContent = () => {
    if (!user) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <LoginForm onLogin={handleLogin} />
        </div>
      )
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard user={user} />
      case 'files':
        return <FileManager />
      case 'services':
        return <Services />
      case 'settings':
        return user.role === 'admin' ? <SystemSettings /> : <p>Access denied. Admin rights required.</p>
      case 'apps':
        return user.role === 'admin' ? <AppStore /> : <p>Access denied. Admin rights required.</p>
      default:
        return <Dashboard user={user} />
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex justify-between items-center">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2 md:hidden">
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">NASPi</h1>
        </div>
        <div className="flex items-center space-x-4">
          {user && (
            <div className="hidden sm:flex items-center space-x-2">
              <User className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium">{user.username} ({user.role})</span>
            </div>
          )}
          <Button variant="outline" size="icon" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="h-[1.2rem] w-[1.2rem]" /> : <Sun className="h-[1.2rem] w-[1.2rem]" />}
          </Button>
          {user && (
            <>
              <Button variant="outline" size="icon" onClick={() => setShowPowerModal(true)}>
                <Power className="h-[1.2rem] w-[1.2rem] text-red-500" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setShowLogoutModal(true)}>
                <LogOut className="h-[1.2rem] w-[1.2rem]" />
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {user && (
          <aside className={`w-48 bg-white dark:bg-gray-800 border-r dark:border-gray-700 overflow-y-auto transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static absolute z-10 h-full`}>
            <nav className="p-4 space-y-2">
              <Button
                variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false) }}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              <Button
                variant={activeTab === 'files' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => { setActiveTab('files'); setIsSidebarOpen(false) }}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                File Manager
              </Button>
              {user.role === 'admin' && (
                <>
                  <Button
                    variant={activeTab === 'settings' ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false) }}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    System Settings
                  </Button>
                  <Button
                    variant={activeTab === 'apps' ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => { setActiveTab('apps'); setIsSidebarOpen(false) }}
                  >
                    <Store className="w-4 h-4 mr-2" />
                    App Store
                  </Button>
                </>
              )}
              <Button
                variant={activeTab === 'services' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => { setActiveTab('services'); setIsSidebarOpen(false) }}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Services
              </Button>
            </nav>
          </aside>
        )}
        <main className="flex-1 overflow-y-auto p-4">
          {renderContent()}
        </main>
      </div>

      <Dialog open={showPowerModal} onOpenChange={setShowPowerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Qué deseas hacer con el NASPi?</DialogTitle>
          </DialogHeader>
          {powerState === 'idle' ? (
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={() => handlePowerAction("reboot")} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                Reiniciar
              </Button>
              <Button onClick={() => handlePowerAction("shutdown")} className="bg-red-600 hover:bg-red-700 text-white">
                Apagar
              </Button>
              <Button variant="outline" onClick={() => setShowPowerModal(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <p className="text-center text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6">
              {powerState === 'rebooting' ? 'Reiniciando NASPi...' : 'Apagando NASPi...'}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres cerrar tu sesión?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button onClick={() => { handleLogout(); setShowLogoutModal(false) }} className="bg-red-600 hover:bg-red-700 text-white">
              Sí, cerrar sesión
            </Button>
            <Button variant="outline" onClick={() => setShowLogoutModal(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
