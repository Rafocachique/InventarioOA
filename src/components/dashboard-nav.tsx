"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, Home, ScanLine, Search, Users } from 'lucide-react';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/data', label: 'Gestión de Datos', icon: Database },
  { href: '/dashboard/scan', label: 'Escanear y Verificar', icon: ScanLine },
  { href: '/dashboard/reports', label: 'Búsqueda y Reportes', icon: Search },
  { href: '/dashboard/roles', label: 'Gestión de Roles', icon: Users },
];

export function DashboardNav() {
  const pathname = usePathname();

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
