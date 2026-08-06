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
  MessageSquare,
  ShieldCheck
  ,HelpCircle
  ,BookOpen
  ,CircleHelp
  ,Mail
  ,Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Client, Project } from "@shared/schema";
import { useTimerContext } from "@/context/TimerContext";
import TickdLoadingScreen from "@/components/marketing/TickdLoadingScreen";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  
  // Get user profile data from authentication
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    isTracking: hasActiveTimer,
    description: timerDescription,
    selectedProjectId: timerProjectId,
    selectedClientId: timerClientId,
    currentDuration: timerElapsedTime,
  } = useTimerContext();
  const { data: timerProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: Boolean(user && hasActiveTimer),
  });
  const { data: timerClients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: Boolean(user && hasActiveTimer),
  });
  const timerProject = timerProjects.find((project) => project.id === timerProjectId);
  const timerClient = timerClients.find((client) => (
    client.id === (timerClientId || timerProject?.clientId)
  ));
  const timerInfo = hasActiveTimer ? {
    description: timerDescription || "Time tracking",
    elapsedTime: Math.floor(timerElapsedTime),
    projectName: timerProject?.name,
    clientName: timerClient?.name,
  } : null;
  const subscriptionPlan = user?.subscriptionPlan || "free";
  
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

  if (isAuthLoading || !user) return <TickdLoadingScreen />;
  
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
                href="/tracker"
                icon={<Clock className="w-5 h-5" />} 
                isActive={location === '/' || location === '/tracker'}
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
              <NavItem href="/ultimate" icon={<Sparkles className="w-5 h-5" />} isActive={location === '/ultimate'}>
                Smart Assistant
                {subscriptionPlan === "ultimate" && <span className="ml-auto text-[9px] font-bold">ULTIMATE</span>}
              </NavItem>
              <NavItem href="/settings" icon={<Settings className="w-5 h-5" />} isActive={location === '/settings'}>
                Settings
              </NavItem>
              {user?.role === "admin" && (
                <NavItem href="/admin" icon={<ShieldCheck className="w-5 h-5" />} isActive={location === '/admin'}>
                  Admin
                </NavItem>
              )}
            </nav>
          </div>
          
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              {subscriptionPlan !== "ultimate" && (
                <Button size="sm" className="min-w-0 flex-1 justify-start" variant={subscriptionPlan === "free" ? "default" : "outline"} asChild>
                  <Link href="/plans"><Sparkles className="mr-2 h-4 w-4" />{subscriptionPlan === "free" ? "Upgrade" : "View plans"}</Link>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label="Help and resources"><HelpCircle className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-52">
                  <DropdownMenuLabel>Help and resources</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/how-it-works"><BookOpen className="h-4 w-4" />How it works</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/help"><HelpCircle className="h-4 w-4" />Help center</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/faq"><CircleHelp className="h-4 w-4" />FAQ</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/contact"><Mail className="h-4 w-4" />Contact support</Link></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Link href="/account" className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9 rounded-full overflow-hidden">
                    <AvatarImage src={userAvatar} alt="User" className="object-cover w-full h-full" />
                    <AvatarFallback>{userName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  {subscriptionPlan !== "free" && (
                    <span className={`absolute -bottom-1 -right-2 rounded px-1 py-0.5 text-[8px] font-bold leading-none text-white shadow-sm ${subscriptionPlan === "pro" ? "bg-blue-600" : "bg-[#071127]"}`}>
                      {subscriptionPlan === "pro" ? "PRO" : "ULTIMATE"}
                    </span>
                  )}
                </div>
                <div className="ml-3">
                  <p className="user-profile-name text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">{userName}</p>
                  <p className="text-xs font-medium text-gray-500">{user?.email || ""}</p>
                </div>
              </div>
            </Link>
            
            <Separator className="my-3" />
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-gray-600 hover:text-white hover:bg-red-600 mt-1"
              onClick={() => {
                fetch('/api/logout', { method: 'POST' })
                  .finally(() => {
                    window.location.href = '/login';
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
          className={`flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 transition-all duration-500 ${
            isMobile || !creativitySidebarCollapsed ? '' : 'lg:mr-16'
          } ${
            isMobile || creativitySidebarCollapsed ? '' : 'lg:mr-80'
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
