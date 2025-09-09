
"use client";

import * as React from "react";
import {
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Save,
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
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import { collection, getDocs, writeBatch, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface Product {
  firebaseId?: string;
  [key: string]: any;
}

interface UploadResult {
  updated: Product[];
  notFound: Product[];
  headers: string[];
}

export default function DataCleansingPage() {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadResult, setUploadResult] = React.useState<UploadResult | null>(null);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);

  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleProcessFile = async () => {
    if (!uploadFile) {
      toast({
        variant: "destructive",
        title: "Ningún Archivo Seleccionado",
        description: "Por favor, seleccione un archivo para procesar.",
      });
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
        
        const batch = writeBatch(db);
        const updatedProducts: Product[] = [];
        const notFoundProducts: Product[] = [];
        
        const protectedColumns = ['CNUME', 'codbien', 'nombre_ofi', 'oficina'];
        const codbienKey = headersFromExcel.find(h => h.toLowerCase() === 'codbien') || 'codbien';

        newProductsData.forEach((newProduct, index) => {
            const codbienValue = String(newProduct[codbienKey] || '').trim();
            if (codbienValue && existingProductsMap.has(codbienValue)) {
                const firebaseId = existingProductsMap.get(codbienValue)!;
                const docRef = doc(db, "products", firebaseId);
                
                const dataToUpdate = { ...newProduct };
                // Remove protected columns from the update object
                protectedColumns.forEach(col => {
                    const keyToDelete = Object.keys(dataToUpdate).find(k => k.toLowerCase() === col.toLowerCase());
                    if(keyToDelete) {
                        delete (dataToUpdate as any)[keyToDelete];
                    }
                });


                batch.update(docRef, dataToUpdate);
                updatedProducts.push({ firebaseId, ...newProduct });

            } else {
                notFoundProducts.push(newProduct);
            }
            setProgress(Math.round(((index + 1) / newProductsData.length) * 100));
        });

        if (updatedProducts.length > 0) {
            await batch.commit();
        }

        toast({
          title: "Proceso Completado",
          description: `${updatedProducts.length} inmobiliarios actualizados. ${notFoundProducts.length} no encontrados.`,
        });

        setUploadResult({ updated: updatedProducts, notFound: notFoundProducts, headers: headersFromExcel });
        setIsProcessing(false);

      } catch (error) {
        console.error("Error processing file: ", error);
        toast({
          variant: "destructive",
          title: "Error de Procesamiento",
          description: "No se pudo procesar el archivo.",
        });
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(uploadFile);
  };
  
  const handleEditProduct = (product: Product) => {
    setEditingProduct({ CNUME: "", nombre_ofi: "", oficina: "", ...product });
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingProduct) return;
    const { id, value } = e.target;
    setEditingProduct({ ...editingProduct, [id]: e.target.type === 'number' ? Number(value) : value });
  };

  const handleSaveNewProduct = async () => {
    if (!editingProduct) return;
    setIsProcessing(true);
    try {
        const newDocRef = doc(collection(db, "products"));
        // Ensure no firebaseId is saved
        const { firebaseId, ...dataToSave } = editingProduct;
        await setDoc(newDocRef, dataToSave);

        toast({
            title: "Inmobiliario Guardado",
            description: "El nuevo inmobiliario ha sido añadido a la base de datos.",
        });

        // Remove from the not found list
        setUploadResult(prev => {
            if (!prev) return null;
            return {
                ...prev,
                notFound: prev.notFound.filter(p => p.codbien !== editingProduct.codbien)
            };
        });

        setEditingProduct(null);
    } catch(error) {
        console.error("Error saving new product: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el nuevo inmobiliario.' });
    } finally {
        setIsProcessing(false);
    }
  };


  return (
    <div className="grid flex-1 grid-cols-1 gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Limpieza y Estandarización de Datos</CardTitle>
          <CardDescription>
            Cargue un archivo Excel para actualizar en masa los inmobiliarios existentes y estandarizar nuevos registros.
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                                <TableRow key={`updated-${idx}`}>
                                    {uploadResult.headers.map(header => (
                                        <TableCell key={header}>{String(product[header] ?? '')}</TableCell>
                                    ))}
                                </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><AlertCircle className="text-yellow-500"/>Inmobiliarios para Estandarizar ({uploadResult.notFound.length})</CardTitle>
                    <CardDescription>Estos 'codbien' no se encontraron. Edítelos para añadirles los datos de estandarización y guardarlos.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-96 overflow-auto">
                     <Table>
                        <TableHeader>
                            <TableRow>
                                {uploadResult.headers.map(h => <TableHead key={h}>{h}</TableHead>)}
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                           {uploadResult.notFound.map((product, idx) => (
                                <TableRow key={`notfound-${idx}`}>
                                    {uploadResult.headers.map(header => (
                                        <TableCell key={header}>{String(product[header] ?? '')}</TableCell>
                                    ))}
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => handleEditProduct(product)}>Estandarizar</Button>
                                    </TableCell>
                                </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>

        </div>
      )}

      {editingProduct && (
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Estandarizar Inmobiliario: {editingProduct.codbien}</DialogTitle>
              <DialogDescription>Añada los valores de estandarización. Los demás datos provienen del archivo que cargó.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-6">
              {Object.keys(editingProduct).map(key => (
                <div key={key} className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={key} className="text-right">{key.charAt(0).toUpperCase() + key.slice(1)}</Label>
                  <Input
                    id={key}
                    type={typeof editingProduct[key] === 'number' ? 'number' : 'text'}
                    value={editingProduct[key] ?? ''}
                    onChange={handleInputChange}
                    className="col-span-3" 
                    readOnly={!['CNUME', 'nombre_ofi', 'oficina'].includes(key) && key in (uploadResult?.notFound[0] || {})}
                    />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancelar</Button>
              <Button onClick={handleSaveNewProduct} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                Guardar Nuevo Inmobiliario
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

    