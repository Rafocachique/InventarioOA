
"use client"

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { db } from "@/lib/firebase";
import { collection, getDocs, DocumentData } from "firebase/firestore";
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
    const [hasSearched, setHasSearched] = React.useState(false);
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
            if(hasSearched) setHasSearched(false);
            return;
        }

        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        
        const results = allProducts.filter(product => 
            product.Responsable && String(product.Responsable).toLowerCase().includes(lowerCaseSearchTerm)
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

        if(!hasSearched) setHasSearched(true);

    }, [searchTerm, allProducts, hasSearched]);
    
    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            setHasSearched(true);
        }
    };


  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8">
        <Card>
            <CardHeader>
                <CardTitle>Búsqueda de Activos por Responsable</CardTitle>
                <CardDescription>
                  Escriba en el campo para buscar en tiempo real todos los activos asignados a un responsable.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative w-full max-w-lg">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        type="search" 
                        placeholder="Escriba el nombre del responsable..." 
                        className="pl-8 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={handleKeyPress}
                    />
                </div>
            </CardContent>
        </Card>
        
        {searchTerm && hasSearched && (
        <Card>
            <CardHeader>
                <CardTitle>Resultados de la Búsqueda</CardTitle>
                 <CardDescription>
                    {`Se encontraron ${filteredResults.length} activos para "${searchTerm}".`}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative w-full overflow-auto">
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
                            <TableRow><TableCell colSpan={headers.length} className="text-center h-24"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></TableCell></TableRow>
                        ) : filteredResults.length === 0 ? (
                             <TableRow><TableCell colSpan={headers.length || 1} className="text-center h-24">No se encontraron activos para este responsable.</TableCell></TableRow>
                        ) : (
                            filteredResults.map(product => (
                                <TableRow key={product.firebaseId}>
                                    {headers.map(header => (
                                        <TableCell key={header}>
                                            {String(product[header] ?? '')}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
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
