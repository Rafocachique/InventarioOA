
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ReportHeaderData {
    entidad: string;
    fecha: string;
    nombreApellidos: string;
    dni: string;
    correo: string;
    organo: string;
    localSede: string;
    direccion: string;
    oficinaArea: string;
    [key: string]: any;
}

interface Product {
    [key: string]: any;
}

const reportColumnMapping: Record<string, string> = {
    'Item': 'item',
    'Codigo Patrimonial': 'codbien',
    'Codigo Interno': 'codanterio',
    'Denominacion': 'descrip',
    'Marca': 'marca',
    'Modelo': 'modelo',
    'Color': 'color',
    'Serie': 'serie',
    'Otros': 'otros',
    'Estado de Conservacion': 'estado',
    'Observaciones': 'Observacion_Reporte',
};
const tableHeaders = Object.keys(reportColumnMapping);


const createHeaderTable = (doc: jsPDF, body: any[], startY: number, options = {}) => {
    (doc as any).autoTable({
        body: body,
        startY: startY,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1, ...options },
        columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 'auto' },
        },
        margin: { left: 14, right: 14 }
    });
    return (doc as any).lastAutoTable.finalY;
};

export const generateAsignacionPDF = (headerData: ReportHeaderData, products: Product[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    let y = 15;

    // Títulos
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    
    (doc as any).autoTable({
        body: [[{ content: 'ANEXO N° 03', styles: { halign: 'center', fontSize: 10 } }]],
        startY: y,
        theme: 'plain',
        styles: {cellPadding: 0},
    });
    y = (doc as any).lastAutoTable.finalY - 5;
    
    (doc as any).autoTable({
        body: [[{ content: 'FICHA ASIGNACION EN USO Y DEVOLUCION DE BIENES MUEBLES PATRIMONIALES', styles: { halign: 'center' } }]],
        startY: y,
        theme: 'plain',
        styles: {cellPadding: 0},
    });
    y = (doc as any).lastAutoTable.finalY;

    // Cabecera Entidad y Fecha
    y = createHeaderTable(doc, [[
        `ENTIDAD U ORGANIZACIÓN DE LA ENTIDAD: ${String(headerData.entidad || '').toUpperCase()}`,
        { content: `FECHA: ${String(headerData.fecha || '').toUpperCase()}`, styles: { halign: 'right' } }
    ]], y + 2, { styles: { cellPadding: 0, fontSize: 9 } });
     y = (doc as any).lastAutoTable.finalY + 1;
    doc.line(14, y, doc.internal.pageSize.width - 14, y);
    
    // Datos del Usuario Header
    y = createHeaderTable(doc, [[{ content: 'DATOS DEL USUARIO', styles: { fontStyle: 'bold', fontSize: 9 } }]], y + 1, { styles: { cellPadding: 0 } });

    const userDataBody = [
         [
            `Nombre y apellidos: ${String(headerData.nombreApellidos || '').toUpperCase()}`,
            `N° DNI: ${String(headerData.dni || '').toUpperCase()}`,
            `Correo Electronico: ${String(headerData.correo || '').toUpperCase()}`
        ],
        [
            `Organo o Unidad Organica: ${String(headerData.organo || '').toUpperCase()}`,
            `Local o sede: ${String(headerData.localSede || '').toUpperCase()}`,
             `Oficina o area: ${String(headerData.oficinaArea || '').toUpperCase()}`
        ],
        [
            `Direccion: ${String(headerData.direccion || '').toUpperCase()}`,
            '',
            ''
        ]
    ];
    y = createHeaderTable(doc, userDataBody, y);
    doc.line(14, y, doc.internal.pageSize.width - 14, y);


    // Tabla de productos
    const tableBody = products.map((product, index) => {
        return tableHeaders.map(header => {
            if (header === 'Item') return index + 1;
            const dbField = reportColumnMapping[header as keyof typeof reportColumnMapping];
            const value = product[dbField] ?? '';
            return String(value).toUpperCase();
        });
    });

    (doc as any).autoTable({
        head: [tableHeaders.map(h => h.toUpperCase())],
        body: tableBody,
        startY: y + 2,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133], textColor: [255,255,255], fontSize: 8, halign: 'center', lineColor: [44, 62, 80], lineWidth: 0.1 },
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', lineColor: [44, 62, 80], lineWidth: 0.1 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        columnStyles: {
            'DENOMINACION': { halign: 'left', cellWidth: 50 },
            'OBSERVACIONES': { halign: 'left', cellWidth: 50 },
        }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;
    if (finalY > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        finalY = 20;
    }
    
    // Consideraciones
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CONSIDERACIONES:', 14, finalY);
    finalY += 5;

    doc.setFont('helvetica', 'normal');
    const considerationsText = [
        '(1) Se consigna para el caso de entrega o devolución de bienes muebles patrimoniales para teletrabajo',
        '(2) En caso de vehículos, se utiliza adicionalmente el Formato de Ficha Técnica de Vehículo, contemplado en el Anexo N°08',
        '(3) El estado es consignado en base a la siguiente escala: bueno, regular o malo. En caso de semovientes, utilizar escala de acuerdo a su naturaleza',
        '> El usuario es responsable de la permanencia y conservación de cada uno de los bienes descritos, recomendándose tomar las precauciones del caso para evitar sustracciones, deterioros, etc.',
        '> Cualquier necesidad de traslado del bien mueble patrimonial dentro o fuera del local de la Entidad u Organización de la Entidad, es previamente comunicado al encargado de la OCP.',
    ];
    
    const splitText = doc.splitTextToSize(considerationsText.join('\n'), doc.internal.pageSize.getWidth() - 28);
    doc.text(splitText, 14, finalY);

    // Pie de página (Firmas)
    const pageHeight = doc.internal.pageSize.getHeight();
    const signatureY = pageHeight - 45;
    
    doc.line(50, signatureY, 110, signatureY); 
    doc.text("Responsable".toUpperCase(), 80, signatureY + 5, { align: 'center' });

    doc.line(180, signatureY, 240, signatureY); 
    doc.text("Jefe del area".toUpperCase(), 210, signatureY + 5, { align: 'center' });

    const signatureY2 = signatureY + 20;
    doc.line(115, signatureY2, 175, signatureY2); 
    doc.text("Oficina Administracion".toUpperCase(), 145, signatureY2 + 5, { align: 'center' });


    doc.save(`Acta_Asignacion_${headerData.dni || 'usuario'}.pdf`);
};


export const generateBajaTransferenciaPDF = (headerData: ReportHeaderData, products: Product[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDEN DE SALIDA, REINGRESO Y DESPLAZAMIENTO INTERNO DE BIENES MUEBLES PATRIMONIALES', pageWidth / 2, y, { align: 'center' });
    y += 8;

    const createTwoColumnTable = (data: any[], startY: number, options = {}) => {
        (doc as any).autoTable({
            body: data,
            startY: startY,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.1, ...options },
            columnStyles: { 0: { fontStyle: 'bold' } },
        });
        return (doc as any).lastAutoTable.finalY;
    }

    // Header section
    const headerDetails = [
        [{ content: `ENTIDAD: ${String(headerData.entidad || '').toUpperCase()}`, colSpan: 4, styles: { fontStyle: 'bold' } }],
        [
            `Tipo: ${String(headerData.tipo || '').toUpperCase()}`, 
            `Salida: ${String(headerData.salida || '').toUpperCase()}`,
            `Reingreso: ${String(headerData.reingreso || '').toUpperCase()}`,
            `Numero Movimiento: ${String(headerData.numeroMovimiento || '').toUpperCase()}`
        ],
        [
            `Motivo: ${String(headerData.motivo || '').toUpperCase()}`, 
            `Mantenimiento: ${String(headerData.mantenimiento || '').toUpperCase()}`,
            `Comision Servicio: ${String(headerData.comisionServicio || '').toUpperCase()}`,
            `Desplazamiento: ${String(headerData.desplazamiento || '').toUpperCase()}`
        ],
        [{ content: `Capacitacion o Evento: ${String(headerData.capacitacionEvento || '').toUpperCase()}`, colSpan: 4 }]
    ];
    y = createTwoColumnTable(headerDetails, y);
    y+= 2;

    // Remite y Recibe
    const remiteRecibeDetails = [
        [{ content: 'DATOS DEL RESPONSABLE DEL REMITE', styles: { fontStyle: 'bold', halign: 'center' } }, { content: 'DATOS RESPONSABLE DEL RECIBE', styles: { fontStyle: 'bold', halign: 'center' } }],
        [`Nombre y Apellidos: ${String(headerData.remiteNombre || '').toUpperCase()}`, `Nombre y Apellidos: ${String(headerData.recibeNombre || '').toUpperCase()}`],
        [`DNI: ${String(headerData.remiteDNI || '').toUpperCase()}`, `DNI: ${String(headerData.recibeDNI || '').toUpperCase()}`],
        [`Correo Electronico: ${String(headerData.remiteCorreo || '').toUpperCase()}`, `Correo Electronico: ${String(headerData.recibeCorreo || '').toUpperCase()}`],
        [`Unidad Organica: ${String(headerData.remiteUnidadOrganica || '').toUpperCase()}`, `Unidad Organica: ${String(headerData.recibeUnidadOrganica || '').toUpperCase()}`],
        [`Local o Sede: ${String(headerData.remiteLocalSede || '').toUpperCase()}`, `Local o Sede: ${String(headerData.recibeLocalSede || '').toUpperCase()}`],
        [`Oficio: ${String(headerData.remiteOficio || '').toUpperCase()}`, `Documento: ${String(headerData.recibeDocumento || '').toUpperCase()}`],
    ];
    y = createTwoColumnTable(remiteRecibeDetails, y);
    y+= 2;

    // Tabla de productos
    (doc as any).autoTable({
        head: [[{ content: 'DESCRIPCION', styles: { halign: 'center', fontStyle: 'bold', fillColor: [211,211,211] } }]],
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, lineColor: [0,0,0], lineWidth: 0.1 },
    });
    y = (doc as any).lastAutoTable.finalY;

    const tableBody = products.map((product, index) => {
        return tableHeaders.map(header => {
            if (header === 'Item') return index + 1;
            const dbField = reportColumnMapping[header as keyof typeof reportColumnMapping];
            const value = product[dbField] ?? '';
            return String(value).toUpperCase();
        });
    });

    (doc as any).autoTable({
        head: [tableHeaders.map(h => h.toUpperCase())],
        body: tableBody,
        startY: y,
        theme: 'grid',
        headStyles: { fillColor: [211, 211, 211], textColor: [0,0,0], fontSize: 7, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
        styles: { fontSize: 7, cellPadding: 1, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
            'DENOMINACION': { halign: 'left', cellWidth: 60 },
            'OBSERVACIONES': { halign: 'left', cellWidth: 40 },
        }
    });
    let finalY = (doc as any).lastAutoTable.finalY;
    
    // Firmas
    const pageHeight = doc.internal.pageSize.getHeight();
    // Check if there is enough space, otherwise add a new page.
    if (finalY > pageHeight - 80) { 
        doc.addPage();
        finalY = 20;
    }

    const drawSignatureLine = (textLines: (string | null)[], x: number, y: number, width: number) => {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
    
        const lineLength = Math.min(width * 0.8, 60); 
        const lineXStart = x + (width - lineLength) / 2;
        const lineXEnd = lineXStart + lineLength;
        doc.line(lineXStart, y, lineXEnd, y);
        
        let textY = y + 4;
        textLines.forEach(line => {
            if (line) {
                doc.text(line.toUpperCase(), x + width / 2, textY, { align: 'center' });
                textY += 4;
            }
        });
    };
    
    const signatureBlockY1 = finalY + 15;
    const signatureBlockY2 = signatureBlockY1 + 40;

    const pageContentWidth = pageWidth - margin * 2;

    const sigs1 = [
        ["FIRMA Y SELLO ADMINISTRADOR LOCAL", "SALE EL BIEN"],
        ["FIRMA Y SELLO REMITE LA SALIDA"],
        ["FIRMA Y SELLO ADMINISTRADOR LOCAL", "INGRESA EL BIEN"],
        ["FIRMA Y SELLO RECIBE EL BIEN"]
    ];
    const numSignatures1 = sigs1.length;
    const sigWidth1 = pageContentWidth / numSignatures1;
    sigs1.forEach((lines, index) => {
        drawSignatureLine(lines, margin + (index * sigWidth1), signatureBlockY1, sigWidth1);
    });

    const sigs2 = [
        ["DATOS VEHICULO", headerData.datosVehiculo || null],
        ["NOMBRE Y FIRMA RESPONSABLE DEL TRASLADO", headerData.nombreResponsableTraslado || null],
        ["NOMBRE Y FIRMA UNIDAD PATRIMONIO", headerData.nombreUnidadPatrimonio || null]
    ];
    const numSignatures2 = sigs2.length;
    const sigWidth2 = pageContentWidth / numSignatures2;
    sigs2.forEach((lines, index) => {
        drawSignatureLine(lines, margin + (index * sigWidth2), signatureBlockY2, sigWidth2);
    });

    doc.save(`Acta_${(headerData.tipo || 'Reporte').replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}
