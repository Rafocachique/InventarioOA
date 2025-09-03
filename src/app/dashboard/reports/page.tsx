
"use client"

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
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
        const fetchAllProducts = async () => {
            setIsLoading(true);
            try {
                const productsRef = collection(db, "products");
                const querySnapshot = await getDocs(productsRef);
                const productsData: Product[] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() } as Product));
                setAllProducts(productsData);
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
        fetchAllProducts();
    }, [toast]);

    React.useEffect(() => {
        if (!searchTerm) {
            setFilteredResults([]);
            setHeaders([]);
            return;
        }

        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        
        const results = allProducts.filter(product => 
            Object.values(product).some(value =>
                String(value).toLowerCase().includes(lowerCaseSearchTerm)
            )
        );

        setFilteredResults(results);

        if (results.length > 0) {
            const allKeys = results.reduce((acc, product) => {
                Object.keys(product).forEach(key => acc.add(key));
                return acc;
            }, new Set<string>());

            const sortedHeaders = Array.from(allKeys).filter(key => key !== 'firebaseId');
            setHeaders(sortedHeaders);
        }

    }, [searchTerm, allProducts]);


  return (
    <div className="flex flex-col h-full gap-4 md:gap-8">
        <Card>
            <CardHeader>
                <CardTitle>Búsqueda General de Activos</CardTitle>
                <CardDescription>
                  Escriba en el campo para buscar en tiempo real cualquier activo por cualquiera de sus datos.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative w-full max-w-lg">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        type="search" 
                        placeholder="Buscar por cualquier dato (ID, nombre, responsable, etc.)..." 
                        className="pl-8 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardContent>
        </Card>
        
        {searchTerm && (
        <Card className="flex flex-col flex-grow">
            <CardHeader>
                <CardTitle>Resultados de la Búsqueda</CardTitle>
                 <CardDescription>
                    {`Se encontraron ${filteredResults.length} activos para "${searchTerm}".`}
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
                        {isLoading ? (
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
                             <TableRow><TableCell colSpan={headers.length || 1} className="text-center h-24">No se encontraron activos que coincidan con la búsqueda.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
              </div>
            </CardContent>
        </Card>
        )}
    </div>
  );
}
