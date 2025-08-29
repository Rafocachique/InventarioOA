
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
    const scannedValue = scannedData.trim();
    const scannedNumber = isNaN(Number(scannedValue)) ? null : Number(scannedValue);
    
    const valuesToSearch = [scannedValue];
    if (scannedNumber !== null && String(scannedNumber) !== scannedValue) {
        valuesToSearch.push(scannedNumber);
    }
    
    const idQuery = query(productsRef, where("id", "in", valuesToSearch));
    const codbienQuery = query(productsRef, where("Codbien", "in", valuesToSearch));

    const [idSnapshot, codbienSnapshot] = await Promise.all([
        getDocs(idQuery),
        getDocs(codbienQuery)
    ]);

    let foundDoc: DocumentData | null = null;
    
    if (!idSnapshot.empty) {
        foundDoc = idSnapshot.docs[0];
    } else if (!codbienSnapshot.empty) {
        foundDoc = codbienSnapshot.docs[0];
    }

    if (foundDoc) {
        const productData = foundDoc.data() as DocumentData;
        return {
            isValid: true,
            relatedInformation: {
            ...productData,
            firebaseId: foundDoc.id, // Devolver el ID del documento de Firebase
            },
        };
    } else {
        return {
            isValid: false,
        };
    }
  }
);
