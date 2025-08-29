
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { scanAndVerifyData, ScanAndVerifyDataOutput } from "@/ai/flows/scan-and-verify-data";
import { extractTextFromImage } from "@/ai/flows/extract-text-from-image";
import { saveScan, SaveScanInput } from "@/ai/flows/save-scan";
import { Loader2, CheckCircle, XCircle, Camera, Save, ScanLine, Download, MoreHorizontal, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc, getDocs, updateDoc, collection, query, where, getDoc, writeBatch, Timestamp, onSnapshot, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";


interface EditableProduct {
  firebaseId: string;
  [key: string]: any;
}

interface ScanRecord extends EditableProduct {
    scannedAt: Timestamp;
    scannedBy: string;
}

export default function ScanPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<ScanAndVerifyDataOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [editableProduct, setEditableProduct] = useState<EditableProduct | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [editingScanRecord, setEditingScanRecord] = useState<EditableProduct | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("La API de cámara no es compatible con este navegador.");
        setHasCameraPermission(false);
        return;
      }
      try {
        const constraints = {
          video: {
            facingMode: { ideal: "environment" }
          }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
      } catch (err: any) {
        console.error("Error al acceder a la cámara:", err);
        setHasCameraPermission(false);
        if (err.name === "NotAllowedError") {
             setError("Permiso de cámara denegado. Por favor, habilite el acceso a la cámara en la configuración de su navegador.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError" || err.name === "OverconstrainedError") {
             setError("No se encontró una cámara trasera. Intentando con la cámara frontal.");
             try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
                setError(null);
             } catch (fallbackError: any) {
                setError(`Error al acceder a cualquier cámara: ${fallbackError.message}`);
             }
        } else {
             setError(`Error de cámara: ${err.message}`);
        }
      }
    };

    getCameraPermission();

    const q = query(collection(db, "scan_history"), orderBy("scannedAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const history: ScanRecord[] = [];
        querySnapshot.forEach((doc) => {
            history.push({ firebaseId: doc.id, ...doc.data() } as ScanRecord);
        });
        setScanHistory(history);
        setIsHistoryLoading(false);
    }, (error) => {
        console.error("Error fetching scan history: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo cargar el historial de escaneos."
        });
        setIsHistoryLoading(false);
    });

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      unsubscribe();
    };
  }, [toast]);

 const performVerification = async (code: string): Promise<boolean> => {
    if (!code) return false;

    setIsVerifying(true);
    setResult(null);
    setError(null);
    setEditableProduct(null);

    try {
        toast({ title: "Verificando...", description: `Buscando código: "${code}"` });
        const response = await scanAndVerifyData({ scannedData: code });
        setResult(response);

        if (response.isValid && response.relatedInformation) {
            const productData = response.relatedInformation;
            const currentUser = auth.currentUser;
            
            if (!currentUser) {
                setError("No se pudo identificar al usuario. Inicie sesión de nuevo.");
                toast({ variant: 'destructive', title: 'Error de autenticación' });
                setIsVerifying(false);
                return false;
            }

            const scanData: SaveScanInput = {
                scannedBy: currentUser.email || 'unknown',
                productData: productData
            };
            
            await saveScan(scanData);
            
            toast({
                title: "Escaneo Registrado",
                description: "El producto ha sido verificado y guardado en el historial.",
            });

            setEditableProduct(productData as EditableProduct);
            setIsVerifying(false);
            return true;
        }
    } catch (err) {
        setError("Ocurrió un error durante el proceso de verificación o registro.");
        console.error(err);
    }
    
    setIsVerifying(false);
    return false;
  };


  const processAndVerifyCodes = async (codes: string) => {
    setIsLoading(true);
    setError(null);
    setEditableProduct(null);
    setResult(null);

    const individualCodes = codes.split(/\s+/).filter(Boolean);

    for (const code of individualCodes) {
      toast({ title: `Intentando con el código: ${code}`});
      const found = await performVerification(code);
      if (found) {
        setIsLoading(false);
        return;
      }
    }

    setError("No se encontró ningún producto con los códigos escaneados.");
    setResult({ isValid: false });
    setIsLoading(false);
  };


  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsLoading(true);
    setError(null);
    setEditableProduct(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
        setError("No se pudo obtener el contexto del canvas.");
        setIsLoading(false);
        return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUri = canvas.toDataURL("image/jpeg");

    try {
      const { text: extractedText } = await extractTextFromImage({ photoDataUri: imageDataUri });
      
      if (!extractedText || extractedText.trim() === "") {
        setError("No se pudo extraer texto de la imagen. Intente de nuevo con una imagen más clara.");
        setIsLoading(false);
        setResult({ isValid: false });
        return;
      }
      
      const trimmedText = extractedText.trim();
      await processAndVerifyCodes(trimmedText);

    } catch (err) {
      setError("Ocurrió un error durante el proceso de escaneo y verificación.");
      console.error(err);
      setIsLoading(false);
    }
  };

  const handleManualVerify = async () => {
      const codeToVerify = manualCode.trim();
      if (!codeToVerify) {
        toast({
            variant: "destructive",
            title: "Código Vacío",
            description: "Por favor, ingrese un código para verificar."
        });
        return;
      }
      await processAndVerifyCodes(codeToVerify);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, record: EditableProduct | null, setRecord: Function) => {
    if (!record) return;
    const { id, value } = e.target;
    setRecord({ ...record, [id]: e.target.type === 'number' ? Number(value) : value });
  };
  
  const handleSaveChanges = async (productToSave: EditableProduct | null) => {
    if (!productToSave || !productToSave.firebaseId) return;

    setIsLoading(true);
    try {
        const productCollectionRef = collection(db, "products");
        const q = query(productCollectionRef, where("Codbien", "==", productToSave.Codbien));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("No se encontró el producto original para actualizarlo.");
        }
        const productDocRef = querySnapshot.docs[0].ref;

        const { firebaseId, ...productData } = productToSave;
        await updateDoc(productDocRef, productData);

        toast({
            title: "Producto Actualizado",
            description: "Los cambios se han guardado correctamente en la base de datos de productos.",
        });

    } catch (error) {
        console.error("Error updating product: ", error);
        toast({
            variant: "destructive",
            title: "Error al Guardar",
            description: "No se pudo actualizar el producto.",
        });
    } finally {
        setIsLoading(false);
        setEditingScanRecord(null);
    }
  };
  
  const handleExportHistory = () => {
      if (scanHistory.length === 0) {
          toast({ title: "No hay datos", description: "El historial de escaneos está vacío." });
          return;
      }

      const dataToExport = scanHistory.map(scan => {
          const { firebaseId, scannedAt, ...rest } = scan;
          return {
              ...rest,
              scannedAt: scannedAt.toDate().toLocaleString('es-ES')
          };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Historial de Escaneos");
      XLSX.writeFile(workbook, "historial_escaneos.xlsx");
  };

  const handleEditRecord = (record: ScanRecord) => {
    // We need to fetch the original product firebaseId to allow updates
    const getOriginalProduct = async () => {
        const productsRef = collection(db, "products");
        // Assuming Codbien is the unique identifier to find the original product
        const q = query(productsRef, where("Codbien", "==", record.Codbien));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const productDoc = querySnapshot.docs[0];
            setEditingScanRecord({ firebaseId: productDoc.id, ...record });
        } else {
            toast({ variant: "destructive", title: "Error", description: "No se pudo encontrar el producto original para editarlo." });
        }
    };
    getOriginalProduct();
  };



  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <div className="flex flex-col gap-8">
        <Card>
            <CardHeader>
            <CardTitle>Escanear y Verificar</CardTitle>
            <CardDescription>Use la cámara para escanear un código o ingréselo manualmente.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="camera">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="camera">Escanear con Cámara</TabsTrigger>
                        <TabsTrigger value="manual">Ingreso Manual</TabsTrigger>
                    </TabsList>
                    <TabsContent value="camera" className="mt-4">
                        <div className="aspect-video bg-card-foreground/10 rounded-lg flex items-center justify-center p-4">
                            {hasCameraPermission === null && (
                            <Loader2 className="h-16 w-16 text-muted-foreground animate-spin" />
                            )}
                            <video ref={videoRef} className={`w-full h-full object-cover rounded-md ${hasCameraPermission === null || hasCameraPermission === false ? 'hidden' : ''}`} autoPlay muted playsInline />
                            {hasCameraPermission === false && !error?.includes("Intentando") && ( 
                            <div className="text-center text-destructive">
                                <Camera className="h-16 w-16 mx-auto" />
                                <p className="mt-2">No se pudo acceder a la cámara.</p>
                                <p className="text-sm text-muted-foreground">{error}</p>
                            </div>
                            )}
                        </div>
                        <Button onClick={captureAndScan} className="w-full mt-4" disabled={isLoading || !hasCameraPermission} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                            {isVerifying ? "Verificando..." : (isLoading ? "Escaneando..." : "Escanear y Verificar")}
                        </Button>
                        <canvas ref={canvasRef} style={{ display: "none" }} />
                    </TabsContent>
                    <TabsContent value="manual" className="mt-4">
                        <div className="space-y-4">
                            <Label htmlFor="manual-code">Código del Producto</Label>
                            <Input id="manual-code" placeholder="Ingrese el código a verificar" value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
                            <Button onClick={handleManualVerify} className="w-full" disabled={isLoading || isVerifying}>
                                {isLoading || isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                                Verificar Código
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>

        {editableProduct && !isVerifying && (
            <Card>
                <CardHeader>
                    <CardTitle>Resultados de Verificación</CardTitle>
                    <CardDescription>Producto encontrado. Puede editar la información y se reflejará en la base de datos principal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Alert className="border-green-500 text-green-500 mb-4">
                        <CheckCircle className="h-4 w-4 !text-green-500" />
                        <AlertTitle>Verificación Exitosa</AlertTitle>
                        <AlertDescription>El escaneo se guardó en el historial.</AlertDescription>
                    </Alert>
                    {Object.entries(editableProduct).filter(([key]) => key !== 'firebaseId').map(([key, value]) => (
                        <div key={key} className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor={key} className="text-right capitalize">{key.replace(/_/g, ' ')}</Label>
                            <Input
                                id={key}
                                type={typeof value === 'number' ? 'number' : 'text'}
                                value={value ?? ''}
                                onChange={(e) => handleInputChange(e, editableProduct, setEditableProduct)}
                                className="col-span-2"
                                disabled={key === 'Codbien' || key === 'id'}
                            />
                        </div>
                    ))}
                </CardContent>
                <CardFooter>
                    <Button onClick={() => handleSaveChanges(editableProduct)} disabled={isLoading} className="w-full">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Cambios en Producto
                    </Button>
                </CardFooter>
            </Card>
        )}
        
        {(error && !isLoading && !isVerifying && !editableProduct) && (
             <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertTitle>Verificación Fallida</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
        )}

      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Historial de Escaneos</CardTitle>
                <CardDescription>Aquí se muestran los escaneos registrados.</CardDescription>
            </div>
            <Button onClick={handleExportHistory} size="sm" variant="outline" className="h-8 gap-1">
                <Download className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Exportar
                </span>
            </Button>
        </CardHeader>
        <CardContent>
            <ScrollArea className="h-[600px]">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isHistoryLoading ? (
                    <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    </TableCell>
                    </TableRow>
                ) : scanHistory.length === 0 ? (
                    <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        No hay registros de escaneo.
                    </TableCell>
                    </TableRow>
                ) : (
                    scanHistory.map((scan) => (
                    <TableRow key={scan.firebaseId}>
                        <TableCell className="font-medium">{scan.Descripcion || scan.Codbien || 'N/A'}</TableCell>
                        <TableCell>{scan.scannedAt.toDate().toLocaleString('es-ES')}</TableCell>
                        <TableCell>{scan.scannedBy}</TableCell>
                        <TableCell className="text-right">
                           <Button variant="ghost" size="icon" onClick={() => handleEditRecord(scan)}>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))
                )}
                </TableBody>
            </Table>
            </ScrollArea>
        </CardContent>
      </Card>
      
      {editingScanRecord && (
        <Dialog open={!!editingScanRecord} onOpenChange={() => setEditingScanRecord(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Editar Producto desde Historial</DialogTitle>
              <DialogDescription>
                Los cambios se guardarán en la base de datos principal de productos.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-6">
              {Object.keys(editingScanRecord).filter(key => key !== 'firebaseId' && key !== 'scannedAt' && key !== 'scannedBy').map(key => (
                <div key={key} className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={key} className="text-right capitalize">{key.replace(/_/g, ' ')}</Label>
                  <Input
                    id={key}
                    type={typeof editingScanRecord[key] === 'number' ? 'number' : 'text'}
                    value={editingScanRecord[key] ?? ''}
                    onChange={(e) => handleInputChange(e, editingScanRecord, setEditingScanRecord)}
                    className="col-span-3"
                    disabled={key === 'Codbien' || key === 'id'}
                     />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingScanRecord(null)}>Cancelar</Button>
              <Button onClick={() => handleSaveChanges(editingScanRecord)} disabled={isLoading}>
                 {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

