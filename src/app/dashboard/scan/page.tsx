
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { scanAndVerifyData, ScanAndVerifyDataOutput } from "@/ai/flows/scan-and-verify-data";
import { extractTextFromImage } from "@/ai/flows/extract-text-from-image";
import { Loader2, CheckCircle, XCircle, Camera, Save } from "lucide-react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
      } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        setHasCameraPermission(false);
        setError("Permiso de cámara denegado. Por favor, habilite el acceso a la cámara en la configuración de su navegador.");
      }
    };

    getCameraPermission();

    return () => {
      // Cleanup: stop video stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsLoading(true);
    setResult(null);
    setError(null);
    setEditableProduct(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUri = canvas.toDataURL("image/jpeg");

    try {
      const { text: extractedText } = await extractTextFromImage({ photoDataUri: imageDataUri });
      
      if (!extractedText || extractedText.trim() === "") {
        setError("No se pudo extraer texto de la imagen. Intente de nuevo con una imagen más clara.");
        setIsLoading(false);
        return;
      }

      toast({ title: "Texto Extraído", description: `Texto reconocido: "${extractedText}"` });
      
      setIsVerifying(true);
      const response = await scanAndVerifyData({ scannedData: extractedText.trim() });
      setResult(response);
      if (response.isValid && response.relatedInformation) {
        const productData = response.relatedInformation;
        const querySnapshot = await db.collection("products").where("id", "==", productData.id).get();
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          setEditableProduct({ firebaseId: doc.id, ...doc.data() });
        }
      }

    } catch (err) {
      setError("Ocurrió un error durante el proceso de escaneo y verificación.");
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsVerifying(false);
    }
  };

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
          <CardDescription>Use la cámara para escanear un código de producto y verificarlo en la base de datos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-video bg-card-foreground/10 rounded-lg flex items-center justify-center p-4">
            {hasCameraPermission === null ? (
              <Loader2 className="h-16 w-16 text-muted-foreground animate-spin" />
            ) : hasCameraPermission === false ? (
              <div className="text-center text-destructive">
                <Camera className="h-16 w-16 mx-auto" />
                <p className="mt-2">No se pudo acceder a la cámara.</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : (
              <video ref={videoRef} className="w-full h-full object-cover rounded-md" autoPlay muted playsInline />
            )}
          </div>
          <Button onClick={captureAndScan} className="w-full" disabled={isLoading || !hasCameraPermission} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            {isVerifying ? "Verificando dato..." : (isLoading ? "Escaneando..." : "Escanear y Verificar")}
          </Button>
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Resultados de Verificación</CardTitle>
          <CardDescription>Aquí se mostrará el resultado del escaneo y la información relacionada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isLoading || isVerifying) && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {error && !isLoading && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {result && !isLoading && (
            <div>
              {result.isValid ? (
                <Alert className="border-green-500 text-green-500">
                  <CheckCircle className="h-4 w-4 !text-green-500" />
                  <AlertTitle>Verificación Exitosa</AlertTitle>
                  <AlertDescription>El producto se encuentra en la base de datos.</AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Verificación Fallida</AlertTitle>
                  <AlertDescription>El producto no se encontró o el código es inválido.</AlertDescription>
                </Alert>
              )}
            </div>
          )}
          {editableProduct && !isLoading && (
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
