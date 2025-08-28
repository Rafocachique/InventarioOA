"use client";

import * as React from "react";
import {
  File,
  ListFilter,
  MoreHorizontal,
  PlusCircle,
  QrCode,
  Upload,
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

const dummyData = [
  { id: "PROD-001", name: "Laptop Gamer X-1", quantity: 25, location: "Almacén A", status: "En Stock" },
  { id: "PROD-002", name: "Monitor Curvo 27\"", quantity: 50, location: "Almacén B", status: "En Stock" },
  { id: "PROD-003", name: "Teclado Mecánico RGB", quantity: 10, location: "Almacén A", status: "Bajo Stock" },
  { id: "PROD-004", name: "Mouse Inalámbrico Pro", quantity: 0, location: "Almacén C", status: "Agotado" },
  { id: "PROD-005", name: "Auriculares con Micrófono", quantity: 75, location: "Almacén B", status: "En Stock" },
  { id: "PROD-006", name: "Webcam 4K", quantity: 5, location: "Almacén C", status: "Bajo Stock" },
];

type Product = typeof dummyData[0];

export default function DataManagementPage() {
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);

  const handleUpload = () => {
    setIsUploading(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          // In a real app, you would close the dialog here
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };
  
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
  }

  const handleSaveEdit = () => {
    // Here you would save the edited product data
    setEditingProduct(null);
  }

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
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1" style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                  <Upload className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Cargar Excel
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Carga de Datos desde Excel</DialogTitle>
                  <DialogDescription>
                    Seleccione un archivo Excel para cargar. El sistema procesará hasta 100,000 filas.
                  </DialogDescription>
                </DialogHeader>
                {isUploading ? (
                  <div className="flex flex-col gap-4 py-4">
                    <p>Procesando archivo...</p>
                    <Progress value={progress} />
                    <p className="text-center text-sm text-muted-foreground">{progress}% completado</p>
                  </div>
                ) : (
                  <div className="grid gap-4 py-4">
                    <div className="grid items-center gap-4">
                      <Label htmlFor="excel-file">Archivo Excel</Label>
                      <Input id="excel-file" type="file" accept=".xlsx, .xls" />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  {!isUploading && <Button onClick={handleUpload}>Cargar y Procesar</Button>}
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
                Gestiona tus productos y visualiza su inventario.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID de Producto</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dummyData.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.id}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>
                        <Badge variant={product.status === 'Agotado' ? 'destructive' : product.status === 'Bajo Stock' ? 'secondary' : 'default'}
                               style={product.status === 'En Stock' ? { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' } : {}}>
                          {product.status}
                        </Badge>
                      </TableCell>
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
                                    alt={`QR Code for ${product.id}`}
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
                                <span className="sr-only">Toggle menu</span>
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
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <div className="text-xs text-muted-foreground">
                Mostrando <strong>1-6</strong> de <strong>{dummyData.length}</strong> productos
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
                    <Input id="name" defaultValue={editingProduct.name} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="quantity" className="text-right">Cantidad</Label>
                    <Input id="quantity" type="number" defaultValue={editingProduct.quantity} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="location" className="text-right">Ubicación</Label>
                    <Input id="location" defaultValue={editingProduct.location} className="col-span-3" />
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
