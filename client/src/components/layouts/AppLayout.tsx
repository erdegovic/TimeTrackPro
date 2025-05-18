import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/ui/logo";
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
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";

type NavItemProps = {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  isActive: boolean;
};

const NavItem = ({ href, icon, children, isActive }: NavItemProps) => (
  <Link href={href} className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors hover:bg-gray-50 hover:text-gray-900 ${isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}>
    <span className={`mr-3 ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>{icon}</span>
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

  const closeSidebar = () => setSidebarOpen(false);

  return (
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
        <div className="flex flex-col w-64 bg-white border-r border-gray-200 h-full">
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
            <nav className="mt-2 flex-1 px-2 space-y-1">
              <NavItem href="/" icon={<Clock className="w-5 h-5" />} isActive={location === '/'}>
                Time Tracker
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
              <NavItem href="/settings" icon={<Settings className="w-5 h-5" />} isActive={location === '/settings'}>
                Settings
              </NavItem>
            </nav>
          </div>
          
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex-shrink-0 w-full group block">
              <div className="flex items-center">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="User" />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700">Alex Johnson</p>
                  <p className="text-xs font-medium text-gray-500">Free Account</p>
                </div>
              </div>
            </div>
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
