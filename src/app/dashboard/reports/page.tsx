
"use client"

import * as React from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Loader2, Save } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, Timestamp, orderBy, limit, doc, getDocs, updateDoc } from "firebase/firestore";
import { subDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";


interface ScanHistoryItem {
    firebaseId: string;
    scannedAt: Timestamp;
    scannedBy: string;
    [key: string]: any; 
}

interface InventoryStatusItem {
    name: string;
    value: number;
    fill: string;
}

interface DailyScanItem {
    date: string;
    count: number;
}
interface EditableProduct {
  firebaseId: string;
  [key: string]: any;
}


const barChartConfig = {
  count: {
    label: "Escaneos",
    color: "hsl(var(--primary))",
  },
};

const PIE_CHART_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

export default function ReportsPage() {
    const [dailyScans, setDailyScans] = React.useState<DailyScanItem[]>([]);
    const [inventoryStatus, setInventoryStatus] = React.useState<InventoryStatusItem[]>([]);
    const [pieChartConfig, setPieChartConfig] = React.useState<any>({});
    const [recentScans, setRecentScans] = React.useState<ScanHistoryItem[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const [editingRecord, setEditingRecord] = React.useState<EditableProduct | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        setIsLoading(true);

        // --- Listener for Daily Scans ---
        const sevenDaysAgo = startOfDate(subDays(new Date(), 6));
        const dailyScansQuery = query(collection(db, "scan_history"), where("scannedAt", ">=", Timestamp.fromDate(sevenDaysAgo)));
        
        const dailyScansUnsubscribe = onSnapshot(dailyScansQuery, (snapshot) => {
            const scansByDay: { [key: string]: number } = {};
            for (let i = 0; i < 7; i++) {
                const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
                scansByDay[date] = 0;
            }

            snapshot.docs.forEach(doc => {
                const scanDate = doc.data().scannedAt.toDate();
                const dateStr = format(scanDate, 'yyyy-MM-dd');
                if(scansByDay[dateStr] !== undefined){
                    scansByDay[dateStr]++;
                }
            });

            const chartData = Object.entries(scansByDay)
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            setDailyScans(chartData);
        });

        // --- Listener for Inventory Status ---
        const inventoryQuery = query(collection(db, "products"));
        const inventoryUnsubscribe = onSnapshot(inventoryQuery, (snapshot) => {
            const statusCounts: { [key: string]: number } = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const status = data.Estado || 'Sin Estado'; 
                if (statusCounts[status]) {
                    statusCounts[status]++;
                } else {
                    statusCounts[status] = 1;
                }
            });

            const statusData = Object.entries(statusCounts).map(([name, value], index) => ({
                name,
                value,
                fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
            }));
            setInventoryStatus(statusData);

            const newPieConfig = {
                value: { label: 'Inmobiliarios' },
                ...statusData.reduce((acc, cur) => ({ ...acc, [cur.name]: { label: cur.name, color: cur.fill } }), {})
            };
            setPieChartConfig(newPieConfig);
        });

        // --- Listener for Recent Scans ---
        const recentScansQuery = query(collection(db, "scan_history"), orderBy("scannedAt", "desc"), limit(5));
        const recentScansUnsubscribe = onSnapshot(recentScansQuery, (snapshot) => {
            const scans: ScanHistoryItem[] = [];
            snapshot.forEach(doc => {
                scans.push({ firebaseId: doc.id, ...doc.data() } as ScanHistoryItem);
            });
            setRecentScans(scans);
        });

        setIsLoading(false);

        return () => {
            dailyScansUnsubscribe();
            inventoryUnsubscribe();
            recentScansUnsubscribe();
        };

    }, []);

    const startOfDate = (date: Date) => {
        const newDate = new Date(date);
        newDate.setHours(0, 0, 0, 0);
        return newDate;
    };

    const handleEditRecord = (record: ScanHistoryItem) => {
        // We need to find the original product document to edit it.
        // We can use a key from the scan, e.g., 'id' or 'Codbien' to find it.
        const idKey = record.id || record.Codbien;
        if (!idKey) {
            toast({ variant: 'destructive', title: 'Error', description: 'Este registro de escaneo no tiene un identificador único para encontrar el inmobiliario original.' });
            return;
        }

        const findAndEdit = async () => {
            const productsRef = collection(db, "products");
            // Assuming 'id' field is the unique identifier in the 'products' collection
            const q = query(productsRef, where("id", "==", idKey));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ variant: 'destructive', title: 'No Encontrado', description: `No se pudo encontrar el inmobiliario original con id ${idKey}.` });
                return;
            }
            
            const productDoc = querySnapshot.docs[0];
            setEditingRecord({ firebaseId: productDoc.id, ...productDoc.data() });
        }
        
        findAndEdit();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingRecord) return;
        const { id, value } = e.target;
        setEditingRecord({ ...editingRecord, [id]: e.target.type === 'number' ? Number(value) : value });
    };

    const handleSaveChanges = async () => {
        if (!editingRecord || !editingRecord.firebaseId) return;

        setIsSubmitting(true);
        try {
            const productDocRef = doc(db, "products", editingRecord.firebaseId);
            const { firebaseId, ...productData } = editingRecord;
            await updateDoc(productDocRef, productData);
            toast({
                title: "Inmobiliario Actualizado",
                description: "Los cambios se han guardado correctamente.",
            });
            setEditingRecord(null);
        } catch (error) {
            console.error("Error updating product: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el inmobiliario." });
        } finally {
            setIsSubmitting(false);
        }
    };


  return (
    <>
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Reporte de Escaneos Diarios</CardTitle>
                     <CardDescription>Muestra los escaneos realizados en los últimos 7 días.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="relative w-full overflow-auto">
                        <ChartContainer config={barChartConfig} className="h-64 w-full min-w-[300px]">
                            {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto mt-24" /> :
                            <ResponsiveContainer>
                                <BarChart data={dailyScans}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                                </BarChart>
                            </ResponsiveContainer>
                            }
                        </ChartContainer>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Estado del Inventario</CardTitle>
                    <CardDescription>Distribución de inmobiliarios por estado.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="relative w-full overflow-auto">
                        <ChartContainer config={pieChartConfig} className="h-64 w-full min-w-[300px]">
                             {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto mt-24" /> :
                            <ResponsiveContainer>
                                <PieChart>
                                    <Tooltip content={<ChartTooltipContent hideLabel />} />
                                    <Pie data={inventoryStatus} dataKey="value" nameKey="name" innerRadius={50} paddingAngle={2}>
                                        {inventoryStatus.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Legend/>
                                </PieChart>
                            </ResponsiveContainer>
                            }
                        </ChartContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Herramienta de Actualización de Datos</CardTitle>
                <CardDescription>
                  Actualice manualmente los datos de los inmobiliarios desde los escaneos recientes.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative w-full overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Inmobiliario (ID)</TableHead>
                            <TableHead>Denominación</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Hora</TableHead>
                            <TableHead><span className="sr-only">Acciones</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto my-12" /></TableCell></TableRow>
                        ) : recentScans.length === 0 ? (
                             <TableRow><TableCell colSpan={5} className="text-center h-24">No hay escaneos recientes.</TableCell></TableRow>
                        ) : (
                            recentScans.map(scan => (
                                <TableRow key={scan.firebaseId}>
                                    <TableCell className="font-mono">{scan.id || scan.Codbien || 'N/A'}</TableCell>
                                    <TableCell>{scan.Denominacion || 'N/A'}</TableCell>
                                    <TableCell>{scan.scannedBy}</TableCell>
                                    <TableCell>{scan.scannedAt.toDate().toLocaleTimeString('es-ES')}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onSelect={() => handleEditRecord(scan)}>Editar Inmobiliario</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
              </div>
            </CardContent>
        </Card>
    </div>

    {editingRecord && (
        <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Editar Inmobiliario: {editingRecord.Denominacion}</DialogTitle>
                <DialogDescription>Los cambios se guardarán en la base de datos principal.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-6">
                {Object.keys(editingRecord).filter(key => key !== 'firebaseId').map(key => (
                <div key={key} className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor={key} className="text-right capitalize">{key.replace(/_/g, ' ')}</Label>
                    <Input
                    id={key}
                    type={typeof editingRecord[key] === 'number' ? 'number' : 'text'}
                    value={editingRecord[key] ?? ''}
                    onChange={handleInputChange}
                    className="col-span-3"
                    disabled={key === 'id' || key === 'Codbien'}
                    />
                </div>
                ))}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingRecord(null)}>Cancelar</Button>
                <Button onClick={handleSaveChanges} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Cambios
                </Button>
            </DialogFooter>
            </DialogContent>
        </Dialog>
    )}
    </>
  );
}
