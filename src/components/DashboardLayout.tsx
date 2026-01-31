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
        // Try to get profile data if available, otherwise fallback to auth data
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
    <div className="min-h-screen bg-[#F3F4F6] flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:flex md:flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <Pill className="h-8 w-8 text-blue-600 mr-2" />
          <span className="text-xl font-bold text-gray-900">PharmaOne</span>
          <button 
            className="ml-auto md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-blue-50 text-blue-600" 
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="h-5 w-5 mr-3" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            
            {/* Search Removed */}
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button 
                className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                <div className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white" />
                  )}
                </div>
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-1 border border-gray-100 z-50">
                  <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-500 text-sm">
                        No new notifications
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div key={notification.id} className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className={`text-sm ${notification.unread ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                              {notification.title}
                            </p>
                            <span className="text-xs text-gray-400 whitespace-nowrap">{notification.time}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{notification.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-center">
                    <button 
                      onClick={() => {
                        navigate('/notifications');
                        setIsNotificationsOpen(false);
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative pl-4 border-l border-gray-200" ref={profileRef}>
              <button 
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1 transition-colors"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              >
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.name || 'Loading...'}</p>
                  <p className="text-xs text-gray-500">Admin</p>
                </div>
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.name} 
                    className="h-9 w-9 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium border border-blue-200">
                    <User className="h-5 w-5" />
                  </div>
                )}
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email || 'email@example.com'}</p>
                  </div>
                  <div className="py-1">
                    <button 
                      onClick={() => {
                        navigate('/settings');
                        setIsProfileMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Account Settings
                    </button>
                  </div>
                  <div className="border-t border-gray-100 py-1">
                    <button 
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
