"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { scanAndVerifyData, ScanAndVerifyDataOutput } from "@/ai/flows/scan-and-verify-data";
import { Loader2, CheckCircle, XCircle, ScanLine, Save } from "lucide-react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export default function ScanPage() {
  const [scannedInput, setScannedInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScanAndVerifyDataOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedInput.trim()) {
        setError("Por favor ingrese un dato para verificar.");
        return;
    }
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await scanAndVerifyData({ scannedData: scannedInput });
      setResult(response);
    } catch (err) {
      setError("Ocurrió un error al verificar los datos.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Escanear y Verificar</CardTitle>
          <CardDescription>Simule un escaneo ingresando un número de producto y verifíquelo contra los datos cargados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-video bg-card-foreground/10 rounded-lg flex items-center justify-center p-4">
            <div className="relative w-full h-full border-2 border-dashed border-muted-foreground rounded-md flex flex-col items-center justify-center">
              <ScanLine className="h-16 w-16 text-muted-foreground animate-pulse" />
              <p className="text-muted-foreground mt-2">Apunte la cámara al código</p>
            </div>
          </div>
          <form onSubmit={handleScan} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scanned-data">Dato Escaneado (Simulado)</Label>
              <Input
                id="scanned-data"
                value={scannedInput}
                onChange={(e) => setScannedInput(e.target.value)}
                placeholder="Ej: PROD-001"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verificar Dato
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Resultados de Verificación</CardTitle>
          <CardDescription>Aquí se mostrará el resultado del escaneo y la información relacionada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {result && (
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
          {result?.isValid && result.relatedInformation && (
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Información del Producto</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                      <TableBody>
                        {Object.entries(result.relatedInformation).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="font-medium capitalize">{key.replace(/_/g, ' ')}</TableCell>
                            <TableCell>{String(value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
