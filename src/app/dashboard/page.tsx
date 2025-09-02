
"use client";

import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DollarSign, Users, CreditCard, Activity, Loader2 } from 'lucide-react';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, onSnapshot } from "firebase/firestore";
import { startOfDay, endOfDay, subDays, format, getDay } from "date-fns";
import { es } from "date-fns/locale";

interface DashboardStats {
  totalProducts: number;
  activeUsers: number;
  scansToday: number;
  recentActivity: number;
}

interface WeeklyScanData {
    day: string;
    scans: number;
}


const chartConfig = {
  scans: {
    label: "Escaneos",
    color: "hsl(var(--accent))",
  },
};

export default function DashboardPage() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [weeklyData, setWeeklyData] = React.useState<WeeklyScanData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch total products
            const productsSnapshot = await getDocs(collection(db, "products"));
            const totalProducts = productsSnapshot.size;

            // Set up listeners for dynamic data
            const usersUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
                setStats(prev => ({...prev, activeUsers: snapshot.size} as DashboardStats));
            });

            const todayStart = startOfDay(new Date());
            const todayEnd = endOfDay(new Date());

            const scansTodayQuery = query(collection(db, "scan_history"), where("scannedAt", ">=", Timestamp.fromDate(todayStart)), where("scannedAt", "<=", Timestamp.fromDate(todayEnd)));
            const scansTodayUnsubscribe = onSnapshot(scansTodayQuery, (snapshot) => {
                setStats(prev => ({...prev, scansToday: snapshot.size} as DashboardStats));
            });

            const lastHour = new Date();
            lastHour.setHours(lastHour.getHours() - 1);
            const recentActivityQuery = query(collection(db, "scan_history"), where("scannedAt", ">=", Timestamp.fromDate(lastHour)));
            const recentActivityUnsubscribe = onSnapshot(recentActivityQuery, (snapshot) => {
                 setStats(prev => ({...prev, recentActivity: snapshot.size} as DashboardStats));
            });

            // Weekly scans logic
            const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
            const weeklyScansQuery = query(collection(db, "scan_history"), where("scannedAt", ">=", Timestamp.fromDate(sevenDaysAgo)));
            
            const weeklyScansUnsubscribe = onSnapshot(weeklyScansQuery, (snapshot) => {
                const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
                const scansByDay: { [key: string]: number } = {};

                 for (let i = 0; i < 7; i++) {
                    const date = subDays(new Date(), i);
                    const dayName = format(date, 'EEEE', { locale: es });
                    scansByDay[dayName] = 0;
                }

                snapshot.docs.forEach(doc => {
                    const scanDate = doc.data().scannedAt.toDate();
                    const dayName = format(scanDate, 'EEEE', { locale: es });
                    if(scansByDay[dayName] !== undefined){
                        scansByDay[dayName]++;
                    }
                });

                const chartData = Object.entries(scansByDay)
                    .map(([day, scans]) => ({ day, scans }))
                    .sort((a, b) => {
                        const dayA = daysOfWeek.indexOf(a.day);
                        const dayB = daysOfWeek.indexOf(b.day);
                        return dayA - dayB;
                    });
                
                setWeeklyData(chartData);
            });


            setStats({ totalProducts, activeUsers: 0, scansToday: 0, recentActivity: 0 }); // Initial set
            
            return () => {
                usersUnsubscribe();
                scansTodayUnsubscribe();
                recentActivityUnsubscribe();
                weeklyScansUnsubscribe();
            };

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-full">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Inmobiliarios</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts.toLocaleString() ?? '...'}</div>
            <p className="text-xs text-muted-foreground">Registros en la base de datos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Supervisores Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats?.activeUsers.toLocaleString() ?? '...'}</div>
            <p className="text-xs text-muted-foreground">Usuarios registrados en el sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escaneos Hoy</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats?.scansToday.toLocaleString() ?? '...'}</div>
            <p className="text-xs text-muted-foreground">Verificaciones realizadas hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actividad Reciente</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats?.recentActivity.toLocaleString() ?? '...'}</div>
            <p className="text-xs text-muted-foreground">Escaneos en la última hora</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2">
        <Card className="col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle>Resumen de Escaneos Semanal</CardTitle>
            <CardDescription>Un resumen de los inmobiliarios escaneados durante la última semana.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative w-full overflow-auto">
                <ChartContainer config={chartConfig} className="h-[350px] w-full min-w-[600px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1, 3)}/>
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        cursor={{ fill: 'hsla(var(--card), 0.5)' }}
                        content={<ChartTooltipContent />}
                      />
                      <Legend />
                      <Bar dataKey="scans" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
