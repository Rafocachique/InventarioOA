
"use client";

import * as React from "react";
import {
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Save,
  PlusCircle,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";

import { db } from "@/lib/firebase";
import { collection, getDocs, writeBatch, doc, setDoc, onSnapshot, deleteDoc, query, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface Product {
  firebaseId?: string;
  [key: string]: any;
}

interface UploadResult {
  updated: Product[];
  headers: string[];
}

interface StandardizationOptions {
    cnumes: string[];
    nombre_ofis: string[];
    oficinas: string[];
}


export default function DataCleansingPage() {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadResult, setUploadResult] = React.useState<UploadResult | null>(null);
  const [unstandardizedProducts, setUnstandardizedProducts] = React.useState<Product[]>([]);
  const [isUnstandardizedLoading, setIsUnstandardizedLoading] = React.useState(true);
  
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [columnOrder, setColumnOrder] = React.useState<string[]>([]);

  const [stdOptions, setStdOptions] = React.useState<StandardizationOptions>({ cnumes: [], nombre_ofis: [], oficinas: [] });
  const [isClearing, setIsClearing] = React.useState(false);

  // State for new manual entries in the dialog
  const [newCnum, setNewCnum] = React.useState("");
  const [newNombreOfi, setNewNombreOfi] = React.useState("");
  const [newOficina, setNewOficina] = React.useState("");

  const { toast } = useToast();
  
  const fetchStandardizationOptions = React.useCallback(async () => {
    try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        const cnumes = new Set<string>();
        const nombre_ofis = new Set<string>();
        const oficinas = new Set<string>();

        productsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.CNUME) cnumes.add(String(data.CNUME));
            if (data.nombre_ofi) nombre_ofis.add(String(data.nombre_ofi));
            if (data.oficina) oficinas.add(String(data.oficina));
        });

        setStdOptions({
            cnumes: Array.from(cnumes).sort(),
            nombre_ofis: Array.from(nombre_ofis).sort(),
            oficinas: Array.from(oficinas).sort(),
        });

    } catch (error) {
        console.error("Error fetching standardization options: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las opciones para estandarizar.' });
    }
  }, [toast]);
  
  const fetchColumnOrder = React.useCallback(async () => {
    try {
        const columnOrderDocRef = doc(db, "_config", "columnOrder");
        const columnOrderDoc = await getDoc(columnOrderDocRef);
        if (columnOrderDoc.exists()) {
            setColumnOrder(columnOrderDoc.data().headers);
        }
    } catch(err) {
        console.error("Error fetching column order", err);
    }
  }, []);

  React.useEffect(() => {
      fetchStandardizationOptions();
      fetchColumnOrder();
      
      const q = query(collection(db, "unstandardized_products"));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
          setIsUnstandardizedLoading(true);
          const products: Product[] = [];
          querySnapshot.forEach((doc) => {
              products.push({ firebaseId: doc.id, ...doc.data() });
          });
          setUnstandardizedProducts(products);
          
          if(columnOrder.length === 0 && products.length > 0) {
              setColumnOrder(Object.keys(products[0]).filter(k => k !== 'firebaseId'));
          }

          setIsUnstandardizedLoading(false);
      }, (error) => {
          console.error("Error fetching unstandardized products:", error);
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los productos pendientes.' });
          setIsUnstandardizedLoading(false);
      });

      return () => unsubscribe();
  }, [fetchStandardizationOptions, fetchColumnOrder, toast, columnOrder.length]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleProcessFile = async () => {
    if (!uploadFile) {
      toast({ variant: "destructive", title: "Ningún Archivo Seleccionado" });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (!jsonData || jsonData.length < 1) {
             toast({ variant: "destructive", title: "Archivo Inválido" });
             setIsProcessing(false);
             return;
        }
        
        const headersFromExcel: string[] = jsonData[0].map(header => String(header).trim());
        const newProductsData = XLSX.utils.sheet_to_json(worksheet) as Product[];

        if (newProductsData.length === 0) {
          toast({ variant: "destructive", title: "Archivo Vacío" });
          setIsProcessing(false);
          return;
        }

        const productsRef = collection(db, "products");
        const querySnapshot = await getDocs(productsRef);
        const existingProductsMap = new Map<string, string>(); // Codbien -> firebaseId
        querySnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.codbien) {
                existingProductsMap.set(String(data.codbien).trim(), doc.id);
            }
        });
        
        const updateBatch = writeBatch(db);
        const unstandardizedBatch = writeBatch(db);
        const updatedProducts: Product[] = [];
        
        const protectedColumns = ['CNUME', 'codbien', 'nombre_ofi', 'oficina'];
        const codbienKey = headersFromExcel.find(h => h.toLowerCase() === 'codbien') || 'codbien';

        newProductsData.forEach((newProduct, index) => {
            const codbienValue = String(newProduct[codbienKey] || '').trim();
            if (codbienValue && existingProductsMap.has(codbienValue)) {
                const firebaseId = existingProductsMap.get(codbienValue)!;
                const docRef = doc(db, "products", firebaseId);
                
                const dataToUpdate = { ...newProduct };
                protectedColumns.forEach(col => {
                    const keyToDelete = Object.keys(dataToUpdate).find(k => k.toLowerCase() === col.toLowerCase());
                    if(keyToDelete) {
                        delete (dataToUpdate as any)[keyToDelete];
                    }
                });

                updateBatch.update(docRef, dataToUpdate);
                updatedProducts.push({ firebaseId, ...newProduct });
            } else if (codbienValue) {
                const unstandardizedDocRef = doc(collection(db, "unstandardized_products"));
                unstandardizedBatch.set(unstandardizedDocRef, newProduct);
            }
            setProgress(Math.round(((index + 1) / newProductsData.length) * 100));
        });

        if (updatedProducts.length > 0) await updateBatch.commit();
        await unstandardizedBatch.commit();
        
        toast({
          title: "Proceso Completado",
          description: `${updatedProducts.length} inmobiliarios actualizados. Los no encontrados se han movido a 'pendientes de estandarizar'.`,
        });
        
        setUploadResult({ updated: updatedProducts, headers: headersFromExcel });
        setIsProcessing(false);
        setUploadFile(null);
        fetchStandardizationOptions(); 
        if (columnOrder.length === 0) {
            setColumnOrder(headersFromExcel);
        }

      } catch (error) {
        console.error("Error processing file: ", error);
        toast({ variant: "destructive", title: "Error de Procesamiento", description: "No se pudo procesar el archivo." });
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(uploadFile);
  };
  
  const handleEditProduct = (product: Product) => {
    setNewCnum("");
    setNewNombreOfi("");
    setNewOficina("");
    setEditingProduct(product);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingProduct) return;
    const { id, value } = e.target;
    setEditingProduct({ ...editingProduct, [id]: value });
  };
  
  const handleSelectChange = (field: string, value: string) => {
    if (!editingProduct) return;
    setEditingProduct({ ...editingProduct, [field]: value });
  };

  const handleSaveStandardizedProduct = async () => {
    if (!editingProduct) return;
    
    if (!editingProduct.codbien) {
        toast({ variant: 'destructive', title: 'Error', description: 'El campo "codbien" es obligatorio.' });
        return;
    }
    
    setIsProcessing(true);
    try {
        const newProductDocRef = doc(collection(db, "products"));
        const unstandardizedDocId = editingProduct.firebaseId;
        
        const { firebaseId, ...dataToSave } = editingProduct;

        if (newCnum.trim()) dataToSave.CNUME = newCnum.trim();
        if (newNombreOfi.trim()) dataToSave.nombre_ofi = newNombreOfi.trim();
        if (newOficina.trim()) dataToSave.oficina = newOficina.trim();

        await setDoc(newProductDocRef, dataToSave);

        if (unstandardizedDocId) {
            await deleteDoc(doc(db, "unstandardized_products", unstandardizedDocId));
        }

        toast({
            title: "Inmobiliario Guardado",
            description: "El nuevo inmobiliario ha sido estandarizado y añadido a la base de datos general.",
        });
        
        setEditingProduct(null);
        fetchStandardizationOptions();
    } catch(error) {
        console.error("Error saving new product: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el nuevo inmobiliario.' });
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleClearUnstandardized = async () => {
      setIsClearing(true);
      try {
          const q = await getDocs(collection(db, "unstandardized_products"));
          const batch = writeBatch(db);
          q.forEach(doc => {
              batch.delete(doc.ref);
          });
          await batch.commit();
          toast({ title: "Limpieza Completa", description: "Se han eliminado todos los inmobiliarios pendientes." });
      } catch (error) {
          console.error("Error clearing unstandardized products: ", error);
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron eliminar los registros pendientes.' });
      } finally {
          setIsClearing(false);
      }
  };

  const getCommonHeaders = (): string[] => {
      if (columnOrder.length > 0) return columnOrder;
      if (uploadResult?.headers) return uploadResult.headers;
      if (unstandardizedProducts.length > 0) return Object.keys(unstandardizedProducts[0]).filter(k => k !== 'firebaseId');
      return ['codbien', 'descrip'];
  }


  return (
    <div className="grid flex-1 grid-cols-1 gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Limpieza y Estandarización de Datos</CardTitle>
          <CardDescription>
            Cargue un archivo Excel. El sistema actualizará los inmobiliarios existentes usando 'codbien' como clave y separará los nuevos para su estandarización manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border rounded-lg">
             <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="excel-file">Archivo de Excel (.xlsx)</Label>
                <Input id="excel-file" type="file" onChange={handleFileUpload} accept=".xlsx, .xls" />
             </div>
             <Button onClick={handleProcessFile} disabled={isProcessing || !uploadFile}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                {isProcessing ? 'Procesando...' : 'Procesar Archivo'}
             </Button>
          </div>
          {isProcessing && <Progress value={progress} />}
        </CardContent>
      </Card>
      
      {uploadResult && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle className="text-green-500"/> Inmobiliarios Actualizados ({uploadResult.updated.length})</CardTitle>
                <CardDescription>Estos inmobiliarios ya existían y han sido actualizados. Las columnas CNUME, codbien, nombre_ofi y oficina se mantuvieron intactas.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-96 overflow-auto">
                 <Table>
                    <TableHeader>
                        <TableRow>{uploadResult.headers.map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                    </TableHeader>
                    <TableBody>
                       {uploadResult.updated.map((product, idx) => (
                            <TableRow key={`updated-${product.codbien}-${idx}`}>
                                {uploadResult.headers.map(header => (
                                    <TableCell key={header}>{String(product[header] ?? '')}</TableCell>
                                ))}
                            </TableRow>
                       ))}
                    </TableBody>
                 </Table>
            </CardContent>
        </Card>
      )}

       <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2"><AlertCircle className="text-yellow-500"/>Pendientes de Estandarizar ({unstandardizedProducts.length})</CardTitle>
                        <CardDescription>Estos 'codbien' son nuevos. Edítelos para añadir los datos de estandarización correctos y guardarlos en la base de datos principal.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={isClearing || unstandardizedProducts.length === 0}>
                                   {isClearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Limpiar Pendientes
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción eliminará permanentemente {unstandardizedProducts.length} inmobiliarios que están pendientes de estandarizar. No se puede deshacer.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearUnstandardized}>Confirmar y Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="max-h-96 overflow-auto">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            {getCommonHeaders().map(h => <TableHead key={h}>{h}</TableHead>)}
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                       {isUnstandardizedLoading ? (
                           <TableRow><TableCell colSpan={getCommonHeaders().length + 1} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                       ) : unstandardizedProducts.length > 0 ? (
                           unstandardizedProducts.map((product) => (
                                <TableRow key={`notfound-${product.firebaseId}`}>
                                    {getCommonHeaders().map(header => (
                                        <TableCell key={header}>{String(product[header] ?? '')}</TableCell>
                                    ))}
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => handleEditProduct(product)}>Estandarizar</Button>
                                    </TableCell>
                                </TableRow>
                           ))
                       ) : (
                           <TableRow><TableCell colSpan={getCommonHeaders().length + 1} className="h-24 text-center">No hay inmobiliarios pendientes de estandarizar.</TableCell></TableRow>
                       )}
                    </TableBody>
                 </Table>
            </CardContent>
        </Card>

      {editingProduct && (
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Estandarizar Inmobiliario: {editingProduct.codbien}</DialogTitle>
              <DialogDescription>Añada o seleccione los valores de estandarización. Los demás datos provienen del archivo que cargó.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[60vh] overflow-y-auto pr-6">
              
              {/* Standardization Fields with manual override */}
              <div className="space-y-2">
                  <Label htmlFor="CNUME">CNUME</Label>
                  <Select onValueChange={(value) => handleSelectChange('CNUME', value)} value={editingProduct.CNUME ?? ""}>
                      <SelectTrigger><SelectValue placeholder="Seleccione un CNUME existente..." /></SelectTrigger>
                      <SelectContent>{stdOptions.cnumes.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={newCnum} onChange={(e) => setNewCnum(e.target.value)} className="mt-2" placeholder="O ingrese un nuevo valor para CNUME..."/>
              </div>
              
              <div className="space-y-2">
                  <Label htmlFor="nombre_ofi">Nombre Oficina</Label>
                  <Select onValueChange={(value) => handleSelectChange('nombre_ofi', value)} value={editingProduct.nombre_ofi ?? ""}>
                      <SelectTrigger><SelectValue placeholder="Seleccione una oficina existente..." /></SelectTrigger>
                      <SelectContent>{stdOptions.nombre_ofis.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                   <Input value={newNombreOfi} onChange={(e) => setNewNombreOfi(e.target.value)} className="mt-2" placeholder="O ingrese un nuevo nombre de oficina..."/>
              </div>

              <div className="space-y-2">
                  <Label htmlFor="oficina">Oficina</Label>
                  <Select onValueChange={(value) => handleSelectChange('oficina', value)} value={editingProduct.oficina ?? ""}>
                      <SelectTrigger><SelectValue placeholder="Seleccione una oficina existente..." /></SelectTrigger>
                      <SelectContent>{stdOptions.oficinas.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={newOficina} onChange={(e) => setNewOficina(e.target.value)} className="mt-2" placeholder="O ingrese una nueva oficina..."/>
              </div>
              
              <hr className="my-4 col-span-full" />
              
              {/* Other fields as inputs */}
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(editingProduct).filter(k => !['CNUME', 'nombre_ofi', 'oficina', 'firebaseId'].includes(k)).map(key => (
                    <div key={key} className="space-y-2">
                        <Label htmlFor={key} className="capitalize">{key.replace(/_/g, ' ')}</Label>
                        <Input id={key} value={editingProduct[key] ?? ''} onChange={handleInputChange} />
                    </div>
                ))}
                 {/* Codbien must be editable */}
                <div className="space-y-2">
                    <Label htmlFor="codbien" className="font-bold">Codbien *</Label>
                    <Input id="codbien" value={editingProduct['codbien'] ?? ''} onChange={handleInputChange} placeholder="Campo obligatorio"/>
                </div>
              </div>

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancelar</Button>
              <Button onClick={handleSaveStandardizedProduct} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

