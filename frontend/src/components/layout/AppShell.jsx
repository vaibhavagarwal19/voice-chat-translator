import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import MobileNav from './MobileNav'

export default function AppShell() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  )
}
