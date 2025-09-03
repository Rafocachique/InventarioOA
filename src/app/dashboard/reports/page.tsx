
"use client"

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, DocumentData } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface Product {
  firebaseId: string;
  [key: string]: any;
}

export default function AssetSearchPage() {
    const [searchTerm, setSearchTerm] = React.useState("");
    const [results, setResults] = React.useState<Product[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [hasSearched, setHasSearched] = React.useState(false);
    const [headers, setHeaders] = React.useState<string[]>([]);
    const { toast } = useToast();

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            toast({
                variant: "destructive",
                title: "Término de Búsqueda Vacío",
                description: "Por favor, ingrese un nombre para buscar.",
            });
            return;
        }

        setIsLoading(true);
        setResults([]);
        setHasSearched(true);
        
        const upperCaseSearchTerm = searchTerm.toUpperCase();

        try {
            const productsRef = collection(db, "products");
            // Perform a case-insensitive search by querying for the uppercase version of the name.
            const responsibleQuery = query(productsRef, 
                where("Responsable", ">=", upperCaseSearchTerm), 
                where("Responsable", "<=", upperCaseSearchTerm + '\uf8ff')
            );

            const querySnapshot = await getDocs(responsibleQuery);
            
            const foundProducts: Product[] = [];
            querySnapshot.forEach((doc) => {
                foundProducts.push({ firebaseId: doc.id, ...doc.data() } as Product);
            });

            setResults(foundProducts);

            if (foundProducts.length > 0) {
                // Get all unique keys from the results to build table headers
                const allKeys = foundProducts.reduce((acc, product) => {
                    Object.keys(product).forEach(key => acc.add(key));
                    return acc;
                }, new Set<string>());

                const sortedHeaders = Array.from(allKeys).filter(key => key !== 'firebaseId');
                setHeaders(sortedHeaders);
            }

        } catch (error) {
            console.error("Error searching assets: ", error);
            toast({
                variant: "destructive",
                title: "Error de Búsqueda",
                description: "Ocurrió un error al buscar en la base de datos. Es posible que necesite crear un índice en Firestore para el campo 'Responsable'.",
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    };


  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8">
        <Card>
            <CardHeader>
                <CardTitle>Búsqueda de Activos por Responsable</CardTitle>
                <CardDescription>
                  Ingrese el nombre del responsable para encontrar todos los activos inmobiliarios asignados a esa persona.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex w-full max-w-lg items-center space-x-2">
                    <Input 
                        type="text" 
                        placeholder="Nombre del responsable..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={handleKeyPress}
                    />
                    <Button onClick={handleSearch} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        Buscar
                    </Button>
                </div>
            </CardContent>
        </Card>
        
        {hasSearched && (
        <Card>
            <CardHeader>
                <CardTitle>Resultados de la Búsqueda</CardTitle>
                 <CardDescription>
                    {isLoading ? "Buscando..." : `Se encontraron ${results.length} activos para "${searchTerm}".`}
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
                        ) : results.length === 0 ? (
                             <TableRow><TableCell colSpan={headers.length || 1} className="text-center h-24">No se encontraron activos para este responsable.</TableCell></TableRow>
                        ) : (
                            results.map(product => (
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
