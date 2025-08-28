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
  DropdownMenuCheckboxItem,
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
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, addDoc, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

const dummyDataForUpload = [
  { id: "PROD-001", name: "Laptop Gamer X-1", quantity: 25, location: "Almacén A", status: "En Stock" },
  { id: "PROD-002", name: "Monitor Curvo 27\"", quantity: 50, location: "Almacén B", status: "En Stock" },
  { id: "PROD-003", name: "Teclado Mecánico RGB", quantity: 10, location: "Almacén A", status: "Bajo Stock" },
  { id: "PROD-004", name: "Mouse Inalámbrico Pro", quantity: 0, location: "Almacén C", status: "Agotado" },
  { id: "PROD-005", name: "Auriculares con Micrófono", quantity: 75, location: "Almacén B", status: "En Stock" },
  { id: "PROD-006", name: "Webcam 4K", quantity: 5, location: "Almacén C", status: "Bajo Stock" },
];

interface Product {
  id: string;
  name: string;
  quantity: number;
  location: string;
  status: string;
  firebaseId?: string;
}

export default function DataManagementPage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
  const { toast } = useToast();

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

  const handleUpload = async () => {
    setIsUploading(true);
    setProgress(0);

    try {
        const batch = writeBatch(db);
        dummyDataForUpload.forEach((product) => {
            const docRef = doc(collection(db, "products"));
            batch.set(docRef, product);
        });
        
        // Simulate progress for visual feedback
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 90) return 90;
                return prev + 10;
            });
        }, 200);

        await batch.commit();

        clearInterval(interval);
        setProgress(100);

        toast({
            title: "Carga Exitosa",
            description: "Los productos de demostración se han cargado en Firebase.",
        });

        setTimeout(() => {
            setIsUploading(false);
            setIsUploadDialogOpen(false);
            fetchProducts();
        }, 1000);

    } catch (error) {
        console.error("Error uploading products: ", error);
        toast({
            variant: "destructive",
            title: "Error de Carga",
            description: "No se pudieron guardar los productos en Firebase.",
        });
        setIsUploading(false);
    }
  };
  
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
  }

  const handleSaveEdit = async () => {
    if (!editingProduct || !editingProduct.firebaseId) return;

    try {
      const productDocRef = doc(db, "products", editingProduct.firebaseId);
      await updateDoc(productDocRef, {
        name: editingProduct.name,
        quantity: editingProduct.quantity,
        location: editingProduct.location,
      });
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
    setEditingProduct({ ...editingProduct, [id]: id === 'quantity' ? Number(value) : value });
  };

  return (
    <>
      <Tabs defaultValue="all">
        <div className="flex items-center">
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
                  <DialogTitle>Carga de Datos</DialogTitle>
                  <DialogDescription>
                    Esto cargará un conjunto de datos de demostración en su base de datos de Firebase.
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
                    <p>Haga clic en el botón de abajo para iniciar la carga de datos de demostración a la colección 'products' en Firestore.</p>
                  </div>
                )}
                <DialogFooter>
                  {!isUploading && <Button onClick={handleUpload}>Cargar Datos de Demo</Button>}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
              <CardDescription>
                Gestiona tus productos y visualiza su inventario. Los datos se guardan en Firebase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID de Producto</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No se encontraron productos. Intente cargar datos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => (
                      <TableRow key={product.firebaseId}>
                        <TableCell className="font-medium">{product.id}</TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>
                          <Badge variant={product.status === 'Agotado' ? 'destructive' : product.status === 'Bajo Stock' ? 'secondary' : 'default'}
                                 style={product.status === 'En Stock' ? { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' } : {}}>
                            {product.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{product.location}</TableCell>
                        <TableCell className="text-right">{product.quantity}</TableCell>
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
              <div className="text-xs text-muted-foreground">
                Mostrando <strong>1-{products.length}</strong> de <strong>{products.length}</strong> productos
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
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Nombre</Label>
                    <Input id="name" value={editingProduct.name} onChange={handleInputChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="quantity" className="text-right">Cantidad</Label>
                    <Input id="quantity" type="number" value={editingProduct.quantity} onChange={handleInputChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="location" className="text-right">Ubicación</Label>
                    <Input id="location" value={editingProduct.location} onChange={handleInputChange} className="col-span-3" />
                </div>
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
