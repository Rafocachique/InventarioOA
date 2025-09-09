
"use client";

import * as React from "react";
import {
  FileDown,
  Filter,
  Loader2,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  Printer,
  FileSpreadsheet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";


interface Product {
  id?: string;
  firebaseId?: string;
  [key: string]: any;
}

export default function AdvancedSearchPage() {
  const [allProducts, setAllProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [allHeaders, setAllHeaders] = React.useState<string[]>([]);
  const [searchableHeaders, setSearchableHeaders] = React.useState<Set<string>>(new Set());
  const [visibleTableHeaders, setVisibleTableHeaders] = React.useState<Set<string>>(new Set());
  
  const [globalSearchTerm, setGlobalSearchTerm] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<Record<string, string>>({});
  
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  
  const { toast } = useToast();

  const uniqueColumnValues = React.useMemo(() => {
    const uniqueValues: Record<string, Set<string>> = {};
    if (!allProducts.length) return uniqueValues;

    const potentialSelectColumns = ['estado', 'dependencia', 'sede'];

    potentialSelectColumns.forEach(header => {
      if (allHeaders.includes(header)) {
        uniqueValues[header] = new Set(allProducts.map(p => p[header]).filter(Boolean));
      }
    });
    return uniqueValues;
  }, [allProducts, allHeaders]);


  React.useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const columnOrderDocRef = doc(db, "_config", "columnOrder");
        const columnOrderDoc = await getDoc(columnOrderDocRef);
        const storedHeaders = columnOrderDoc.exists() ? columnOrderDoc.data().headers : [];

        const querySnapshot = await getDocs(collection(db, "products"));
        const productsData = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() } as Product));
        setAllProducts(productsData);

        const headersToUse = storedHeaders.length > 0 ? storedHeaders :
          (productsData.length > 0 ? Object.keys(productsData[0]).filter(key => key !== 'firebaseId') : []);
        
        setAllHeaders(headersToUse);
        setSearchableHeaders(new Set(headersToUse));
        setVisibleTableHeaders(new Set(headersToUse));
      } catch (error) {
        console.error("Error fetching products: ", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudieron cargar los datos para la búsqueda.",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, [toast]);
  
  const handleColumnFilterChange = (header: string, value: string) => {
    setColumnFilters(prev => ({...prev, [header]: value}));
  }

  const filteredProducts = React.useMemo(() => {
    setCurrentPage(1); // Reset page on filter change
    return allProducts.filter(product => {
      // Global search logic (uses partial match)
      const matchesGlobalSearch = globalSearchTerm === "" || Array.from(searchableHeaders).some(header => {
        const value = product[header];
        return value !== null && value !== undefined && String(value).toLowerCase().includes(globalSearchTerm.toLowerCase());
      });

      // Per-column filter logic (uses exact match after normalizing)
      const matchesColumnFilters = Object.entries(columnFilters).every(([header, filterValue]) => {
        if (!filterValue) return true;
        const value = product[header];
        const productValueStr = String(value ?? '').toLowerCase().trim();
        const filterValueStr = String(filterValue).toLowerCase().trim();
        return productValueStr === filterValueStr;
      });
      
      return matchesGlobalSearch && matchesColumnFilters;
    });
  }, [allProducts, globalSearchTerm, searchableHeaders, columnFilters]);

  const paginatedProducts = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const displayedTableHeaders = React.useMemo(() => {
    return allHeaders.filter(h => visibleTableHeaders.has(h));
  }, [allHeaders, visibleTableHeaders]);
  
  const handleExport = (format: 'excel' | 'pdf') => {
    if (filteredProducts.length === 0) {
      toast({ title: "No hay datos", description: "No hay resultados para exportar." });
      return;
    }
    const dataToExport = filteredProducts.map(p => {
        const { firebaseId, ...rest } = p;
        const orderedData: {[key: string]: any} = {};
        allHeaders.forEach(header => {
            orderedData[header] = rest[header] ?? '';
        });
        return orderedData;
    });

    if (format === 'excel') {
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados");
      XLSX.writeFile(workbook, "busqueda_avanzada.xlsx");
    } else {
      const doc = new jsPDF({ orientation: 'landscape' });
      (doc as any).autoTable({
        head: [allHeaders],
        body: dataToExport.map(row => allHeaders.map(header => row[header] ?? '')),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [24, 80, 120] },
      });
      doc.save("busqueda_avanzada.pdf");
    }
  }
  
  const handleToggleAllSearchable = (selectAll: boolean) => {
    if (selectAll) {
        setSearchableHeaders(new Set(allHeaders));
    } else {
        setSearchableHeaders(new Set());
    }
  };
  
  const handleToggleAllVisible = (selectAll: boolean) => {
    if (selectAll) {
        setVisibleTableHeaders(new Set(allHeaders));
    } else {
        setVisibleTableHeaders(new Set());
    }
  };

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 md:gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-4 md:gap-8 lg:col-span-1">
            <Card>
                <CardHeader>
                <CardTitle>Filtros de Búsqueda</CardTitle>
                <CardDescription>
                    Busque globalmente en columnas o filtre por cada una.
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                {/* Global Search */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Buscar en columnas..."
                        className="pl-8 w-full"
                        value={globalSearchTerm}
                        onChange={(e) => setGlobalSearchTerm(e.target.value)}
                    />
                    </div>
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="shrink-0">
                        <Filter className="mr-2 h-4 w-4" />
                        Columnas ({searchableHeaders.size})
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
                        <DropdownMenuLabel>Buscar en Columnas</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => handleToggleAllSearchable(true)}>Marcar Todas</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleToggleAllSearchable(false)}>Desmarcar Todas</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {allHeaders.map(header => (
                        <DropdownMenuCheckboxItem
                            key={header}
                            checked={searchableHeaders.has(header)}
                             onSelect={(e) => e.preventDefault()}
                            onCheckedChange={(checked) => {
                            setSearchableHeaders(prev => {
                                const newSet = new Set(prev);
                                if (checked) newSet.add(header);
                                else newSet.delete(header);
                                return newSet;
                            })
                            }}
                        >
                            {header}
                        </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Per-column Filters */}
                <div>
                    <h3 className="text-base font-medium mb-4">Filtros por Columna</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {allHeaders.map(header => (
                        <div key={header} className="space-y-2">
                        <Label htmlFor={`filter-${header}`}>{header}</Label>
                        {uniqueColumnValues[header] ? (
                            <Select onValueChange={(value) => handleColumnFilterChange(header, value === 'all' ? '' : value)} defaultValue="all">
                                <SelectTrigger id={`filter-${header}`}>
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {Array.from(uniqueColumnValues[header]).map(val => (
                                        <SelectItem key={val} value={val}>{val}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                id={`filter-${header}`}
                                placeholder={`Filtrar por ${header}...`}
                                value={columnFilters[header] || ""}
                                onChange={(e) => handleColumnFilterChange(header, e.target.value)}
                            />
                        )}
                        </div>
                    ))}
                    </div>
                </div>
                </CardContent>
            </Card>
        </div>
      
      <div className="flex flex-col gap-4 md:gap-8 lg:col-span-2">
        <Card className="flex flex-grow flex-col">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                    <CardTitle>Resultados de la Búsqueda</CardTitle>
                    <CardDescription>
                        Mostrando {paginatedProducts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{(currentPage - 1) * itemsPerPage + paginatedProducts.length} de {filteredProducts.length} resultados.
                    </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="items-per-page" className="text-sm whitespace-nowrap">Filas por página</Label>
                        <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
                            <SelectTrigger id="items-per-page" className="h-9 w-[70px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><FileSpreadsheet className="mr-2 h-4 w-4"/>Exportar a Excel</Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><Printer className="mr-2 h-4 w-4"/>Exportar a PDF</Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1">
                                <Settings className="h-4 w-4" />
                                <span>Columnas</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Columnas Visibles en Tabla</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => handleToggleAllVisible(true)}>Marcar Todas</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleToggleAllVisible(false)}>Desmarcar Todas</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {allHeaders.map(header => (
                            <DropdownMenuCheckboxItem
                                key={header}
                                checked={visibleTableHeaders.has(header)}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={(checked) => {
                                    setVisibleTableHeaders(prev => {
                                        const newSet = new Set(prev);
                                        if(checked) newSet.add(header);
                                        else newSet.delete(header);
                                        return newSet;
                                    });
                                }}
                            >
                                {header}
                            </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow p-0">
            <div className="relative h-full w-full overflow-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        {displayedTableHeaders.map(header => <TableHead key={header}>{header}</TableHead>)}
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        <TableRow>
                        <TableCell colSpan={displayedTableHeaders.length} className="h-24 text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                        </TableCell>
                        </TableRow>
                    ) : paginatedProducts.length === 0 ? (
                        <TableRow>
                        <TableCell colSpan={displayedTableHeaders.length} className="h-24 text-center">
                            No se encontraron resultados con los filtros aplicados.
                        </TableCell>
                        </TableRow>
                    ) : (
                        paginatedProducts.map((product) => (
                        <TableRow key={product.firebaseId}>
                            {displayedTableHeaders.map(header => (
                            <TableCell key={header} className="whitespace-nowrap">
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
            <CardFooter className="flex items-center justify-between border-t pt-6">
                <div className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
      </div>
    </div>
  );
}

