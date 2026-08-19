import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, LogOut, KeyRound } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function AppLayout() {
  const { profile, user, signOut } = useAuth();

  const displayEmail = profile?.email ?? user?.email ?? '';
  const initials = displayEmail
    .split('@')[0]
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 2)
    .toUpperCase() || 'SB';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <NavLink to="/work-orders" className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-slate-900 tracking-tight">Work Orders</span>
              </NavLink>
              <nav className="hidden sm:flex items-center gap-1">
                <NavLink
                  to="/work-orders"
                  end
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition ${
                      isActive ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/work-orders/create"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition ${
                      isActive ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  New Order
                </NavLink>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                  {initials}
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-medium text-slate-900">{displayEmail}</p>
                  <p className="text-xs text-slate-500 capitalize">{profile?.role ?? 'employee'}</p>
                </div>
              </div>
              <NavLink
                to="/account/change-password"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
                title="Change Password"
              >
                <KeyRound className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Change Password</span>
              </NavLink>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
