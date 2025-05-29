import { ReactNode, useState, useEffect, createContext, useContext } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/ui/logo";
import CreativitySidebar from "@/components/CreativitySidebar/CreativitySidebar";
import { 
  Clock, 
  Calendar, 
  FileText, 
  File, 
  Users, 
  Folder, 
  BarChart2, 
  Settings, 
  Menu,
  X,
  Timer,
  LogOut,
  User,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Separator } from "@/components/ui/separator";
import { useAuth, UserProfile } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";

// Context for creativity sidebar state
const CreativitySidebarContext = createContext<{
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}>({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export const useCreativitySidebar = () => useContext(CreativitySidebarContext);

type NavItemProps = {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  isActive: boolean;
};

const NavItem = ({ href, icon, children, isActive }: NavItemProps) => (
  <Link href={href} className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 tickd-hover-lift ${isActive ? 'tickd-bg-primary text-white shadow-lg' : 'text-gray-600 hover:bg-white hover:text-primary hover:shadow-sm'}`}>
    <span className={`mr-3 ${isActive ? 'text-white' : 'text-gray-500'}`}>{icon}</span>
    <span>{children}</span>
  </Link>
);

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [creativitySidebarCollapsed, setCreativitySidebarCollapsed] = useState(false);
  const [hasActiveTimer, setHasActiveTimer] = useState(false);
  const [timerInfo, setTimerInfo] = useState<{
    description: string;
    elapsedTime: number;
    projectName?: string;
    clientName?: string;
  } | null>(null);
  
  // Get user profile data from authentication
  const { user, isLoading } = useAuth();
  
  // User profile state (with fallbacks while loading)
  const [userName, setUserName] = useState('Loading...');
  const [userAvatar, setUserAvatar] = useState('');
  
  // Update user profile state when auth data changes
  useEffect(() => {
    if (user) {
      const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
      setUserName(displayName);
      
      if (user.profileImageUrl) {
        setUserAvatar(user.profileImageUrl);
      }
    }
  }, [user]);
  
  // Setup listener for profile update events  
  useEffect(() => {
    // Listen for profile updates and refresh data
    const handleProfileUpdate = () => {
      // Force refresh of auth data to update sidebar
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    };
    
    // Add event listener for profile updates
    window.addEventListener('profile-updated', handleProfileUpdate as EventListener);
    
    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate as EventListener);
    };
  }, []);

  const closeSidebar = () => setSidebarOpen(false);
  
  // Check for active timer
  useEffect(() => {
    // Function to check if timer is active and update state
    const checkTimer = () => {
      try {
        const timerData = localStorage.getItem('timeTracker');
        if (timerData) {
          const data = JSON.parse(timerData);
          if (data.startTime) {
            setHasActiveTimer(true);
            
            // Calculate elapsed time
            const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
            
            // Get project and client info if available
            let projectName;
            let clientName;
            
            try {
              const projectsData = localStorage.getItem('cachedProjects');
              const clientsData = localStorage.getItem('cachedClients');
              
              if (projectsData && data.projectId) {
                const projects = JSON.parse(projectsData);
                const project = projects.find((p: any) => p.id === data.projectId);
                projectName = project?.name;
              }
              
              if (clientsData && data.clientId) {
                const clients = JSON.parse(clientsData);
                const client = clients.find((c: any) => c.id === data.clientId);
                clientName = client?.name;
              }
            } catch (e) {
              console.error('Error getting project/client data:', e);
            }
            
            setTimerInfo({
              description: data.description || 'Time tracking',
              elapsedTime: elapsed,
              projectName,
              clientName
            });
          } else {
            setHasActiveTimer(false);
            setTimerInfo(null);
          }
        } else {
          setHasActiveTimer(false);
          setTimerInfo(null);
        }
      } catch (error) {
        console.error('Error checking timer:', error);
        setHasActiveTimer(false);
        setTimerInfo(null);
      }
    };
    
    // Check immediately and then every second
    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    
    // Clean up interval
    return () => clearInterval(interval);
  }, []);

  return (
    <CreativitySidebarContext.Provider value={{
      isCollapsed: creativitySidebarCollapsed,
      setIsCollapsed: setCreativitySidebarCollapsed
    }}>
      <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      {/* Added a backdrop div to handle closing when clicking outside the sidebar */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
      <aside className={`${isMobile ? (sidebarOpen ? 'fixed inset-y-0 left-0 z-40 block' : 'hidden') : 'flex flex-shrink-0'}`}>
        <div className="flex flex-col w-64 h-full tickd-card border-r tickd-shadow" style={{ backgroundColor: 'hsl(var(--tickd-bg))' }}>
          <div className="h-16 flex items-center px-4 border-b border-gray-200">
            <Logo />
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={closeSidebar}
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
          
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            {/* Active Timer Indicator */}
            {timerInfo && (
              <div className="mx-3 mb-4 p-3 tickd-card border-l-4 tickd-border-primary tickd-fade-in">
                <div className="flex items-center">
                  <Timer className="w-5 h-5 mr-2 tickd-primary animate-pulse" />
                  <span className="text-sm font-medium tickd-primary">Timer Running</span>
                </div>
                <div className="mt-2">
                  <div className="text-xs font-medium text-gray-500">
                    {timerInfo.projectName || "Project"} 
                    {timerInfo.clientName && ` - ${timerInfo.clientName}`}
                  </div>
                  <div className="text-sm font-medium mt-1 truncate text-gray-700">
                    {timerInfo.description}
                  </div>
                  <div className="mt-1 font-mono text-sm tickd-primary font-semibold">
                    {Math.floor(timerInfo.elapsedTime / 3600).toString().padStart(2, '0')}:
                    {Math.floor((timerInfo.elapsedTime % 3600) / 60).toString().padStart(2, '0')}:
                    {(timerInfo.elapsedTime % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Safe to change tabs or close window
                  </div>
                </div>
              </div>
            )}
            
            <nav className="mt-2 flex-1 px-2 space-y-1">
              <NavItem 
                href="/" 
                icon={<Clock className="w-5 h-5" />} 
                isActive={location === '/'}
              >
                Time Tracker
                {hasActiveTimer && 
                  <span className="ml-1 w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                }
              </NavItem>
              <NavItem href="/dashboard" icon={<BarChart2 className="w-5 h-5" />} isActive={location === '/dashboard'}>
                Dashboard
              </NavItem>
              <NavItem href="/reports" icon={<FileText className="w-5 h-5" />} isActive={location === '/reports'}>
                Reports
              </NavItem>
              <NavItem href="/invoices" icon={<File className="w-5 h-5" />} isActive={location === '/invoices'}>
                Invoices
              </NavItem>
              <NavItem href="/clients" icon={<Users className="w-5 h-5" />} isActive={location === '/clients'}>
                Clients
              </NavItem>
              <NavItem href="/projects" icon={<Folder className="w-5 h-5" />} isActive={location === '/projects'}>
                Projects
              </NavItem>
              <NavItem href="/notes" icon={<MessageSquare className="w-5 h-5" />} isActive={location === '/notes'}>
                Notes
              </NavItem>
              <NavItem href="/settings" icon={<Settings className="w-5 h-5" />} isActive={location === '/settings'}>
                Settings
              </NavItem>
            </nav>
          </div>
          
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <Link href="/account" className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <Avatar className="h-9 w-9 rounded-full overflow-hidden">
                  <AvatarImage src={userAvatar} alt="User" className="object-cover w-full h-full" />
                  <AvatarFallback>{userName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="ml-3">
                  <p className="user-profile-name text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">{userName}</p>
                  <p className="text-xs font-medium text-gray-500">Free Account</p>
                </div>
              </div>
            </Link>
            
            <Separator className="my-3" />
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-gray-600 hover:text-white hover:bg-red-600 mt-1"
              onClick={() => {
                // No need to clear local storage anymore as we're using the database
              // Just trigger the logout request
                
                fetch('/api/auth/logout')
                  .then(() => {
                    window.location.href = '/login?logout=true';
                  })
                  .catch(error => {
                    console.error('Logout failed:', error);
                    window.location.href = '/login?logout=true';
                  });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </aside>
      
      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top navbar */}
        {isMobile && (
          <div className="flex-shrink-0 bg-white border-b border-gray-200">
            <div className="h-16 flex items-center justify-between px-4">
              <Logo />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Main content area */}
        <main 
          className={`flex-1 overflow-y-auto p-4 md:p-6 transition-all duration-500 ${
            creativitySidebarCollapsed ? 'mr-16' : 'mr-80'
          }`} 
          style={{ backgroundColor: 'hsl(var(--tickd-bg))' }}
        >
          <div className="max-w-7xl mx-auto tickd-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Creativity Sidebar */}
      <CreativitySidebar 
        isCollapsed={creativitySidebarCollapsed}
        onToggle={() => setCreativitySidebarCollapsed(!creativitySidebarCollapsed)}
      />
    </div>
    </CreativitySidebarContext.Provider>
  );
}
