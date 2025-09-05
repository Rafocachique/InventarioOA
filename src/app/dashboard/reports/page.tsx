
"use client"

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
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
    const [isLoading, setIsLoading] = React.useState(true);
    const [headers, setHeaders] = React.useState<string[]>([]);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                // Fetch column order first
                const columnOrderDocRef = doc(db, "_config", "columnOrder");
                const columnOrderDoc = await getDoc(columnOrderDocRef);
                const storedHeaders = columnOrderDoc.exists() ? columnOrderDoc.data().headers : [];
                

                // Fetch all products
                const productsRef = collection(db, "products");
                const querySnapshot = await getDocs(productsRef);
                const productsData: Product[] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() } as Product));
                setAllProducts(productsData);

                if (storedHeaders.length > 0) {
                    setHeaders(storedHeaders);
                } else if (productsData.length > 0) {
                    // Fallback to keys from first product if no order is stored
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


  return (
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
                    <div className="relative w-full h-full overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {headers.map(header => (
                                        <TableHead key={header}>{header.charAt(0).toUpperCase() + header.slice(1)}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && searchTerm ? (
                                    <TableRow><TableCell colSpan={headers.length || 1} className="text-center h-24"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></TableCell></TableRow>
                                ) : filteredResults.length > 0 ? (
                                    filteredResults.map(product => (
                                        <TableRow key={product.firebaseId}>
                                            {headers.map(header => (
                                                <TableCell key={header} className="whitespace-nowrap">
                                                    {String(product[header] ?? '')}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={headers.length || 1} className="text-center h-24">{searchTerm ? "No se encontraron activos que coincidan." : "Los resultados aparecerán aquí."}</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

    