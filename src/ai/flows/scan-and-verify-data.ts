
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
import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';


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
    const productsRef = collection(db, "products");
    
    // Intenta convertir a número si es posible, si no, usa el string
    const scannedNumber = isNaN(Number(scannedData)) ? null : Number(scannedData);

    let q;
    // Si es un número válido, creamos una consulta que busque tanto el número como el string
    if (scannedNumber !== null) {
      q = query(productsRef, where("id", "in", [scannedData, scannedNumber]));
    } else {
      // Si no es un número, solo busca el string
      q = query(productsRef, where("id", "==", scannedData));
    }
    
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return {
        isValid: false,
      };
    } else {
      const doc = querySnapshot.docs[0];
      const productData = doc.data() as DocumentData;
      return {
        isValid: true,
        relatedInformation: {
          ...productData,
          firebaseId: doc.id, // Devolver el ID del documento de Firebase
        },
      };
    }
  }
);
