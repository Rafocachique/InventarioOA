
"use client";

import * as React from "react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { scanAndVerifyData, ScanAndVerifyDataOutput } from "@/ai/flows/scan-and-verify-data";
import { extractTextFromImage } from "@/ai/flows/extract-text-from-image";
import { saveScan, SaveScanInput } from "@/ai/flows/save-scan";
import { Loader2, CheckCircle, XCircle, Camera, Save, ScanLine, Download, MoreHorizontal, Settings, Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc, getDocs, updateDoc, collection, query, where, Timestamp, onSnapshot, orderBy, deleteDoc, writeBatch, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

interface EditableProduct {
  firebaseId: string;
  scanId?: string; // To hold the id of the scan history document
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
  const [scanHistoryHeaders, setScanHistoryHeaders] = useState<string[]>([]);
  const [visibleScanHistoryHeaders, setVisibleScanHistoryHeaders] = useState<Set<string>>(new Set());
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>([new Date()]);

  const [scanToDelete, setScanToDelete] = useState<ScanRecord | null>(null);
  const [isDeleteRangeAlertOpen, setIsDeleteRangeAlertOpen] = useState(false);


  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  
  const fetchColumnOrder = useCallback(async () => {
    try {
        const columnOrderDocRef = doc(db, "_config", "columnOrder");
        const columnOrderDoc = await getDoc(columnOrderDocRef);
        if (columnOrderDoc.exists()) {
            const headers = columnOrderDoc.data().headers as string[];
            const filteredHeaders = headers.filter(key => key !== 'firebaseId' && key !== 'scannedAt' && key !== 'scannedBy' && key !== 'scanId');
            setScanHistoryHeaders(filteredHeaders);
            if (visibleScanHistoryHeaders.size === 0 && filteredHeaders.length > 0) { 
                setVisibleScanHistoryHeaders(new Set(filteredHeaders));
            }
        }
    } catch (error) {
        console.error("Error fetching column order: ", error);
    }
  }, [visibleScanHistoryHeaders.size]);


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
        setHasCameraPermission(false);
        if (err.name === "NotAllowedError") {
             setError("Permiso de cámara denegado. Por favor, habilite el acceso a la cámara en la configuración de su navegador.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError" || err.name === "OverconstrainedError" || err.name === "TrackStartError" || err.name === "NotReadableError") {
             setError("No se encontró una cámara trasera. Intentando con la cámara frontal.");
             try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
                setError(null);
             } catch (fallbackError: any) {
                setError(`No se ha encontrado ninguna cámara. Es posible que el dispositivo no tenga una o que esté siendo utilizada por otra aplicación.`);
             }
        } else {
             setError(`Error de cámara: ${err.message}`);
        }
      }
    };

    getCameraPermission();
    fetchColumnOrder();

    const q = query(collection(db, "scan_history"), orderBy("scannedAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const history: ScanRecord[] = [];
        querySnapshot.forEach((doc) => {
            history.push({ scanId: doc.id, ...doc.data() } as ScanRecord);
        });
        setScanHistory(history);
        
        if(history.length > 0 && scanHistoryHeaders.length === 0) {
             const headersFromData = Array.from(history.reduce((acc, curr) => {
                Object.keys(curr).forEach(key => acc.add(key));
                return acc;
            }, new Set<string>()));
            const filteredHeaders = headersFromData.filter(key => key !== 'firebaseId' && key !== 'scannedAt' && key !== 'scannedBy' && key !== 'scanId');
            setScanHistoryHeaders(filteredHeaders);
             if (visibleScanHistoryHeaders.size === 0 && filteredHeaders.length > 0) { 
                setVisibleScanHistoryHeaders(new Set(filteredHeaders));
            }
        }

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
  }, [toast, fetchColumnOrder, scanHistoryHeaders.length, visibleScanHistoryHeaders.size]);

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
            
            const { ...dataToSaveInHistory } = productData;

            const scanInput: SaveScanInput = {
                scannedBy: currentUser.email || 'unknown',
                productData: dataToSaveInHistory
            };
            
            const saveResponse = await saveScan(scanInput);
            
            if (saveResponse.success && saveResponse.scanId) {
                 toast({
                    title: "Escaneo Registrado",
                    description: "El inmobiliario ha sido verificado y guardado en el historial.",
                });

                setEditableProduct({ 
                    ...productData, 
                    scanId: saveResponse.scanId 
                } as EditableProduct);
            } else {
                 setError("El inmobiliario fue verificado pero no se pudo guardar en el historial.");
                 toast({ variant: 'destructive', title: 'Error al Guardar' });
            }


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

    setError("No se encontró ningún inmobiliario con los códigos escaneados.");
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
      setManualCode("");
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, record: EditableProduct | null, setRecord: React.Dispatch<React.SetStateAction<EditableProduct | null>>) => {
    if (!record) return;
    const { id, value } = e.target;
    setRecord({ ...record, [id]: e.target.type === 'number' ? Number(value) : value });
  };
  
const handleSaveChanges = async (productToSave: EditableProduct | null) => {
    if (!productToSave || !productToSave.firebaseId) {
        toast({ variant: 'destructive', title: 'Error de Identificación', description: 'Falta el ID del producto principal.' });
        return;
    }

    const mainProductDocId = productToSave.firebaseId;
    const scanHistoryDocId = productToSave.scanId;

    setIsLoading(true);
    try {
        const { firebaseId, scanId, scannedAt, scannedBy, ...productData } = productToSave;
        
        const mainProductDocRef = doc(db, "products", mainProductDocId);
        await updateDoc(mainProductDocRef, productData);
        
        let toastDescription = "Los cambios se han guardado correctamente en la base de datos de inmobiliarios.";

        if (scanHistoryDocId) {
            const scanHistoryDocRef = doc(db, "scan_history", scanHistoryDocId);
            await updateDoc(scanHistoryDocRef, productData);
            toastDescription += " El registro de historial también ha sido actualizado.";
        }

        toast({
            title: "Actualización Completa",
            description: toastDescription,
        });

    } catch (error) {
        console.error("Error updating product: ", error);
        toast({
            variant: "destructive",
            title: "Error al Guardar",
            description: `No se pudo actualizar el inmobiliario y/o el historial. ${error instanceof Error ? error.message : ''}`,
        });
    } finally {
        setIsLoading(false);
        setEditingScanRecord(null);
        setEditableProduct(null);
    }
};

  
  const filteredHistory = useMemo(() => {
    if (!selectedDates || selectedDates.length === 0) return [];
    
    return scanHistory.filter(scan => {
        const scanDate = scan.scannedAt.toDate();
        return selectedDates.some(selectedDate => isSameDay(scanDate, selectedDate));
    });
  }, [scanHistory, selectedDates]);


  const handleExportHistory = () => {
      if (filteredHistory.length === 0) {
          toast({ title: "No hay datos", description: "No hay escaneos para las fechas seleccionadas." });
          return;
      }

      const dataToExport = filteredHistory.map(scan => {
          const { firebaseId, scanId, scannedAt, ...rest } = scan;
          return {
              ...rest,
              scannedAt: scannedAt.toDate().toLocaleString('es-ES')
          };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Historial de Escaneos");
      const excelFileName = `historial_escaneos.xlsx`;
      XLSX.writeFile(workbook, excelFileName);
  };

  const handleEditRecord = async (record: ScanRecord) => {
    setEditingScanRecord({ ...record });
  };

  const handleDeleteScan = async () => {
    if (!scanToDelete) return;
    try {
        await deleteDoc(doc(db, "scan_history", scanToDelete.scanId));
        toast({
            title: "Escaneo Eliminado",
            description: "El registro de escaneo ha sido eliminado del historial.",
        });
        setScanToDelete(null);
    } catch (error) {
        console.error("Error deleting scan record:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    }
  };

  const handleDeleteScansByRange = async () => {
      if (!selectedDates || selectedDates.length === 0) {
        toast({ variant: "destructive", title: "Sin selección", description: "Por favor, seleccione las fechas que desea eliminar." });
        return
      };
      
      const batch = writeBatch(db);
      filteredHistory.forEach(scan => {
          const docRef = doc(db, "scan_history", scan.scanId);
          batch.delete(docRef);
      });

      try {
          await batch.commit();
          toast({
              title: "Registros Eliminados",
              description: `Se eliminaron ${filteredHistory.length} registros de escaneo de las fechas seleccionadas.`,
          });
          setIsDeleteRangeAlertOpen(false);
      } catch (error) {
          console.error("Error deleting scan records in batch:", error);
          toast({ variant: "destructive", title: "Error", description: "No se pudieron eliminar los registros." });
      }
  };

  const handleColumnVisibilityChange = (header: string) => {
    setVisibleScanHistoryHeaders(prev => {
        const newSet = new Set(prev);
        if (newSet.has(header)) {
            newSet.delete(header);
        } else {
            newSet.add(header);
        }
        return newSet;
    });
  };

  const displayedHistoryHeaders = React.useMemo(() => {
    return scanHistoryHeaders.filter(h => visibleScanHistoryHeaders.has(h));
  }, [scanHistoryHeaders, visibleScanHistoryHeaders]);



  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
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
                            <Label htmlFor="manual-code">Código del Inmobiliario</Label>
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

        {editableProduct && !isVerifying && !editingScanRecord && (
            <Card>
                <CardHeader>
                    <CardTitle>Resultados de Verificación</CardTitle>
                    <CardDescription>Inmobiliario encontrado. Puede editar la información y se reflejará en la base de datos principal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6 max-h-[60vh] overflow-y-auto pr-6">
                     <Alert className="border-green-500 text-green-500 mb-4">
                        <CheckCircle className="h-4 w-4 !text-green-500" />
                        <AlertTitle>Verificación Exitosa</AlertTitle>
                        <AlertDescription>El escaneo se guardó en el historial.</AlertDescription>
                    </Alert>
                    {Object.entries(editableProduct).filter(([key]) => key !== 'firebaseId' && key !== 'scanId').map(([key, value]) => (
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
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditableProduct(null)}>Cancelar</Button>
                    <Button onClick={() => handleSaveChanges(editableProduct)} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Cambios
                    </Button>
                </CardFooter>
            </Card>
        )}
        
        {(result && !result.isValid && !isLoading && !isVerifying && !editableProduct) && (
             <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertTitle>Verificación Fallida</AlertTitle><AlertDescription>{error || "No se encontró el inmobiliario con el código proporcionado."}</AlertDescription></Alert>
        )}

      </div>
      <div className="flex flex-col h-full gap-4">
        <Card className="flex flex-col flex-grow">
          <CardHeader className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                      <CardTitle>Historial de Escaneos</CardTitle>
                      <CardDescription>Aquí se muestran los escaneos registrados.</CardDescription>
                  </div>
                   <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Popover>
                          <PopoverTrigger asChild>
                           <Button
                              id="date"
                              variant={"outline"}
                              className="w-full sm:w-[280px] justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDates?.length === 1 && isSameDay(selectedDates[0], new Date()) ? (
                                `Hoy, ${format(selectedDates[0], "PPP", { locale: es })}`
                              ) : selectedDates?.length === 1 ? (
                                format(selectedDates[0], "PPP", { locale: es })
                              ) : selectedDates?.length ? (
                                `${selectedDates.length} día(s) seleccionado(s)`
                              ) : (
                                <span>Seleccione fechas</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                              initialFocus
                              mode="multiple"
                              selected={selectedDates}
                              onSelect={setSelectedDates}
                              locale={es}
                          />
                          </PopoverContent>
                      </Popover>
                       <Button onClick={handleExportHistory} size="sm" variant="outline" className="h-10 gap-1">
                          <Download className="h-3.5 w-3.5" />
                          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                              Exportar
                          </span>
                      </Button>
                      <AlertDialog open={isDeleteRangeAlertOpen} onOpenChange={setIsDeleteRangeAlertOpen}>
                        <AlertDialogTrigger asChild>
                           <Button size="sm" variant="destructive" className="h-10 gap-1" disabled={filteredHistory.length === 0}>
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                  Eliminar Seleccionados
                              </span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción es irreversible y eliminará <strong>{filteredHistory.length}</strong> registros de escaneo de las fechas seleccionadas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteScansByRange}>Confirmar y Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="h-10 w-10">
                              <Settings className="h-4 w-4" />
                              <span className="sr-only">Configurar Columnas</span>
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Columnas Visibles</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {scanHistoryHeaders.map(header => (
                              <DropdownMenuCheckboxItem
                                  key={header}
                                  checked={visibleScanHistoryHeaders.has(header)}
                                  onSelect={(e) => e.preventDefault()}
                                  onCheckedChange={() => handleColumnVisibilityChange(header)}
                              >
                                  {header.charAt(0).toUpperCase() + header.slice(1)}
                              </DropdownMenuCheckboxItem>
                              ))}
                          </DropdownMenuContent>
                      </DropdownMenu>
                  </div>
              </div>
          </CardHeader>
          <CardContent className="flex-grow p-0">
            <div className="relative w-full h-full overflow-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        {displayedHistoryHeaders.map(header => <TableHead key={header}>{header.charAt(0).toUpperCase() + header.slice(1)}</TableHead>)}
                        <TableHead>Fecha Escaneo</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isHistoryLoading ? (
                        <TableRow>
                        <TableCell colSpan={displayedHistoryHeaders.length + 3} className="h-24 text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                        </TableCell>
                        </TableRow>
                    ) : filteredHistory.length === 0 ? (
                        <TableRow>
                        <TableCell colSpan={displayedHistoryHeaders.length + 3} className="h-24 text-center">
                            No hay registros de escaneo para las fechas seleccionadas.
                        </TableCell>
                        </TableRow>
                    ) : (
                        filteredHistory.map((scan) => (
                        <TableRow key={scan.scanId}>
                            {displayedHistoryHeaders.map(header => (
                                <TableCell key={header} className="whitespace-nowrap">
                                {String(scan[header] ?? '')}
                                </TableCell>
                            ))}
                            <TableCell>{scan.scannedAt.toDate().toLocaleString('es-ES')}</TableCell>
                            <TableCell>{scan.scannedBy}</TableCell>
                            <TableCell className="text-right">
                               <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                        <DropdownMenuItem onSelect={() => handleEditRecord(scan)}>Editar Inmobiliario</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-red-500" onSelect={() => setScanToDelete(scan)}>Eliminar Escaneo</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
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
      
      {editingScanRecord && (
        <Dialog open={!!editingScanRecord} onOpenChange={() => setEditingScanRecord(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Editar Inmobiliario desde Historial</DialogTitle>
              <DialogDescription>
                Los cambios se guardarán en la base de datos principal de inmobiliarios y en este registro del historial.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-6">
              {scanHistoryHeaders.map(key => (
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

      {scanToDelete && (
        <AlertDialog open={!!scanToDelete} onOpenChange={() => setScanToDelete(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>¿Desea eliminar este registro de escaneo?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará permanentemente el registro del historial. El inmobiliario en sí no será eliminado.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteScan}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
}

    