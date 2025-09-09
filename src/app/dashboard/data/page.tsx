
"use client";

import * as React from "react";
import {
  File,
  ListFilter,
  MoreHorizontal,
  PlusCircle,
  QrCode,
  Upload,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Settings,
  Download,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from "next/image";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, writeBatch, deleteDoc, query, orderBy, limit, getDoc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

interface Product {
  id?: string;
  firebaseId?: string;
  [key: string]: any;
}


export default function DataManagementPage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deletePassword, setDeletePassword] = React.useState("");
  const [productToDelete, setProductToDelete] = React.useState<Product | null>(null);


  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [allHeaders, setAllHeaders] = React.useState<string[]>([]);
  const [visibleHeaders, setVisibleHeaders] = React.useState<Set<string>>(new Set());
  const [searchColumns, setSearchColumns] = React.useState<Set<string>>(new Set());


  const fetchProducts = React.useCallback(async () => {
    setIsLoading(true);
    try {
        const columnOrderDocRef = doc(db, "_config", "columnOrder");
        const columnOrderDoc = await getDoc(columnOrderDocRef);
        const storedHeaders = columnOrderDoc.exists() ? columnOrderDoc.data().headers : [];

        const querySnapshot = await getDocs(collection(db, "products"));
        const productsData = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() } as Product));
        setProducts(productsData);

        const headersToUse = storedHeaders.length > 0 ? storedHeaders : 
            (productsData.length > 0 ? Object.keys(productsData[0]).filter(key => key !== 'firebaseId') : []);
        
        setAllHeaders(headersToUse);

        if (visibleHeaders.size === 0 && headersToUse.length > 0) {
            setVisibleHeaders(new Set(headersToUse));
        } else if (visibleHeaders.size === 0 && headersToUse.length === 0) {
            setVisibleHeaders(new Set());
        }
        
        if (searchColumns.size === 0 && headersToUse.length > 0) {
            setSearchColumns(new Set(headersToUse));
        }

    } catch (error) {
      console.error("Error fetching products: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los inmobiliarios.",
      });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast({
        variant: "destructive",
        title: "Ningún Archivo Seleccionado",
        description: "Por favor, seleccione un archivo de Excel para cargar.",
      });
      return;
    }

    setIsUploading(true);
    setProgress(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (!jsonData || jsonData.length < 1) {
             toast({
                variant: "destructive",
                title: "Archivo Inválido",
                description: "El archivo de Excel parece estar vacío o no tiene un encabezado.",
            });
            setIsUploading(false);
            return;
        }
        
        const headersFromExcel: string[] = jsonData[0].map(header => String(header).trim());
        const newProductsData = XLSX.utils.sheet_to_json(worksheet) as Product[];

        if (newProductsData.length === 0) {
          toast({
            variant: "destructive",
            title: "Archivo Vacío",
            description: "El archivo de Excel no contiene datos.",
          });
          setIsUploading(false);
          return;
        }

        const productsCollection = collection(db, "products");
        const querySnapshot = await getDocs(productsCollection);
        const existingProductsMap = new Map<string, { firebaseId: string, data: Product }>();
        querySnapshot.docs.forEach(doc => {
          const productData = doc.data() as Product;
          const identifierKey = Object.keys(productData).find(k => k.toLowerCase() === 'codbien' || k.toLowerCase() === 'id');
          if (identifierKey && productData[identifierKey]) {
            existingProductsMap.set(String(productData[identifierKey]), { firebaseId: doc.id, data: productData });
          }
        });

        const batch = writeBatch(db);
        let updatedCount = 0;
        let newCount = 0;

        const totalSteps = newProductsData.length;
        let completedSteps = 0;

        const updateProgress = () => {
          completedSteps++;
          const currentProgress = Math.min(Math.round((completedSteps / totalSteps) * 100), 90);
          setProgress(currentProgress);
        };
        
        const identifierKeyInExcel = headersFromExcel.find(h => h.toLowerCase() === 'codbien' || h.toLowerCase() === 'id') || headersFromExcel[0];

        newProductsData.forEach((newProduct) => {
          const productId = String(newProduct[identifierKeyInExcel] || '').trim();

          if (!productId || productId === 'undefined') {
              const docRef = doc(collection(db, "products"));
              batch.set(docRef, newProduct);
              newCount++;
          } else if (existingProductsMap.has(productId)) {
            const existing = existingProductsMap.get(productId)!;
            const docRef = doc(db, "products", existing.firebaseId);
            batch.update(docRef, newProduct);
            updatedCount++;
          } else {
            const docRef = doc(collection(db, "products"));
            batch.set(docRef, newProduct);
            newCount++;
          }
          updateProgress();
        });


        await batch.commit();

        // Save column order
        const columnOrderDocRef = doc(db, "_config", "columnOrder");
        await setDoc(columnOrderDocRef, { headers: headersFromExcel });


        setProgress(100);

        toast({
          title: "Carga Exitosa",
          description: `${newCount} inmobiliarios nuevos añadidos y ${updatedCount} inmobiliarios actualizados.`,
        });

        setTimeout(() => {
          setIsUploading(false);
          setIsUploadDialogOpen(false);
          setUploadFile(null);
          setAllHeaders(headersFromExcel);
          setVisibleHeaders(new Set(headersFromExcel));
          fetchProducts();
          setProgress(0);
        }, 1000);

      } catch (error) {
        console.error("Error uploading products: ", error);
        toast({
          variant: "destructive",
          title: "Error de Carga",
          description: "No se pudieron procesar o guardar los datos del archivo.",
        });
        setIsUploading(false);
      }
    };
    reader.readAsArrayBuffer(uploadFile);
  };
  
    const handleDownloadExcel = async () => {
      const dataToExport = filteredProducts;

      if (dataToExport.length === 0) {
          toast({
              title: "No hay datos",
              description: "No hay inmobiliarios que coincidan con la búsqueda actual para exportar.",
          });
          return;
      }

      try {
          const orderedData = dataToExport.map(product => {
              const orderedProduct: Product = {};
              allHeaders.forEach(header => {
                  if (header in product) {
                      orderedProduct[header] = product[header];
                  }
              });
              return orderedProduct;
          });

          const worksheet = XLSX.utils.json_to_sheet(orderedData, { header: allHeaders });
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Inmobiliarios");
          XLSX.writeFile(workbook, "inmobiliarios.xlsx");
      } catch (error) {
          console.error("Error downloading excel: ", error);
          toast({
              variant: "destructive",
              title: "Error de Descarga",
              description: "No se pudieron descargar los datos.",
          });
      }
  };


  const handleDeleteAllData = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      toast({
        variant: "destructive",
        title: "Error de Autenticación",
        description: "No se pudo verificar el usuario. Por favor, inicie sesión de nuevo.",
      });
      return;
    }
     if (!deletePassword) {
      toast({
        variant: "destructive",
        title: "Contraseña Requerida",
        description: "Debe ingresar su contraseña para confirmar.",
      });
      return;
    }


    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      
      toast({
        title: "Eliminando datos...",
        description: "Este proceso puede tardar unos momentos.",
      });

      const productsRef = collection(db, "products");
      const querySnapshot = await getDocs(productsRef);
      const batch = writeBatch(db);
      
      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();

      toast({
        title: "Eliminación Completa",
        description: "Todos los inmobiliarios han sido eliminados de la base de datos.",
      });

      fetchProducts(); 
      setIsDeleteDialogOpen(false);
      setDeletePassword("");

    } catch (error: any) {
        let description = "Ocurrió un error inesperado.";
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            description = "La contraseña ingresada es incorrecta. Por favor, inténtelo de nuevo.";
        }
        console.error("Error deleting all data:", error);
        toast({
            variant: "destructive",
            title: "Error de Eliminación",
            description: description,
        });
    }
};


  const handleEdit = (product: Product) => {
    setEditingProduct(product);
  }

  const handleDeleteProduct = async () => {
    if (!productToDelete || !productToDelete.firebaseId) return;

    try {
        await deleteDoc(doc(db, "products", productToDelete.firebaseId));
        toast({
            title: "Inmobiliario Eliminado",
            description: `El inmobiliario ${productToDelete.name || productToDelete.id} ha sido eliminado.`,
        });
        setProductToDelete(null);
        fetchProducts();
    } catch (error) {
        console.error("Error deleting product: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo eliminar el inmobiliario.",
        });
    }
  };


  const handleSaveEdit = async () => {
    if (!editingProduct || !editingProduct.firebaseId) return;

    try {
      const productDocRef = doc(db, "products", editingProduct.firebaseId);
      const { firebaseId, ...productData } = editingProduct;
      await updateDoc(productDocRef, productData);
      toast({
        title: "Inmobiliario Actualizado",
        description: "Los cambios se han guardado correctamente.",
      });
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error("Error updating product: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el inmobiliario.",
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingProduct) return;
    const { id, value } = e.target;
    setEditingProduct({ ...editingProduct, [id]: e.target.type === 'number' ? Number(value) : value });
  };

  const filteredProducts = React.useMemo(() => {
    setCurrentPage(1);
    if (!searchTerm) {
        return products;
    }
    return products.filter(product =>
        Array.from(searchColumns).some(header =>
            String(product[header]).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );
  }, [products, searchTerm, searchColumns]);

  const paginatedProducts = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  
  const handleColumnVisibilityChange = (header: string, checked: boolean) => {
    setVisibleHeaders(prev => {
        const newSet = new Set(prev);
        if (checked) {
            newSet.add(header);
        } else {
            newSet.delete(header);
        }
        return newSet;
    });
  };

  const handleToggleAllColumns = (selectAll: boolean) => {
    if (selectAll) {
        setVisibleHeaders(new Set(allHeaders));
    } else {
        setVisibleHeaders(new Set());
    }
  };
  
    const handleSearchColumnChange = (header: string, checked: boolean) => {
    setSearchColumns(prev => {
        const newSet = new Set(prev);
        if (checked) {
            newSet.add(header);
        } else {
            newSet.delete(header);
        }
        return newSet;
    });
  };

  const handleToggleAllSearchColumns = (selectAll: boolean) => {
      if (selectAll) {
          setSearchColumns(new Set(allHeaders));
      } else {
          setSearchColumns(new Set());
      }
  };


  const displayedHeaders = React.useMemo(() => {
    return allHeaders.filter(h => visibleHeaders.has(h));
  }, [allHeaders, visibleHeaders]);


  return (
    <div className="grid flex-1 grid-cols-1 gap-4 md:gap-8 lg:grid-cols-3">
      <div className="flex flex-col gap-4 md:gap-8 lg:col-span-1">
        
        <Card>
          <CardHeader>
            <CardTitle>Acciones de Datos</CardTitle>
            <CardDescription>
                Cargue, descargue o elimine datos en masa.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                  <Button size="sm" className="h-9 gap-1" style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                  <Upload className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Cargar Datos
                  </span>
                  </Button>
              </DialogTrigger>
              <DialogContent>
                  <DialogHeader>
                  <DialogTitle>Carga de Datos desde Excel</DialogTitle>
                  <DialogDescription>
                      Seleccione un archivo .xlsx o .xls para cargar. El sistema añadirá nuevos inmobiliarios y actualizará los existentes basándose en la columna 'id' o 'Codbien'.
                  </DialogDescription>
                  </DialogHeader>
                  {isUploading ? (
                  <div className="flex flex-col gap-4 py-4">
                      <p>Procesando y guardando en Firebase...</p>
                      <Progress value={progress} />
                      <p className="text-center text-sm text-muted-foreground">{progress}% completado</p>
                  </div>
                  ) : (
                  <div className="grid gap-4 py-4">
                      <Label htmlFor="excel-file">Archivo de Excel</Label>
                      <Input id="excel-file" type="file" onChange={handleFileUpload} accept=".xlsx, .xls" />
                      {uploadFile && <p className="text-sm text-muted-foreground">Archivo seleccionado: {uploadFile.name}</p>}
                  </div>
                  )}
                  <DialogFooter>
                  {!isUploading && (
                      <>
                      <Button variant="outline" onClick={() => { setIsUploadDialogOpen(false); setUploadFile(null); }}>Cancelar</Button>
                      <Button onClick={handleUpload} disabled={!uploadFile}>Cargar y Procesar</Button>
                      </>
                  )}
                  </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="outline" className="h-9 gap-1" onClick={handleDownloadExcel}>
                <Download className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Descargar
                </span>
            </Button>
             <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="h-9 gap-1">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Eliminar Todo
                  </span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción es irreversible y eliminará **todos** los inmobiliarios de la base de datos.
                    Para confirmar, por favor ingrese su contraseña de administrador.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                 <div className="grid gap-4 py-4">
                    <Label htmlFor="delete-password">Contraseña</Label>
                    <Input id="delete-password" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="••••••••" />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeletePassword("")}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAllData} disabled={!deletePassword}>Confirmar y Eliminar Todo</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visualización</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center gap-2">
                <Label htmlFor="items-per-page" className="text-sm whitespace-nowrap">Filas por página</Label>
                <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
                    <SelectTrigger id="items-per-page" className="h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center justify-between">
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
                      <span className="sr-only">Página anterior</span>
                  </Button>
                  <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                  >
                      <ChevronRight className="h-4 w-4" />
                      <span className="sr-only">Página siguiente</span>
                  </Button>
              </div>
            </div>
             <div className="text-xs text-muted-foreground">
                Mostrando <strong>{paginatedProducts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{(currentPage - 1) * itemsPerPage + paginatedProducts.length}</strong> de <strong>{filteredProducts.length}</strong> inmobiliarios
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Búsqueda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder="Buscar..." 
                className="pl-8 w-full" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full">
                  <ListFilter className="mr-2 h-4 w-4" />
                  Filtros de Búsqueda ({searchColumns.size})
                  </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Buscar en columnas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => handleToggleAllSearchColumns(true)}>Marcar Todas</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleToggleAllSearchColumns(false)}>Desmarcar Todas</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="max-h-64 overflow-y-auto">
                    {allHeaders.map(header => (
                    <DropdownMenuCheckboxItem
                        key={header}
                        checked={searchColumns.has(header)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) => handleSearchColumnChange(header, checked)}
                    >
                        {header.charAt(0).toUpperCase() + header.slice(1)}
                    </DropdownMenuCheckboxItem>
                    ))}
                  </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 md:gap-8 lg:col-span-2">
          <Card className="flex flex-grow flex-col">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                    <CardTitle>Inventario Inmobiliario de la OA</CardTitle>
                    <CardDescription>
                        Gestiona tus inmobiliarios y visualiza su inventario.
                    </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 gap-1">
                          <Settings className="h-4 w-4" />
                          <span>Columnas</span>
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                          <DropdownMenuLabel>Columnas Visibles</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handleToggleAllColumns(true)}>Marcar Todas</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleToggleAllColumns(false)}>Desmarcar Todas</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <div className="max-h-64 overflow-y-auto">
                            {allHeaders.map(header => (
                            <DropdownMenuCheckboxItem
                                key={header}
                                checked={visibleHeaders.has(header)}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={(checked) => handleColumnVisibilityChange(header, checked)}
                            >
                                {header.charAt(0).toUpperCase() + header.slice(1)}
                            </DropdownMenuCheckboxItem>
                            ))}
                           </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent className="flex-grow p-0">
              <div className="relative h-full w-full overflow-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        {displayedHeaders.map(header => <TableHead key={header}>{header.charAt(0).toUpperCase() + header.slice(1)}</TableHead>)}
                        <TableHead>
                        <span className="sr-only">Acciones</span>
                        </TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        <TableRow>
                        <TableCell colSpan={displayedHeaders.length + 1} className="h-24 text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                        </TableCell>
                        </TableRow>
                    ) : paginatedProducts.length === 0 ? (
                        <TableRow>
                        <TableCell colSpan={displayedHeaders.length + 1} className="h-24 text-center">
                            {searchTerm ? "No se encontraron inmobiliarios con ese criterio." : "No hay inmobiliarios. Cargue datos desde Excel."}
                        </TableCell>
                        </TableRow>
                    ) : (
                        paginatedProducts.map((product) => (
                        <TableRow key={product.firebaseId}>
                            {displayedHeaders.map(header => (
                            <TableCell key={header} className="whitespace-nowrap">
                                {String(product[header] ?? '')}
                            </TableCell>
                            ))}
                            <TableCell>
                            <div className="flex items-center justify-end gap-2">
                                {(product.id || product.Codbien) && 
                                <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                    <QrCode className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                    <DialogTitle>Código QR para {product.name || product.id || product.Codbien}</DialogTitle>
                                    <DialogDescription>
                                        Escanea este código para acceder a la información del inmobiliario.
                                    </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex justify-center p-4">
                                    <Image
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${product.id || product.Codbien}`}
                                        alt={`Código QR para ${product.id || product.Codbien}`}
                                        width={200}
                                        height={200}
                                        data-ai-hint="qr code"
                                    />
                                    </div>
                                </DialogContent>
                                </Dialog>
                                }

                                <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                    aria-haspopup="true"
                                    size="icon"
                                    variant="ghost"
                                    >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Menú</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                    <DropdownMenuItem onSelect={() => handleEdit(product)}>Editar</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setProductToDelete(product)}>Eliminar</DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
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
      
      {editingProduct && (
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Inmobiliario: {editingProduct.id || editingProduct.Codbien}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-6">
              {Object.keys(editingProduct).filter(key => key !== 'firebaseId').map(key => (
                <div key={key} className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={key} className="text-right">{key.charAt(0).toUpperCase() + key.slice(1)}</Label>
                  <Input
                    id={key}
                    type={typeof editingProduct[key] === 'number' ? 'number' : 'text'}
                    value={editingProduct[key] ?? ''}
                    onChange={handleInputChange}
                    className="col-span-3" />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancelar</Button>
              <Button onClick={handleSaveEdit}>Guardar Cambios</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {productToDelete && (
          <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Está seguro de que desea eliminar este inmobiliario?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará permanentemente el inmobiliario
                        <span className="font-bold"> {productToDelete.name || productToDelete.id || productToDelete.Codbien}</span>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteProduct}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      )}
    </div>
  );
}

    