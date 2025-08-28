
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface Product {
  id: string;
  name: string;
  quantity: number;
  location: string;
  status: string;
  firebaseId?: string;
  [key: string]: any; // Allow any other columns
}

export default function DataManagementPage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const { toast } = useToast();

  // Pagination and search state
  const [searchTerm, setSearchTerm] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "products"));
      const productsData = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() } as Product));
      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching products: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los productos.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchProducts();
  }, []);

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
          if (productData.id) {
            existingProductsMap.set(productData.id, { firebaseId: doc.id, data: productData });
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

        newProductsData.forEach((newProduct) => {
          if (!newProduct.id) {
              // Si no hay ID, lo tratamos como nuevo pero registramos un aviso
              console.warn("Producto sin ID encontrado en el archivo Excel, será tratado como nuevo:", newProduct);
              const docRef = doc(collection(db, "products"));
              batch.set(docRef, newProduct);
              newCount++;
          } else if (existingProductsMap.has(newProduct.id)) {
            // Product exists, update it
            const existing = existingProductsMap.get(newProduct.id)!;
            const docRef = doc(db, "products", existing.firebaseId);
            batch.update(docRef, newProduct);
            updatedCount++;
          } else {
            // Product is new, add it
            const docRef = doc(collection(db, "products"));
            batch.set(docRef, newProduct);
            newCount++;
          }
          updateProgress();
        });


        await batch.commit();

        setProgress(100);

        toast({
          title: "Carga Exitosa",
          description: `${newCount} productos nuevos añadidos y ${updatedCount} productos actualizados.`,
        });

        setTimeout(() => {
          setIsUploading(false);
          setIsUploadDialogOpen(false);
          setUploadFile(null);
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

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
  }

  const handleSaveEdit = async () => {
    if (!editingProduct || !editingProduct.firebaseId) return;

    try {
      const productDocRef = doc(db, "products", editingProduct.firebaseId);
      const { firebaseId, ...productData } = editingProduct;
      await updateDoc(productDocRef, productData);
      toast({
        title: "Producto Actualizado",
        description: "Los cambios se han guardado correctamente.",
      });
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error("Error updating product: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el producto.",
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingProduct) return;
    const { id, value } = e.target;
    setEditingProduct({ ...editingProduct, [id]: e.target.type === 'number' ? Number(value) : value });
  };

  const filteredProducts = React.useMemo(() => {
    setCurrentPage(1); // Reset to first page on search
    return products.filter(product =>
      Object.values(product).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [products, searchTerm]);

  const paginatedProducts = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const tableHeaders = React.useMemo(() => {
    if (products.length === 0) {
      return ["id", "name", "status", "location", "quantity"];
    }
    const allKeys = products.reduce((keys, product) => {
      Object.keys(product).forEach(key => {
        if (!keys.includes(key) && key !== 'firebaseId') {
          keys.push(key);
        }
      });
      return keys;
    }, [] as string[]);
    const prioritized = ["id", "name", "status", "location", "quantity"];
    return [...prioritized.filter(h => allKeys.includes(h)), ...allKeys.filter(h => !prioritized.includes(h))];
  }, [products]);


  return (
    <>
      <Tabs defaultValue="all">
        <div className="flex items-center gap-2">
          <TabsList>
            <TabsTrigger value="all">Todo</TabsTrigger>
            <TabsTrigger value="en-stock">En Stock</TabsTrigger>
            <TabsTrigger value="bajo-stock">Bajo Stock</TabsTrigger>
            <TabsTrigger value="agotado">Agotado</TabsTrigger>
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1" style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
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
                    Seleccione un archivo .xlsx o .xls para cargar los datos de sus productos en Firebase. La primera hoja del archivo será procesada.
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
          </div>
        </div>
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Productos</CardTitle>
                    <CardDescription>
                        Gestiona tus productos y visualiza su inventario.
                    </CardDescription>
                  </div>
                  <div className="relative w-full max-w-sm">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="search" 
                        placeholder="Buscar productos..." 
                        className="pl-8 sm:w-[300px]" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableHeaders.map(header => <TableHead key={header}>{header.charAt(0).toUpperCase() + header.slice(1)}</TableHead>)}
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={tableHeaders.length + 1} className="h-24 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : paginatedProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={tableHeaders.length + 1} className="h-24 text-center">
                        {searchTerm ? "No se encontraron productos con ese criterio." : "No hay productos. Cargue datos desde Excel."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedProducts.map((product) => (
                      <TableRow key={product.firebaseId}>
                        {tableHeaders.map(header => (
                          <TableCell key={header}>
                            {header === 'status' ? (
                              <Badge variant={product.status === 'Agotado' ? 'destructive' : product.status === 'Bajo Stock' ? 'secondary' : 'default'}
                                style={product.status === 'En Stock' ? { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' } : {}}>
                                {product.status}
                              </Badge>
                            ) : (
                              product[header]
                            )}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <QrCode className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Código QR para {product.name}</DialogTitle>
                                  <DialogDescription>
                                    Escanea este código para acceder a la información del producto.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="flex justify-center p-4">
                                  <Image
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${product.id}`}
                                    alt={`Código QR para ${product.id}`}
                                    width={200}
                                    height={200}
                                    data-ai-hint="qr code"
                                  />
                                </div>
                              </DialogContent>
                            </Dialog>

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
                                <DropdownMenuItem>Eliminar</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <div className="flex w-full items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Mostrando <strong>{paginatedProducts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{(currentPage - 1) * itemsPerPage + paginatedProducts.length}</strong> de <strong>{filteredProducts.length}</strong> productos
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="items-per-page" className="text-xs">Filas por página</Label>
                      <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
                          <SelectTrigger id="items-per-page" className="h-8 w-[70px]">
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent side="top">
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                          </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs font-semibold">Página {currentPage} de {totalPages}</div>
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
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {editingProduct && (
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Producto: {editingProduct.id}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {Object.keys(editingProduct).filter(key => key !== 'firebaseId').map(key => (
                <div key={key} className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={key} className="text-right">{key.charAt(0).toUpperCase() + key.slice(1)}</Label>
                  <Input
                    id={key}
                    type={typeof editingProduct[key] === 'number' ? 'number' : 'text'}
                    value={editingProduct[key]}
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
    </>
  );
}

    