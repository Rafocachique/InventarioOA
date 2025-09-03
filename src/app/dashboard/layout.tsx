
"use client";

import * as React from 'react';
import { PanelLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from "firebase/firestore";


import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DashboardNav } from '@/components/dashboard-nav';
import { useToast } from '@/hooks/use-toast';

interface UserData {
    name?: string;
    email?: string;
    role?: string;
}


function CheckSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = React.useState<UserData | null>(null);
  const [initials, setInitials] = React.useState("");


  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        // User is signed in
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const userData = userDoc.data() as UserData;
            setCurrentUser(userData);
            
            // Generate initials from name, or email as fallback
            const name = userData.name;
            if (name) {
                 const nameParts = name.split(' ');
                 const initials = nameParts.length > 1 
                    ? `${nameParts[0][0]}${nameParts[1][0]}`
                    : name.substring(0, 2);
                 setInitials(initials.toUpperCase());
            } else if (user.email) {
                 setInitials(user.email.substring(0, 2).toUpperCase());
            }

        } else {
            // Fallback for user data not in Firestore
            setCurrentUser({ email: user.email || 'N/A' });
            if (user.email) {
                setInitials(user.email.substring(0, 2).toUpperCase());
            }
        }
      } else {
        // User is signed out
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Sesión Cerrada",
        description: "Has cerrado sesión correctamente.",
      });
      router.push('/');
    } catch (error) {
      console.error("Error al cerrar sesión: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo cerrar la sesión.",
      });
    }
  };


  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader className="h-14 justify-center p-2 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10">
          <Link href="/dashboard" className="flex items-center gap-2 text-primary font-bold">
            <CheckSquareIcon className="size-6 text-primary shrink-0" />
            <span className="text-lg group-data-[collapsible=icon]:hidden font-headline">StockCheck Pro</span>
          </Link>
        </SidebarHeader>

        <SidebarContent className="p-2">
          <DashboardNav />
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-6">
          <SidebarTrigger className="md:hidden">
            <PanelLeft />
          </SidebarTrigger>
          <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
            <div className="ml-auto flex-1 sm:flex-initial">
              {/* Search could go here if needed */}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials || 'AD'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                    <div className="font-bold">{currentUser?.name || 'Usuario'}</div>
                    <div className="text-xs text-muted-foreground">{currentUser?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Mi Perfil</DropdownMenuItem>
                <DropdownMenuItem disabled>Ajustes</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                    Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex flex-1 flex-col bg-background">
          <div className="flex flex-col flex-1 space-y-4 p-4 md:p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
