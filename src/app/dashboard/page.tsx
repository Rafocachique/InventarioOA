
"use client";

import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DollarSign, Users, CreditCard, Activity, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, onSnapshot } from "firebase/firestore";
import { startOfDay, endOfDay, subDays, format, getDay, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";

interface DashboardStats {
  totalProducts: number;
  activeUsers: number;
  scansToday: number;
  recentActivity: number;
}

interface MonthlyScanData {
    day: string;
    date: string;
    scans: number;
}


const chartConfig = {
  scans: {
    label: "Escaneos",
    color: "hsl(var(--accent))",
  },
};

const ALL_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function DashboardPage() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = React.useState<MonthlyScanData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isChartLoading, setIsChartLoading] = React.useState(true);

  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedDays, setSelectedDays] = React.useState<string[]>(ALL_DAYS);

  React.useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
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
        
        setStats({ totalProducts, activeUsers: 0, scansToday: 0, recentActivity: 0 }); // Initial set
        setIsLoading(false);

        return () => {
            usersUnsubscribe();
            scansTodayUnsubscribe();
            recentActivityUnsubscribe();
        };

    };

    fetchData();
  }, []);

  React.useEffect(() => {
    const fetchChartData = async () => {
        setIsChartLoading(true);
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        
        const scansQuery = query(collection(db, "scan_history"), 
            where("scannedAt", ">=", Timestamp.fromDate(monthStart)),
            where("scannedAt", "<=", Timestamp.fromDate(monthEnd))
        );
        
        const unsubscribe = onSnapshot(scansQuery, (snapshot) => {
            const scansByDate: { [key: string]: number } = {};
            
            snapshot.docs.forEach(doc => {
                const scanDate = doc.data().scannedAt.toDate();
                const dateKey = format(scanDate, "yyyy-MM-dd");
                scansByDate[dateKey] = (scansByDate[dateKey] || 0) + 1;
            });
            
            const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
            
            const chartData = daysInMonth.map(date => {
                const dateKey = format(date, "yyyy-MM-dd");
                return {
                    day: format(date, 'EEEE', { locale: es }),
                    date: format(date, 'dd'),
                    scans: scansByDate[dateKey] || 0
                }
            });

            setMonthlyData(chartData);
            setIsChartLoading(false);
        }, (error) => {
            console.error("Error fetching chart data:", error);
            setIsChartLoading(false);
        });

        return () => unsubscribe();
    };

    fetchChartData();

  }, [currentDate]);


  const filteredChartData = React.useMemo(() => {
      if (selectedDays.length === ALL_DAYS.length) return monthlyData;
      return monthlyData.filter(d => selectedDays.includes(d.day));
  }, [monthlyData, selectedDays]);


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
        <Card className="col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Resumen de Escaneos</CardTitle>
                    <CardDescription className="capitalize">
                        Para {format(currentDate, "MMMM 'de' yyyy", { locale: es })}
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="relative w-full overflow-auto">
              {isChartLoading ? (
                  <div className="flex justify-center items-center h-[350px]">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[350px] w-full min-w-[600px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: 'hsla(var(--card), 0.5)' }}
                        content={<ChartTooltipContent formatter={(value, name, props) => {
                            const { payload } = props;
                            return (
                                <div>
                                    <div className="font-medium">{payload.day} {payload.date}</div>
                                    <div className="text-muted-foreground">{`Escaneos: ${value}`}</div>
                                </div>
                            );
                        }} />}
                      />
                      <Bar dataKey="scans" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </div>
            <div className="flex justify-center pt-4">
                 <ToggleGroup 
                    type="multiple" 
                    variant="outline"
                    value={selectedDays}
                    onValueChange={(value) => {
                        if (value) setSelectedDays(value.length > 0 ? value : ALL_DAYS);
                    }}
                 >
                     {ALL_DAYS.map(day => (
                         <ToggleGroupItem key={day} value={day} aria-label={`Toggle ${day}`}>
                           {day.substring(0, 3)}
                         </ToggleGroupItem>
                     ))}
                 </ToggleGroup>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
