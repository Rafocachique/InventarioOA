
"use client"

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, FileDown } from 'lucide-react';
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface Product {
  firebaseId: string;
  [key: string]: any;
}

type ReportFormat = "asignacion" | "baja" | "transferencia" | "";

export default function AssetSearchPage() {
    const [searchTerm, setSearchTerm] = React.useState("");
    const [allProducts, setAllProducts] = React.useState<Product[]>([]);
    const [filteredResults, setFilteredResults] = React.useState<Product[]>([]);
    const [selectedProducts, setSelectedProducts] = React.useState<Product[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [headers, setHeaders] = React.useState<string[]>([]);
    const { toast } = useToast();
    const [selectedFormat, setSelectedFormat] = React.useState<ReportFormat>("");
    
    // State for editable fields
    const [reportHeaderData, setReportHeaderData] = React.useState({
        sede: "SEDE CENTRAL",
        oficina: "OFICINA DE ABASTECIMIENTO Y SERVICIOS AUXILIARES",
        responsableRecibe: "",
        cargoResponsableRecibe: "",
        responsableEntrega: "",
        cargoResponsableEntrega: "",
    });

    const handleReportDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setReportHeaderData(prev => ({...prev, [id]: value}));
    };

    React.useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const columnOrderDocRef = doc(db, "_config", "columnOrder");
                const columnOrderDoc = await getDoc(columnOrderDocRef);
                const storedHeaders = columnOrderDoc.exists() ? columnOrderDoc.data().headers : [];
                
                const productsRef = collection(db, "products");
                const querySnapshot = await getDocs(productsRef);
                const productsData: Product[] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() } as Product));
                setAllProducts(productsData);

                const defaultHeaders = ['Codbien', 'Descrip', 'Marca', 'Modelo', 'Serie', 'Color', 'Observacion'];
                if (storedHeaders.length > 0) {
                    setHeaders(storedHeaders);
                } else if (productsData.length > 0) {
                    setHeaders(Object.keys(productsData[0]).filter(key => key !== 'firebaseId'));
                } else {
                    setHeaders(defaultHeaders);
                }

            } catch (error) {
                console.error("Error fetching assets: ", error);
                toast({
                    variant: "destructive",
                    title: "Error de Carga",
                    description: "No se pudieron cargar los datos de los activos.",
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [toast]);

    React.useEffect(() => {
        if (!searchTerm) {
            setFilteredResults([]);
            return;
        }
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const results = allProducts.filter(product => 
            Object.values(product).some(value =>
                String(value).toLowerCase().includes(lowerCaseSearchTerm)
            )
        );
        setFilteredResults(results);
    }, [searchTerm, allProducts]);

    const handleSelectProduct = (product: Product, isSelected: boolean) => {
        if (isSelected) {
            setSelectedProducts(prev => [...prev, product]);
        } else {
            setSelectedProducts(prev => prev.filter(p => p.firebaseId !== product.firebaseId));
        }
    };

    const isProductSelected = (productId: string) => {
        return selectedProducts.some(p => p.firebaseId === productId);
    };
    
    const displayedHeaders = headers.slice(0, 7);

  return (
    <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Búsqueda General de Activos</CardTitle>
                        <CardDescription>
                            Escriba para buscar en tiempo real cualquier activo por cualquiera de sus datos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="relative w-full">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                type="search" 
                                placeholder="Buscar por ID, nombre, responsable..." 
                                className="pl-8 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <div className="lg:col-span-2 flex flex-col h-full">
                 <Card className="flex flex-col flex-grow">
                    <CardHeader>
                        <CardTitle>Resultados de la Búsqueda</CardTitle>
                        <CardDescription>
                            {searchTerm ? `Se encontraron ${filteredResults.length} activos para "${searchTerm}".` : "Ingrese un término de búsqueda para ver los resultados."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow p-0">
                        <div className="relative w-full h-full overflow-auto max-h-[40vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]"><span className="sr-only">Seleccionar</span></TableHead>
                                        {displayedHeaders.map(header => (
                                            <TableHead key={header}>{header.charAt(0).toUpperCase() + header.slice(1)}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading && searchTerm ? (
                                        <TableRow><TableCell colSpan={displayedHeaders.length + 2} className="text-center h-24"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></TableCell></TableRow>
                                    ) : filteredResults.length > 0 ? (
                                        filteredResults.map(product => (
                                            <TableRow key={product.firebaseId} data-state={isProductSelected(product.firebaseId) ? "selected" : ""}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={isProductSelected(product.firebaseId)}
                                                        onCheckedChange={(checked) => handleSelectProduct(product, !!checked)}
                                                        aria-label="Seleccionar fila"
                                                    />
                                                </TableCell>
                                                {displayedHeaders.map(header => (
                                                    <TableCell key={header} className="whitespace-nowrap">
                                                        {String(product[header] ?? '')}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={displayedHeaders.length + 2} className="text-center h-24">{searchTerm ? "No se encontraron activos que coincidan." : "Los resultados aparecerán aquí."}</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Preparación de Reporte</CardTitle>
                <CardDescription>
                    {selectedProducts.length > 0 
                        ? `Has seleccionado ${selectedProducts.length} activo(s). Elige un formato, completa los datos y genera el reporte.`
                        : "Seleccione uno o más activos de la tabla de resultados para empezar a generar un reporte."
                    }
                </CardDescription>
            </CardHeader>
            <CardContent>
                {selectedProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                           <h3 className="font-semibold mb-4">Activos Seleccionados</h3>
                           <div className="border rounded-lg max-h-80 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Codbien</TableHead>
                                            <TableHead>Descripción</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedProducts.map(p => (
                                            <TableRow key={p.firebaseId}>
                                                <TableCell className="font-medium">{p.Codbien || p.id || 'N/A'}</TableCell>
                                                <TableCell>{p.Descrip || p.description || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                           </div>
                        </div>
                        <div className="md:col-span-2">
                            <h3 className="font-semibold mb-4">Opciones y Datos del Reporte</h3>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="format-select">1. Seleccione el Formato del Reporte</Label>
                                    <Select onValueChange={(value: ReportFormat) => setSelectedFormat(value)} value={selectedFormat}>
                                        <SelectTrigger id="format-select">
                                            <SelectValue placeholder="Elegir tipo de acta..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="asignacion">Acta de Asignación de Bienes</SelectItem>
                                            <SelectItem value="baja">Acta de Baja de Bienes</SelectItem>
                                            <SelectItem value="transferencia">Acta de Transferencia de Bienes</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                {selectedFormat === 'asignacion' && (
                                     <div className="space-y-4 border-t pt-4">
                                        <h4 className="font-medium">2. Complete los datos para el Acta de Asignación</h4>
                                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="sede">Sede</Label>
                                                <Input id="sede" value={reportHeaderData.sede} onChange={handleReportDataChange} />
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="oficina">Oficina</Label>
                                                <Input id="oficina" value={reportHeaderData.oficina} onChange={handleReportDataChange} />
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="responsableRecibe">Responsable (Recibe)</Label>
                                                <Input id="responsableRecibe" placeholder="Nombre completo de quien recibe" value={reportHeaderData.responsableRecibe} onChange={handleReportDataChange} />
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="cargoResponsableRecibe">Cargo (Recibe)</Label>
                                                <Input id="cargoResponsableRecibe" placeholder="Cargo de quien recibe" value={reportHeaderData.cargoResponsableRecibe} onChange={handleReportDataChange} />
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="responsableEntrega">Responsable (Entrega)</Label>
                                                <Input id="responsableEntrega" placeholder="Nombre completo de quien entrega" value={reportHeaderData.responsableEntrega} onChange={handleReportDataChange} />
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="cargoResponsableEntrega">Cargo (Entrega)</Label>
                                                <Input id="cargoResponsableEntrega" placeholder="Cargo de quien entrega" value={reportHeaderData.cargoResponsableEntrega} onChange={handleReportDataChange} />
                                            </div>
                                         </div>
                                     </div>
                                )}
                                {selectedFormat && selectedFormat !== 'asignacion' && (
                                    <div className="text-center text-muted-foreground border-t pt-4">
                                        <p>Los formularios para actas de '{selectedFormat}' estarán disponibles próximamente.</p>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">El área de preparación de reportes aparecerá aquí.</p>
                    </div>
                )}
            </CardContent>
             {selectedProducts.length > 0 && (
                <CardFooter className="flex justify-end border-t pt-6">
                    <Button disabled={!selectedFormat} >
                        <FileDown className="mr-2 h-4 w-4" />
                        Generar PDF (Próximamente)
                    </Button>
                </CardFooter>
            )}
        </Card>
    </div>
  );
}
