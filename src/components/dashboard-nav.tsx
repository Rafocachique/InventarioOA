
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, Home, ScanLine, Search, Users, Filter } from 'lucide-react';
import * as React from 'react';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['Administrador', 'Supervisor'] },
  { href: '/dashboard/data', label: 'Gestión de Datos', icon: Database, roles: ['Administrador'] },
  { href: '/dashboard/scan', label: 'Escanear y Verificar', icon: ScanLine, roles: ['Administrador', 'Supervisor'] },
  { href: '/dashboard/reports', label: 'Búsqueda y Reportes', icon: Search, roles: ['Administrador', 'Supervisor'] },
  { href: '/dashboard/advanced-search', label: 'Búsqueda Avanzada', icon: Filter, roles: ['Administrador', 'Supervisor'] },
  { href: '/dashboard/roles', label: 'Gestión de Roles', icon: Users, roles: ['Administrador'] },
];

interface DashboardNavProps {
    role?: string;
    isLoading?: boolean;
}

export function DashboardNav({ role, isLoading }: DashboardNavProps) {
  const pathname = usePathname();

  const navItems = React.useMemo(() => {
    if (!role) return [];
    return allNavItems.filter(item => item.roles.includes(role));
  }, [role]);

  if (isLoading) {
    return (
        <SidebarMenu>
            <SidebarMenuSkeleton showIcon />
            <SidebarMenuSkeleton showIcon />
            <SidebarMenuSkeleton showIcon />
        </SidebarMenu>
    );
  }


  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            tooltip={item.label}
            isActive={pathname.startsWith(item.href) && (item.href === '/dashboard' ? pathname === item.href : true) }
          >
            <Link href={item.href}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
