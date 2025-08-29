
'use server';
/**
 * @fileOverview Flow to save a scan record to Firestore.
 *
 * - saveScan - A function that handles saving the scan event.
 * - SaveScanInput - The input type for the function.
 * - SaveScanOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

const SaveScanInputSchema = z.object({
  scannedBy: z.string().describe('The email of the user who performed the scan.'),
  productData: z.record(z.any()).describe('The full data of the product that was scanned.'),
});
export type SaveScanInput = z.infer<typeof SaveScanInputSchema>;

const SaveScanOutputSchema = z.object({
  success: z.boolean(),
  scanId: z.string().optional(),
});
export type SaveScanOutput = z.infer<typeof SaveScanOutputSchema>;


export async function saveScan(input: SaveScanInput): Promise<SaveScanOutput> {
  return saveScanFlow(input);
}

const saveScanFlow = ai.defineFlow(
  {
    name: 'saveScanFlow',
    inputSchema: SaveScanInputSchema,
    outputSchema: SaveScanOutputSchema,
  },
  async ({ scannedBy, productData }) => {
    try {
      const scanHistoryCollection = collection(db, 'scan_history');
      
      // Remove firebaseId if it exists, as we don't want to store it in the scan history record itself
      const { firebaseId, ...dataToSave } = productData;
      
      const docRef = await addDoc(scanHistoryCollection, {
        ...dataToSave,
        scannedBy,
        scannedAt: Timestamp.now(),
      });
      
      return {
        success: true,
        scanId: docRef.id,
      };
    } catch (error) {
      console.error("Error saving scan to history: ", error);
      return {
        success: false,
      };
    }
  }
);
