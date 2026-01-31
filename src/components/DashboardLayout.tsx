import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  RotateCcw, 
  Settings, 
  Pill, 
  Bell, 
  LogOut,
  Menu,
  X,
  User,
  History
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { checkInventoryNotifications } from '../lib/inventoryUtils';
import { cn } from '../lib/utils';

const DashboardLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; photoURL?: string } | null>(null);
  const [notifications, setNotifications] = useState<{ id: string | number; title: string; message: string; time: string; unread: boolean }[]>([]);
  const navigate = useNavigate();
  
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  useEffect(() => {
    const getUserData = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('owner_name')
          .eq('id', authUser.id)
          .single();

        setUser({
          name: profile?.owner_name || authUser.user_metadata?.full_name || 'User',
          email: authUser.email || '',
          photoURL: authUser.user_metadata?.avatar_url
        });
      }
    };

    const getNotifications = async () => {
      const msgs = await checkInventoryNotifications();
      if (msgs && msgs.length > 0) {
        setNotifications(msgs.map(m => ({
          id: m.id,
          title: m.title,
          message: m.message,
          time: 'Just now',
          unread: true
        })));
      } else {
        setNotifications([]);
      }
    };

    getUserData();
    getNotifications();

    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: ShoppingCart, label: 'Billing', path: '/billing' },
    { icon: Package, label: 'Inventory', path: '/inventory' },
    { icon: History, label: 'Sales History', path: '/sales-history' },
    { icon: RotateCcw, label: 'Returns', path: '/returns' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="min-h-screen bg-brand-bg flex font-sans">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white/80 backdrop-blur-md border-r border-white shadow-soft transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:flex md:flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-20 flex items-center px-8">
          <div className="bg-gradient-to-br from-brand-primary-start to-brand-primary-end  p-2 rounded-xl text-white mr-3 shadow-lg shadow-brand-primary-start/30">
             <Pill className="h-6 w-6" />
          </div>
          <span className="text-2xl font-black bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Stocky</span>
          <button 
            className="ml-auto md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200",
                isActive 
                  ? "bg-gradient-to-r from-brand-primary-start/10 to-brand-primary-end/5 text-brand-primary-start shadow-sm" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className={cn("h-5 w-5 mr-3", ({ isActive }: any) => isActive ? "text-brand-primary-start" : "text-gray-400")} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-bold text-red-500 rounded-2xl hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-brand-bg/90 backdrop-blur-sm px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-white rounded-xl"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button 
                className="relative p-2 text-gray-400 hover:text-brand-primary-start hover:bg-white rounded-xl transition-all shadow-sm hover:shadow"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                <div className="relative">
                  <Bell className="h-6 w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-white" />
                  )}
                </div>
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-4 w-80 bg-white rounded-2xl shadow-xl py-2 border border-brand-primary-start/10 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-500 text-sm">
                        No new notifications
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div key={notification.id} className="px-4 py-3 hover:bg-brand-bg transition-colors cursor-pointer border-b border-gray-50 last:border-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className={`text-sm ${notification.unread ? 'font-bold text-gray-800' : 'text-gray-600'}`}>
                              {notification.title}
                            </p>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap bg-gray-100 px-2 py-0.5 rounded-full">{notification.time}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{notification.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2 border-t border-gray-100 text-center">
                    <button 
                      onClick={() => {
                        navigate('/notifications');
                        setIsNotificationsOpen(false);
                      }}
                      className="text-xs font-bold text-brand-primary-start hover:text-brand-primary-end"
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative pl-4" ref={profileRef}>
              <button 
                className="flex items-center gap-3 hover:bg-white rounded-xl p-1 pr-3 transition-all shadow-sm hover:shadow"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              >
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.name} 
                    className="h-10 w-10 rounded-full object-cover border-2 border-brand-primary-start/20"
                  />
                ) : (
                  <div className="h-10 w-10 bg-gradient-to-br from-brand-primary-start to-brand-primary-end rounded-full flex items-center justify-center text-white font-bold shadow-md">
                    <User className="h-5 w-5" />
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className="text-sm font-bold text-gray-800 leading-tight">{user?.name || 'Loading...'}</p>
                  <p className="text-xs text-gray-400 font-medium">Admin</p>
                </div>
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-4 w-60 bg-white rounded-2xl shadow-xl border border-brand-primary-start/10 z-50 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-brand-bg/30">
                    <p className="text-sm font-bold text-gray-900 truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email || 'email@example.com'}</p>
                  </div>
                  <div className="py-2">
                    <button 
                      onClick={() => {
                        navigate('/settings');
                        setIsProfileMenuOpen(false);
                      }}
                      className="block w-full text-left px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-brand-bg transition-colors"
                    >
                      Account Settings
                    </button>
                  </div>
                  <div className="border-t border-gray-100 py-2">
                    <button 
                      onClick={handleLogout}
                      className="block w-full text-left px-6 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors font-bold"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/20 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
