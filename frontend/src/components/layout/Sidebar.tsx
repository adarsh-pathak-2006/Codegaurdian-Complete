'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ShieldCheck, LayoutDashboard, FolderOpen, Search,
  FileText, LogOut, ChevronDown, Menu, X, Bell
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderOpen },
  { href: '/dashboard/scans', label: 'Scans', icon: Search },
  { href: '/dashboard/findings', label: 'Findings', icon: ShieldCheck },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => { logout(); router.push('/'); };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 glass border-r border-slate-800/60 ${collapsed ? 'w-16' : 'w-60'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800/60">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex-shrink-0 flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold gradient-text text-base">CodeGuardian</span>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  active
                    ? 'bg-violet-600/15 text-violet-400 border border-violet-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${active ? 'text-violet-400' : ''}`} />
                {!collapsed && <span>{label}</span>}
                {active && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-3 pb-8 border-t border-slate-800/80 bg-slate-950/40">
          <div className="relative">
            <button
              onClick={() => setProfileOpen(p => !p)}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 text-left transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-100 truncate font-semibold">
                      {user?.first_name || user?.email?.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      {user?.organizations?.[0]?.name || 'Organization'}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                </>
              )}
            </button>

            {profileOpen && !collapsed && (
              <div className="absolute bottom-full left-0 right-0 mb-2 glass-card border border-slate-700/60 p-1.5 shadow-xl z-50">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 glass border-b border-slate-800/60 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold gradient-text text-sm">CodeGuardian</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex glass border-t border-slate-800/60 z-50">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href} className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition-colors ${active ? 'text-violet-400' : 'text-slate-500'}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
