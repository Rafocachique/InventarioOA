

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
    [key:string]: any;
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


export const generateAsignacionPDF = (headerData: ReportHeaderData, products: Product[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // --- Títulos ---
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('FICHA ASIGNACION EN USO Y DEVOLUCION DE BIENES MUEBLES PATRIMONIALES', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(10);
    doc.text('ANEXO N° 03', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFont('helvetica', 'normal');


    // --- Cabecera con Recuadro ---
    (doc as any).autoTable({
        body: [
            [{ content: `ENTIDAD U ORGANIZACIÓN DE LA ENTIDAD: ${String(headerData.entidad || '').toUpperCase()}`, styles: { fontStyle: 'bold', fontSize: 9, textColor: [0,0,0], fillColor: [255, 255, 255] } }, { content: `FECHA: ${String(headerData.fecha || '').toUpperCase()}`, styles: { fontStyle: 'bold', halign: 'right', fontSize: 9, textColor: [0,0,0], fillColor: [255, 255, 255] } }]
        ],
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, lineColor: [0,0,0], lineWidth: 0.1, textColor: [0,0,0] },
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    // --- Datos del Usuario con Recuadro ---
    (doc as any).autoTable({
        head: [[{ content: 'DATOS DEL USUARIO', styles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontSize: 9, halign: 'center', fontStyle: 'bold' } }]],
        startY: y,
        theme: 'grid', 
        styles: { lineColor: [0,0,0], lineWidth: 0.1, textColor: [0,0,0] },
    });
    y = (doc as any).lastAutoTable.finalY;

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
            { content: `Direccion: ${String(headerData.direccion || '').toUpperCase()}`, colSpan: 3 }
        ]
    ];

    (doc as any).autoTable({
        body: userDataBody,
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, lineColor: [0,0,0], lineWidth: 0.1, fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal' },
        columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 90 },
            2: { cellWidth: 'auto' },
        },
    });
    y = (doc as any).lastAutoTable.finalY;
    
    // --- Título de la tabla de productos ---
    y += 2;
    (doc as any).autoTable({
        head: [[{ content: 'DESCRIPCION DE LOS BIENES', styles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontSize: 9, halign: 'center', fontStyle: 'bold' } }]],
        startY: y,
        theme: 'grid',
        styles: { lineColor: [0,0,0], lineWidth: 0.1, textColor: [0,0,0] },
    });
    y = (doc as any).lastAutoTable.finalY;


    // --- Tabla de productos ---
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
        headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontSize: 8, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], fontStyle: 'normal' },
        columnStyles: {
            'DENOMINACION': { halign: 'left', cellWidth: 50 },
            'OBSERVACIONES': { halign: 'left', cellWidth: 50 },
        }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 15;
    
    if (finalY > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        finalY = 20;
    }
    
    // --- Consideraciones ---
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('CONSIDERACIONES:', margin, finalY);
    finalY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const considerationsText = [
        '(1) Se consigna para el caso de entrega o devolución de bienes muebles patrimoniales para teletrabajo',
        '(2) En caso de vehículos, se utiliza adicionalmente el Formato de Ficha Técnica de Vehículo, contemplado en el Anexo N°08',
        '(3) El estado es consignado en base a la siguiente escala: bueno, regular o malo. En caso de semovientes, utilizar escala de acuerdo a su naturaleza',
        '> El usuario es responsable de la permanencia y conservación de cada uno de los bienes descritos, recomendándose tomar las precauciones del caso para evitar sustracciones, deterioros, etc.',
        '> Cualquier necesidad de traslado del bien mueble patrimonial dentro o fuera del local de la Entidad u Organización de la Entidad, es previamente comunicado al encargado de la OCP.',
    ];
    const splitText = doc.splitTextToSize(considerationsText.join('\n'), pageWidth - (margin * 2));
    doc.text(splitText, margin, finalY);
    finalY = doc.internal.pageSize.getHeight() - 45;

    // --- Firmas ---
    doc.setTextColor(0, 0, 0);
    const drawSignatureLine = (text: string, x: number, y: number, width: number) => {
        const lineLength = Math.min(width * 0.8, 80);
        const lineXStart = x + (width - lineLength) / 2;
        doc.line(lineXStart, y, lineXStart + lineLength, y);
        doc.text(text.toUpperCase(), x + width / 2, y + 5, { align: 'center' });
    };

    const signatureWidth = pageWidth / 3;
    drawSignatureLine("Responsable", 0, finalY, signatureWidth);
    drawSignatureLine("Jefe del Area", signatureWidth, finalY, signatureWidth);
    drawSignatureLine("Oficina Administracion", signatureWidth * 2, finalY, signatureWidth);

    doc.save(`Acta_Asignacion_${(headerData.dni || 'usuario').toUpperCase()}.pdf`);
};

export const generateBajaTransferenciaPDF = (headerData: ReportHeaderData, products: Product[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ORDEN DE SALIDA, REINGRESO Y DESPLAZAMIENTO INTERNO DE BIENES MUEBLES PATRIMONIALES', pageWidth / 2, y, { align: 'center' });
    y += 8;

    const topTableBody = [
        [
            { content: `ENTIDAD: ${String(headerData.entidad || '').toUpperCase()}`, colSpan: 3, styles: { fontStyle: 'bold', fontSize: 8 } }, 
            `Numero Movimiento: ${String(headerData.numeroMovimiento || '').toUpperCase()}`
        ],
        [
            `Tipo: ${String(headerData.tipo || '').toUpperCase()}`,
            `Salida: ${String(headerData.salida || '').toUpperCase()}`,
            `Reingreso: ${String(headerData.reingreso || '').toUpperCase()}`,
            `Desplazamiento: ${String(headerData.desplazamiento || '').toUpperCase()}`
        ],
        [
            { content: `Motivo: ${String(headerData.motivo || '').toUpperCase()}`, colSpan: 2 },
            `Mantenimiento: ${String(headerData.mantenimiento || '').toUpperCase()}`,
            `Comision Servicio: ${String(headerData.comisionServicio || '').toUpperCase()}`
        ],
        [
             { content: `Capacitacion o Evento: ${String(headerData.capacitacionEvento || '').toUpperCase()}`, colSpan: 4 }
        ]
    ];
    
    (doc as any).autoTable({
        body: topTableBody,
        startY: y,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0,0,0], lineWidth: 0.1, fillColor: [255, 255, 255], textColor: [0, 0, 0], valign: 'middle', minCellHeight: 6 },
        columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 70 },
            2: { cellWidth: 70 },
            3: { cellWidth: 'auto' }
        }
    });
    y = (doc as any).lastAutoTable.finalY + 2;


    const remiteRecibeBody = [
        [{ content: `Nombre y Apellidos: ${String(headerData.remiteNombre || '').toUpperCase()}`}, {content: `Nombre y Apellidos: ${String(headerData.recibeNombre || '').toUpperCase()}`}],
        [{ content: `DNI: ${String(headerData.remiteDNI || '').toUpperCase()}`}, {content: `DNI: ${String(headerData.recibeDNI || '').toUpperCase()}`}],
        [{ content: `Correo Electronico: ${String(headerData.remiteCorreo || '').toUpperCase()}`}, {content: `Correo Electronico: ${String(headerData.recibeCorreo || '').toUpperCase()}`}],
        [{ content: `Unidad Organica: ${String(headerData.remiteUnidadOrganica || '').toUpperCase()}`}, {content: `Unidad Organica: ${String(headerData.recibeUnidadOrganica || '').toUpperCase()}`}],
        [{ content: `Local o Sede: ${String(headerData.remiteLocalSede || '').toUpperCase()}`}, {content: `Local o Sede: ${String(headerData.recibeLocalSede || '').toUpperCase()}`}],
        [{ content: `Oficio: ${String(headerData.remiteOficio || '').toUpperCase()}`}, {content: `Documento: ${String(headerData.recibeDocumento || '').toUpperCase()}`}],
    ];

    (doc as any).autoTable({
        head: [
            [{ content: 'DATOS DEL RESPONSABLE DEL REMITE', styles: { fontStyle: 'bold', halign: 'center' } },
             { content: 'DATOS RESPONSABLE DEL RECIBE', styles: { fontStyle: 'bold', halign: 'center' } }]
        ],
        body: remiteRecibeBody,
        startY: y,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.1, fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontStyle: 'bold', halign: 'center', fontSize: 8},
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    (doc as any).autoTable({
        head: [[{ content: 'DESCRIPCION DE LOS BIENES', styles: { halign: 'center', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0,0,0], fontSize: 8 } }]],
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
        headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontSize: 7, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], fontStyle: 'normal' },
        columnStyles: {
            'DENOMINACION': { halign: 'left', cellWidth: 60 },
            'OBSERVACIONES': { halign: 'left', cellWidth: 40 },
        }
    });
    let finalY = (doc as any).lastAutoTable.finalY;
    
    const drawSignatureLine = (textLines: string[], x: number, y: number, width: number) => {
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
    
        const lineLength = Math.min(width * 0.8, 60); 
        const lineXStart = x + (width - lineLength) / 2;
        
        doc.line(lineXStart, y, lineXStart + lineLength, y);

        let currentY = y + 4;
        textLines.forEach(line => {
            doc.text(String(line || '').toUpperCase(), x + width / 2, currentY, { align: 'center' });
            currentY += 4;
        });
    };
    
    let signatureBlock1Y = finalY + 15;
    if (signatureBlock1Y > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        signatureBlock1Y = 20;
    }

    const sigs1 = [
        ["FIRMA Y SELLO ADMINISTRADOR LOCAL", "(SALE EL BIEN)"],
        ["FIRMA Y SELLO REMITE LA SALIDA"],
        ["FIRMA Y SELLO ADMINISTRADOR LOCAL", "(INGRESA EL BIEN)"],
        ["FIRMA Y SELLO RECIBE EL BIEN"]
    ];
    const numSignatures1 = sigs1.length;
    const sigWidth1 = (pageWidth - margin * 2) / numSignatures1;
    sigs1.forEach((lines, index) => {
        drawSignatureLine(lines, margin + (index * sigWidth1), signatureBlock1Y, sigWidth1);
    });
    
    let signatureBlock2Y = signatureBlock1Y + 20;

    const sigs2 = [
        {key: 'datosVehiculo', default: "DATOS VEHICULO"},
        {key: 'nombreResponsableTraslado', default: "NOMBRE Y FIRMA RESPONSABLE DEL TRASLADO"},
        {key: 'nombreUnidadPatrimonio', default: "NOMBRE Y FIRMA UNIDAD PATRIMONIO"}
    ];
    const numSignatures2 = sigs2.length;
    const sigWidth2 = (pageWidth - margin * 2) / numSignatures2;
    sigs2.forEach((sig, index) => {
        const text = String(headerData[sig.key] || '').toUpperCase() || sig.default;
        drawSignatureLine([text], margin + (index * sigWidth2), signatureBlock2Y, sigWidth2);
    });

    doc.save(`Acta_${(headerData.tipo || 'Reporte').replace(/ /g, '_').toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`);
}
