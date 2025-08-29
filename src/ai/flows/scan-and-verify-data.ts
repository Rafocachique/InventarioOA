'use server';
/**
 * @fileOverview Flow para escanear y verificar datos contra datos cargados.
 *
 * - scanAndVerifyData - Una función que maneja el proceso de escaneo y verificación.
 * - ScanAndVerifyDataInput - El tipo de entrada para la función scanAndVerifyData.
 * - ScanAndVerifyDataOutput - El tipo de retorno para la función scanAndVerifyData.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';


const ScanAndVerifyDataInputSchema = z.object({
  scannedData: z.string().describe('Los datos escaneados desde la cámara del dispositivo.'),
});
export type ScanAndVerifyDataInput = z.infer<typeof ScanAndVerifyDataInputSchema>;

const ScanAndVerifyDataOutputSchema = z.object({
  isValid: z.boolean().describe('Si los datos escaneados son válidos contra los datos cargados.'),
  relatedInformation: z.record(z.any()).optional().describe('Información relacionada si el escaneo es exitoso.'),
});
export type ScanAndVerifyDataOutput = z.infer<typeof ScanAndVerifyDataOutputSchema>;

export async function scanAndVerifyData(input: ScanAndVerifyDataInput): Promise<ScanAndVerifyDataOutput> {
  return scanAndVerifyDataFlow(input);
}

const scanAndVerifyDataFlow = ai.defineFlow(
  {
    name: 'scanAndVerifyDataFlow',
    inputSchema: ScanAndVerifyDataInputSchema,
    outputSchema: ScanAndVerifyDataOutputSchema,
  },
  async ({ scannedData }) => {
    // Buscar en la colección "products" de Firestore un documento donde el campo "id" coincida con scannedData
    const productsRef = collection(db, "products");
    const q = query(productsRef, where("id", "==", scannedData));
    
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // No se encontró ningún producto con ese ID
      return {
        isValid: false,
        relatedInformation: undefined,
      };
    } else {
      // Se encontró el producto, se devuelve su información
      const productData = querySnapshot.docs[0].data();
      // Eliminar campos que no queremos mostrar, si los hubiera
      delete productData.firebaseId;

      return {
        isValid: true,
        relatedInformation: productData,
      };
    }
  }
);
