import { FolderOpen, PlusCircle, Settings, Home, BookOpen, MessageSquare, Database } from 'lucide-react';
import logo from '@/assets/logo.png';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const items = [
  { title: 'Home', url: '/', icon: Home },
  { title: 'Projects', url: '/dashboard', icon: FolderOpen },
  { title: 'AI Chat', url: '/chat', icon: MessageSquare },
  { title: 'Create New', url: '/create', icon: PlusCircle },
  { title: 'DB Manager', url: '/db-manager', icon: Database },
  
  { title: 'Settings', url: '/settings', icon: Settings },
  { title: 'About', url: '/about', icon: BookOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <img src={logo} alt="Bytebase" className="h-6 w-6" />
            {!collapsed && (
              <span className="text-primary font-bold tracking-tight">
                Byte<span className="text-foreground">base</span>
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
