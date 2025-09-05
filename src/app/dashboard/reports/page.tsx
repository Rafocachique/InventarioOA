
"use client"

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, FileDown } from 'lucide-react';
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface Product {
  firebaseId: string;
  [key: string]: any;
}

export default function AssetSearchPage() {
    const [searchTerm, setSearchTerm] = React.useState("");
    const [allProducts, setAllProducts] = React.useState<Product[]>([]);
    const [filteredResults, setFilteredResults] = React.useState<Product[]>([]);
    const [selectedProducts, setSelectedProducts] = React.useState<Product[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [headers, setHeaders] = React.useState<string[]>([]);
    const { toast } = useToast();

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
            setSelectedProducts(prev => [...prev, product]);
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
                                        <TableRow><TableCell colSpan={headers.length + 2} className="text-center h-24"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></TableCell></TableRow>
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
                                        <TableRow><TableCell colSpan={headers.length + 2} className="text-center h-24">{searchTerm ? "No se encontraron activos que coincidan." : "Los resultados aparecerán aquí."}</TableCell></TableRow>
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
                        ? `Has seleccionado ${selectedProducts.length} activo(s). Elige un formato y genera el reporte en PDF.`
                        : "Seleccione uno o más activos de la tabla de resultados para empezar a generar un reporte."
                    }
                </CardDescription>
            </CardHeader>
            <CardContent>
                {selectedProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                           <h3 className="font-semibold mb-2">Activos Seleccionados</h3>
                           <div className="border rounded-lg max-h-60 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Codbien</TableHead>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead>Marca</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedProducts.map(p => (
                                            <TableRow key={p.firebaseId}>
                                                <TableCell>{p.Codbien || p.id || 'N/A'}</TableCell>
                                                <TableCell>{p.Descrip || p.description || 'N/A'}</TableCell>
                                                <TableCell>{p.Marca || p.brand || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                           </div>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2">Opciones de Formato</h3>
                            <div className="flex flex-col gap-4">
                                {/* Aquí irán los campos editables y el selector de formato */}
                                <p className="text-sm text-muted-foreground">Próximamente: Selector de formato y campos editables.</p>
                                <Button disabled>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Generar PDF (Próximamente)
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">El área de preparación aparecerá aquí.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}

    