
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
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    (doc as any).autoTable({
        body: body,
        startY: startY,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1.5, ...options },
        didDrawCell: (data: any) => {
            if (data.row.index === data.table.body.length - 1 && data.table.body.length > 0) {
                 doc.line(data.table.settings.margin.left, data.cell.y + data.cell.height, pageWidth - data.table.settings.margin.right, data.cell.y + data.cell.height);
            }
        },
        margin: { left: margin, right: margin }
    });
    return (doc as any).lastAutoTable.finalY;
};

export const generateAsignacionPDF = (headerData: ReportHeaderData, products: Product[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    let y = 10;

    // Títulos
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    y = createHeaderTable(doc, [[{ content: 'ANEXO N° 03', styles: { halign: 'center', fontSize: 10 } }]], y);
    y = createHeaderTable(doc, [[{ content: 'FICHA ASIGNACION EN USO Y DEVOLUCION DE BIENES MUEBLES PATRIMONIALES', styles: { halign: 'center' } }]], y - 5);
    
    // Cabecera Entidad y Fecha
    y = createHeaderTable(doc, [[`ENTIDAD U ORGANIZACIÓN DE LA ENTIDAD: ${headerData.entidad.toUpperCase()}`,{ content: `FECHA: ${headerData.fecha.toUpperCase()}`, styles: { halign: 'right' } }]], y + 2);
    
    // Datos del Usuario Header
    y = createHeaderTable(doc, [[{ content: 'DATOS DEL USUARIO', styles: { fontStyle: 'bold' } }]], y);

    const userDataBody = [
        [
            `Nombre y apellidos: ${headerData.nombreApellidos.toUpperCase()}`,
            `N° DNI: ${headerData.dni.toUpperCase()}`,
            `Correo Electronico: ${headerData.correo.toUpperCase()}`
        ],
        [
            `Organo o Unidad Organica: ${headerData.organo.toUpperCase()}`,
            `Local o sede: ${headerData.localSede.toUpperCase()}`
        ],
        [
            `Direccion: ${headerData.direccion.toUpperCase()}`,
            `Oficina o area: ${headerData.oficinaArea.toUpperCase()}`
        ]
    ];
    y = createHeaderTable(doc, userDataBody, y);


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
        head: [tableHeaders],
        body: tableBody,
        startY: y + 2,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133], textColor: [255,255,255], fontSize: 8, halign: 'center', lineColor: [44, 62, 80], lineWidth: 0.1 },
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', lineColor: [44, 62, 80], lineWidth: 0.1 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        columnStyles: {
            'Denominacion': { halign: 'left', cellWidth: 50 },
            'Observaciones': { halign: 'left', cellWidth: 50 },
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
    doc.text("Responsable", 80, signatureY + 5, { align: 'center' });

    doc.line(180, signatureY, 240, signatureY); 
    doc.text("Jefe del area", 210, signatureY + 5, { align: 'center' });

    const signatureY2 = signatureY + 20;
    doc.line(115, signatureY2, 175, signatureY2); 
    doc.text("Oficina Administracion", 145, signatureY2 + 5, { align: 'center' });


    doc.save(`Acta_Asignacion_${headerData.dni || 'usuario'}.pdf`);
};


export const generateBajaTransferenciaPDF = (headerData: ReportHeaderData, products: Product[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDEN SE SALIDA, REINGRESO Y DESPLAZAMIENTO INTERNO DE BIENES MUEBLES PATRIMONIALES', pageWidth / 2, y, { align: 'center' });
    y += 8;

    const createTwoColumnTable = (data: any[], startY: number) => {
        (doc as any).autoTable({
            body: data,
            startY: startY,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.1 },
            columnStyles: { 0: { fontStyle: 'bold' } },
        });
        return (doc as any).lastAutoTable.finalY;
    }

    // Header section
    const headerDetails = [
        [{ content: `ENTIDAD: ${headerData.entidad.toUpperCase()}`, colSpan: 4, styles: { fontStyle: 'bold' } }],
        [
            `Tipo: ${(headerData.tipo || '').toUpperCase()}`, 
            `Salida: ${(headerData.salida || '').toUpperCase()}`,
            `Reingreso: ${(headerData.reingreso || '').toUpperCase()}`,
            `Numero Movimiento: ${(headerData.numeroMovimiento || '').toUpperCase()}`
        ],
        [
            `Motivo: ${(headerData.motivo || '').toUpperCase()}`, 
            `Mantenimiento: ${(headerData.mantenimiento || '').toUpperCase()}`,
            `Comision Servicio: ${(headerData.comisionServicio || '').toUpperCase()}`,
            `Desplazamiento: ${(headerData.desplazamiento || '').toUpperCase()}`
        ],
        [{ content: `Capacitacion o Evento: ${(headerData.capacitacionEvento || '').toUpperCase()}`, colSpan: 4 }]
    ];
    y = createTwoColumnTable(headerDetails, y);
    y+= 2;

    // Remite y Recibe
    const remiteRecibeDetails = [
        [{ content: 'DATOS DEL RESPONSABLE DEL REMITE', styles: { fontStyle: 'bold', halign: 'center' } }, { content: 'DATOS RESPONSABLE DEL RECIBE', styles: { fontStyle: 'bold', halign: 'center' } }],
        [`Nombre y Apellidos: ${(headerData.remiteNombre || '').toUpperCase()}`, `Nombre y Apellidos: ${(headerData.recibeNombre || '').toUpperCase()}`],
        [`DNI: ${(headerData.remiteDNI || '').toUpperCase()}`, `DNI: ${(headerData.recibeDNI || '').toUpperCase()}`],
        [`Correo Electronico: ${(headerData.remiteCorreo || '').toUpperCase()}`, `Correo Electronico: ${(headerData.recibeCorreo || '').toUpperCase()}`],
        [`Unidad Organica: ${(headerData.remiteUnidadOrganica || '').toUpperCase()}`, `Unidad Organica: ${(headerData.recibeUnidadOrganica || '').toUpperCase()}`],
        [`Local o Sede: ${(headerData.remiteLocalSede || '').toUpperCase()}`, `Local o Sede: ${(headerData.recibeLocalSede || '').toUpperCase()}`],
        [`Oficio: ${(headerData.remiteOficio || '').toUpperCase()}`, `Documento: ${(headerData.recibeDocumento || '').toUpperCase()}`],
    ];
    y = createTwoColumnTable(remiteRecibeDetails, y);
    y+= 2;

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
        head: [['DESCRIPCION']],
        body: [],
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, halign: 'center', fontStyle: 'bold', fillColor: [211,211,211], lineColor: [0,0,0], lineWidth: 0.1 },
    });
    y = (doc as any).lastAutoTable.finalY;

    (doc as any).autoTable({
        head: [tableHeaders],
        body: tableBody,
        startY: y,
        theme: 'grid',
        headStyles: { fillColor: [211, 211, 211], textColor: [0,0,0], fontSize: 7, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
        styles: { fontSize: 7, cellPadding: 1, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
            'Denominacion': { halign: 'left', cellWidth: 60 },
            'Observaciones': { halign: 'left', cellWidth: 40 },
        }
    });
    y = (doc as any).lastAutoTable.finalY;
    
    // Firmas
    let finalY = y + 5;
    if (finalY > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        finalY = 20;
    }

    const signatureBlock = (text1: string, text2: string, x: number, yPos: number, width: number) => {
        doc.rect(x, yPos, width, 15);
        doc.text(text1, x + width/2, yPos + 5, { align: 'center', maxWidth: width - 2});
        doc.text(text2, x + width/2, yPos + 10, { align: 'center', maxWidth: width - 2});
    }

    const signatureWidth = (pageWidth - (margin*2) - 15) / 4;
    const startX = margin;
    
    signatureBlock("Firma y sello Administrador Local", "Sale el bien", startX, finalY, signatureWidth);
    signatureBlock("Firma y sello remite la Salida", "", startX + signatureWidth + 5, finalY, signatureWidth);
    signatureBlock("Firma y Sello Administrador local", "Ingresa el bien", startX + 2 * (signatureWidth + 5), finalY, signatureWidth);
    signatureBlock("Firma y sello recibe el Biem", "", startX + 3 * (signatureWidth + 5), finalY, signatureWidth);

    finalY += 20;

    if (headerData.tipo === 'Transferencia') {
        const bottomSignatureWidth = (pageWidth - (margin*2) - 10) / 3;
        signatureBlock("Datos Vehiculo", "", startX, finalY, bottomSignatureWidth);
        signatureBlock("Nombre y firma Responsable del traslado", "", startX + bottomSignatureWidth + 5, finalY, bottomSignatureWidth);
        signatureBlock("Nombre y firma Unidada Patrimonio", "", startX + 2 * (bottomSignatureWidth + 5), finalY, bottomSignatureWidth);
    } else {
        const bottomSignatureWidth = (pageWidth - (margin*2) - 5) / 2;
        signatureBlock("Datos Vehiculo", "", startX, finalY, bottomSignatureWidth);
        signatureBlock("Nombre y firma Responsable del traslado", "", startX + bottomSignatureWidth + 5, finalY, bottomSignatureWidth);
    }

    doc.save(`Acta_${(headerData.tipo || 'Reporte').replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}
