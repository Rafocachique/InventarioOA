
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { scanAndVerifyData, ScanAndVerifyDataOutput } from "@/ai/flows/scan-and-verify-data";
import { extractTextFromImage } from "@/ai/flows/extract-text-from-image";
import { Loader2, CheckCircle, XCircle, Camera, Save, ScanLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc, getDocs, updateDoc, collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface EditableProduct {
  firebaseId: string;
  [key: string]: any;
}

export default function ScanPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<ScanAndVerifyDataOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [editableProduct, setEditableProduct] = useState<EditableProduct | null>(null);
  const [manualCode, setManualCode] = useState("");

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

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
          // El firebaseId ahora viene directamente en la respuesta.
          setEditableProduct(response.relatedInformation as EditableProduct);
          setIsVerifying(false);
          return true; // Match found
      }
    } catch (err) {
      setError("Ocurrió un error durante el proceso de verificación.");
      console.error(err);
    }
    
    setIsVerifying(false);
    return false; // No match found or error occurred
  };

  const processAndVerifyCodes = async (codes: string) => {
    setIsLoading(true);
    setError(null);
    setEditableProduct(null);
    setResult(null);

    const individualCodes = codes.split(/\s+/).filter(Boolean); // Split by whitespace and remove empty strings

    for (const code of individualCodes) {
      toast({ title: `Intentando con el código: ${code}`});
      const found = await performVerification(code);
      if (found) {
        setIsLoading(false);
        return; // Stop searching if a match is found
      }
    }

    // If loop completes without finding a match
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editableProduct) return;
    const { id, value } = e.target;
    setEditableProduct({ ...editableProduct, [id]: e.target.type === 'number' ? Number(value) : value });
  };
  
  const handleSaveChanges = async () => {
    if (!editableProduct || !editableProduct.firebaseId) return;

    setIsLoading(true);
    try {
      const productDocRef = doc(db, "products", editableProduct.firebaseId);
      const { firebaseId, ...productData } = editableProduct;
      await updateDoc(productDocRef, productData);

      toast({
        title: "Producto Actualizado",
        description: "Los cambios se han guardado correctamente en la base de datos.",
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
    }
  };


  return (
    <div className="grid gap-8 md:grid-cols-2">
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
      <Card>
        <CardHeader>
          <CardTitle>Resultados de Verificación</CardTitle>
          <CardDescription>Aquí se mostrará el resultado y la información del producto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isLoading || isVerifying) && !editableProduct && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {error && !isLoading && !isVerifying && !editableProduct && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          
          {result && !isLoading && !isVerifying && !editableProduct && (
            <div>
              {!result.isValid && (
                 <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Verificación Fallida</AlertTitle>
                  <AlertDescription>El producto no se encontró o el código es inválido.</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {editableProduct && !isVerifying &&(
             <Alert className="border-green-500 text-green-500 mb-4">
                <CheckCircle className="h-4 w-4 !text-green-500" />
                <AlertTitle>Verificación Exitosa</AlertTitle>
                <AlertDescription>Producto encontrado. Puede editar la información a continuación.</AlertDescription>
            </Alert>
          )}
          {editableProduct && (
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Información y Edición del Producto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {Object.entries(editableProduct).filter(([key]) => key !== 'firebaseId').map(([key, value]) => (
                        <div key={key} className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor={key} className="text-right capitalize">{key.replace(/_/g, ' ')}</Label>
                            <Input
                                id={key}
                                type={typeof value === 'number' ? 'number' : 'text'}
                                value={value ?? ''}
                                onChange={handleInputChange}
                                className="col-span-2"
                                disabled={key === 'id'}
                            />
                        </div>
                    ))}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveChanges} disabled={isLoading} className="w-full">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Cambios
                    </Button>
                </CardFooter>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
