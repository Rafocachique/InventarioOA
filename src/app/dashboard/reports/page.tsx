
"use client"
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const dailyScans = [
  { date: '2024-07-01', count: 230 },
  { date: '2024-07-02', count: 250 },
  { date: '2024-07-03', count: 210 },
  { date: '2024-07-04', count: 280 },
  { date: '2024-07-05', count: 310 },
  { date: '2024-07-06', count: 190 },
  { date: '2024-07-07', count: 150 },
];

const barChartConfig = {
  count: {
    label: "Escaneos",
    color: "hsl(var(--primary))",
  },
};

const inventoryStatus = [
  { name: 'En Stock', value: 85000, fill: "hsl(var(--accent))" },
  { name: 'Bajo Stock', value: 15000, fill: "hsl(var(--chart-4))" },
  { name: 'Agotado', value: 5000, fill: "hsl(var(--destructive))" },
];

const pieChartConfig = {
  value: { label: 'Productos' },
  ...inventoryStatus.reduce((acc, cur) => ({ ...acc, [cur.name]: { label: cur.name, color: cur.fill } }), {})
};

const recentScans = [
    { id: "SCAN-987", product: "PROD-001", user: "supervisor1", time: "Hace 5 minutos", status: "Válido" },
    { id: "SCAN-986", product: "XYZ-000", user: "supervisor2", time: "Hace 10 minutos", status: "Inválido" },
    { id: "SCAN-985", product: "PROD-003", user: "supervisor1", time: "Hace 12 minutos", status: "Válido" },
]

export default function ReportsPage() {
  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle>Reporte de Escaneos Diarios</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="relative w-full overflow-auto">
                        <ChartContainer config={barChartConfig} className="h-64 w-full min-w-[300px]">
                            <ResponsiveContainer>
                                <BarChart data={dailyScans}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </div>
                </CardContent>
            </Card>
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle>Estado del Inventario</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center p-0">
                    <div className="relative w-full overflow-auto">
                        <ChartContainer config={pieChartConfig} className="h-64 w-full min-w-[300px]">
                            <ResponsiveContainer>
                                <PieChart>
                                    <Tooltip content={<ChartTooltipContent hideLabel />} />
                                    <Pie data={inventoryStatus} dataKey="value" nameKey="name" innerRadius={50}>
                                        {inventoryStatus.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Legend/>
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>Herramienta de Actualización de Datos</CardTitle>
                <CardDescription>
                  Actualice manually los datos escaneados o el inventario. Aquí se muestran los escaneos recientes.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative w-full overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID Escaneo</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Hora</TableHead>
                             <TableHead>Estado</TableHead>
                            <TableHead><span className="sr-only">Acciones</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recentScans.map(scan => (
                            <TableRow key={scan.id}>
                                <TableCell>{scan.id}</TableCell>
                                <TableCell>{scan.product}</TableCell>
                                <TableCell>{scan.user}</TableCell>
                                <TableCell>{scan.time}</TableCell>
                                <TableCell>{scan.status}</TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem>Corregir ID Producto</DropdownMenuItem>
                                            <DropdownMenuItem>Marcar como Revisado</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </div>
            </CardContent>
        </Card>
    </div>
  );
}

    