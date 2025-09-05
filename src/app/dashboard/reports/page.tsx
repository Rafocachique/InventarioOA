
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
import { format } from "date-fns";


interface Product {
  firebaseId: string;
  Observacion_Reporte?: string;
  [key: string]: any;
}

type ReportFormat = "asignacion" | "baja" | "transferencia" | "";

const reportColumnMapping: Record<string, string | ((product: Product, index: number) => any)> = {
    'Item': (product: Product, index: number) => index + 1,
    'Codigo Patrimonial': 'Codbien',
    'Codigo Interno': 'Codanterio',
    'Denominacion': 'Descrip',
    'Marca': 'Marca',
    'Modelo': 'Modelo',
    'Color': 'Color',
    'Serie': 'Serie',
    'Otros': 'OTROS',
    'Estado de Conservacion': 'Estado',
    'Observaciones': 'Observacion_Reporte'
};

const reportHeaders = [
    'Item',
    'Codigo Patrimonial',
    'Codigo Interno',
    'Denominacion',
    'Marca',
    'Modelo',
    'Color',
    'Serie',
    'Otros',
    'Estado de Conservacion',
    'Observaciones'
];


export default function AssetSearchPage() {
    const [searchTerm, setSearchTerm] = React.useState("");
    const [allProducts, setAllProducts] = React.useState<Product[]>([]);
    const [filteredResults, setFilteredResults] = React.useState<Product[]>([]);
    const [selectedProducts, setSelectedProducts] = React.useState<Product[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [headers, setHeaders] = React.useState<string[]>([]);
    const { toast } = useToast();
    const [selectedFormat, setSelectedFormat] = React.useState<ReportFormat>("");
    
    const [reportHeaderData, setReportHeaderData] = React.useState({
        entidad: "UNIVERSIDAD NACIONAL FEDERICO VILLARREAL",
        fecha: format(new Date(), "dd.MM.yyyy"),
        nombreApellidos: "",
        dni: "",
        correo: "",
        organo: "",
        localSede: "",
        direccion: "",
        oficinaArea: "",
        numeroMovimiento: "",
        motivo: "",
        tipo: "",
        salida: "",
        mantenimiento: "",
        reingreso: "",
        comisionServicio: "",
        desplazamiento: "",
        capacitacionEvento: "",
        remiteNombre: "",
        remiteDNI: "",
        remiteCorreo: "",
        remiteUnidadOrganica: "",
        remiteLocalSede: "",
        remiteOficio: "",
        recibeNombre: "",
        recibeDNI: "",
        recibeCorreo: "",
        recibeUnidadOrganica: "",
        recibeLocalSede: "",
        recibeDocumento: "",
        datosVehiculo: "",
        nombreResponsableTraslado: "",
        nombreUnidadPatrimonio: "",
    });


    const handleReportDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setReportHeaderData(prev => ({...prev, [id]: value}));
    };
    
    const handleObservationChange = (firebaseId: string, value: string) => {
        const newSelectedProducts = selectedProducts.map(p => 
            p.firebaseId === firebaseId ? { ...p, Observacion_Reporte: value } : p
        );
        setSelectedProducts(newSelectedProducts);
        
        // Also update in allProducts to persist the observation if the user deselects and reselects it
        const newAllProducts = allProducts.map(p => 
            p.firebaseId === firebaseId ? { ...p, Observacion_Reporte: value } : p
        );
        setAllProducts(newAllProducts);
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

                if (storedHeaders.length > 0) {
                    setHeaders(storedHeaders);
                } else if (productsData.length > 0) {
                    setHeaders(Object.keys(productsData[0]).filter(key => key !== 'firebaseId'));
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
            // Add product, initializing Observacion_Reporte from existing Observacion field or empty string
            setSelectedProducts(prev => [...prev, { ...product, Observacion_Reporte: product.Observacion || "" }]);
        } else {
            setSelectedProducts(prev => prev.filter(p => p.firebaseId !== product.firebaseId));
        }
    };

    const isProductSelected = (productId: string) => {
        return selectedProducts.some(p => p.firebaseId === productId);
    };
    
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
                                        {headers.map(header => (
                                            <TableHead key={header}>{header.charAt(0).toUpperCase() + header.slice(1)}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading && searchTerm ? (
                                        <TableRow><TableCell colSpan={headers.length + 1} className="text-center h-24"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></TableCell></TableRow>
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
                                                {headers.map(header => (
                                                    <TableCell key={header} className="whitespace-nowrap">
                                                        {String(product[header] ?? '')}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={headers.length + 1} className="text-center h-24">{searchTerm ? "No se encontraron activos que coincidan." : "Los resultados aparecerán aquí."}</TableCell></TableRow>
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
                        <div className="md:col-span-3">
                           <h3 className="font-semibold mb-4">Activos Seleccionados</h3>
                           <div className="border rounded-lg max-h-80 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {reportHeaders.map(header => (
                                                <TableHead key={header}>{header}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedProducts.map((p, index) => (
                                            <TableRow key={p.firebaseId}>
                                                {reportHeaders.map(header => {
                                                    const keyOrFn = reportColumnMapping[header];
                                                    let cellContent;

                                                    if (typeof keyOrFn === 'function') {
                                                        cellContent = keyOrFn(p, index);
                                                    } else if (keyOrFn === 'Observacion_Reporte') {
                                                        cellContent = (
                                                            <Input 
                                                                type="text"
                                                                value={p.Observacion_Reporte || ''}
                                                                onChange={(e) => handleObservationChange(p.firebaseId, e.target.value)}
                                                                className="h-8 min-w-[150px]"
                                                            />
                                                        );
                                                    } else {
                                                        cellContent = String(p[keyOrFn] ?? '');
                                                    }

                                                    return <TableCell key={header} className="whitespace-nowrap">{cellContent}</TableCell>;
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                           </div>
                        </div>
                        <div className="md:col-span-3">
                            <h3 className="font-semibold mb-4 mt-6">Opciones y Datos del Reporte</h3>
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
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label htmlFor="entidad">Entidad u Organización</Label>
                                                <Input id="entidad" value={reportHeaderData.entidad} onChange={handleReportDataChange} />
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="fecha">Fecha</Label>
                                                <Input id="fecha" value={reportHeaderData.fecha} onChange={handleReportDataChange} />
                                            </div>
                                             <div className="space-y-2">
                                                 <Label htmlFor="nombreApellidos">Nombre y Apellidos</Label>
                                                <Input id="nombreApellidos" placeholder="Nombre completo del usuario" value={reportHeaderData.nombreApellidos} onChange={handleReportDataChange} />
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="dni">N° DNI</Label>
                                                <Input id="dni" placeholder="DNI del usuario" value={reportHeaderData.dni} onChange={handleReportDataChange} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="correo">Correo Electrónico</Label>
                                                <Input id="correo" placeholder="Correo del usuario" value={reportHeaderData.correo} onChange={handleReportDataChange} />
                                            </div>
                                             <div className="space-y-2 sm:col-span-2">
                                                <Label htmlFor="organo">Órgano o Unidad Orgánica</Label>
                                                <Input id="organo" value={reportHeaderData.organo} onChange={handleReportDataChange} />
                                            </div>
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label htmlFor="direccion">Dirección</Label>
                                                <Input id="direccion" value={reportHeaderData.direccion} onChange={handleReportDataChange} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="localSede">Local o Sede</Label>
                                                <Input id="localSede" value={reportHeaderData.localSede} onChange={handleReportDataChange} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="oficinaArea">Oficina o Área</Label>
                                                <Input id="oficinaArea" value={reportHeaderData.oficinaArea} onChange={handleReportDataChange} />
                                            </div>
                                         </div>
                                     </div>
                                )}
                                {(selectedFormat === 'baja' || selectedFormat === 'transferencia') && (
                                    <div className="space-y-6 border-t pt-4">
                                        <h4 className="font-medium">2. Complete los datos para el Acta de {selectedFormat.charAt(0).toUpperCase() + selectedFormat.slice(1)}</h4>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                            <div className="space-y-2 sm:col-span-2"><Label htmlFor="entidad">Entidad</Label><Input id="entidad" value={reportHeaderData.entidad} onChange={handleReportDataChange} /></div>
                                            
                                            <div className="space-y-2"><Label htmlFor="tipo">Tipo</Label><Input id="tipo" value={reportHeaderData.tipo} onChange={handleReportDataChange} /></div>
                                            <div className="space-y-2"><Label htmlFor="motivo">Motivo</Label><Input id="motivo" value={reportHeaderData.motivo} onChange={handleReportDataChange} /></div>
                                            <div className="space-y-2"><Label htmlFor="salida">Salida</Label><Input id="salida" value={reportHeaderData.salida} onChange={handleReportDataChange} /></div>
                                            <div className="space-y-2"><Label htmlFor="mantenimiento">Mantenimiento</Label><Input id="mantenimiento" value={reportHeaderData.mantenimiento} onChange={handleReportDataChange} /></div>
                                            <div className="space-y-2"><Label htmlFor="reingreso">Reingreso</Label><Input id="reingreso" value={reportHeaderData.reingreso} onChange={handleReportDataChange} /></div>
                                            <div className="space-y-2"><Label htmlFor="comisionServicio">Comisión Servicio</Label><Input id="comisionServicio" value={reportHeaderData.comisionServicio} onChange={handleReportDataChange} /></div>
                                            <div className="space-y-2"><Label htmlFor="numeroMovimiento">Número Movimiento</Label><Input id="numeroMovimiento" value={reportHeaderData.numeroMovimiento} onChange={handleReportDataChange} /></div>
                                            <div className="space-y-2"><Label htmlFor="desplazamiento">Desplazamiento</Label><Input id="desplazamiento" value={reportHeaderData.desplazamiento} onChange={handleReportDataChange} /></div>
                                            <div className="space-y-2 sm:col-span-2"><Label htmlFor="capacitacionEvento">Capacitación o Evento</Label><Input id="capacitacionEvento" value={reportHeaderData.capacitacionEvento} onChange={handleReportDataChange} /></div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t">
                                            <div>
                                                <h5 className="font-semibold mb-2">Datos del Responsable del Remite</h5>
                                                <div className="space-y-2">
                                                    <Label htmlFor="remiteNombre">Nombre y Apellidos</Label><Input id="remiteNombre" value={reportHeaderData.remiteNombre} onChange={handleReportDataChange} />
                                                    <Label htmlFor="remiteDNI">DNI</Label><Input id="remiteDNI" value={reportHeaderData.remiteDNI} onChange={handleReportDataChange} />
                                                    <Label htmlFor="remiteCorreo">Correo Electrónico</Label><Input id="remiteCorreo" value={reportHeaderData.remiteCorreo} onChange={handleReportDataChange} />
                                                    <Label htmlFor="remiteUnidadOrganica">Unidad Orgánica</Label><Input id="remiteUnidadOrganica" value={reportHeaderData.remiteUnidadOrganica} onChange={handleReportDataChange} />
                                                    <Label htmlFor="remiteLocalSede">Local o Sede</Label><Input id="remiteLocalSede" value={reportHeaderData.remiteLocalSede} onChange={handleReportDataChange} />
                                                    <Label htmlFor="remiteOficio">Oficio</Label><Input id="remiteOficio" value={reportHeaderData.remiteOficio} onChange={handleReportDataChange} />
                                                </div>
                                            </div>
                                            <div>
                                                <h5 className="font-semibold mb-2">Datos del Responsable del Recibe</h5>
                                                <div className="space-y-2">
                                                    <Label htmlFor="recibeNombre">Nombre y Apellidos</Label><Input id="recibeNombre" value={reportHeaderData.recibeNombre} onChange={handleReportDataChange} />
                                                    <Label htmlFor="recibeDNI">DNI</Label><Input id="recibeDNI" value={reportHeaderData.recibeDNI} onChange={handleReportDataChange} />
                                                    <Label htmlFor="recibeCorreo">Correo Electrónico</Label><Input id="recibeCorreo" value={reportHeaderData.recibeCorreo} onChange={handleReportDataChange} />
                                                    <Label htmlFor="recibeUnidadOrganica">Unidad Orgánica</Label><Input id="recibeUnidadOrganica" value={reportHeaderData.recibeUnidadOrganica} onChange={handleReportDataChange} />
                                                    <Label htmlFor="recibeLocalSede">Local o Sede</Label><Input id="recibeLocalSede" value={reportHeaderData.recibeLocalSede} onChange={handleReportDataChange} />
                                                    <Label htmlFor="recibeDocumento">Documento</Label><Input id="recibeDocumento" value={reportHeaderData.recibeDocumento} onChange={handleReportDataChange} />
                                                </div>
                                            </div>
                                        </div>
                                         {selectedFormat === 'transferencia' && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t">
                                                <div className="space-y-2"><Label htmlFor="datosVehiculo">Datos Vehículo</Label><Input id="datosVehiculo" value={reportHeaderData.datosVehiculo} onChange={handleReportDataChange} /></div>
                                                <div className="space-y-2"><Label htmlFor="nombreResponsableTraslado">Nombre y firma Responsable del traslado</Label><Input id="nombreResponsableTraslado" value={reportHeaderData.nombreResponsableTraslado} onChange={handleReportDataChange} /></div>
                                                <div className="space-y-2 sm:col-span-2"><Label htmlFor="nombreUnidadPatrimonio">Nombre y firma Unidad Patrimonio</Label><Input id="nombreUnidadPatrimonio" value={reportHeaderData.nombreUnidadPatrimonio} onChange={handleReportDataChange} /></div>
                                            </div>
                                        )}
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
