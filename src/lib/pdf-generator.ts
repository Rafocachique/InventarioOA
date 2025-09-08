
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

const applyStyles = (doc: jsPDF, isBold = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
};

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

    // --- Cabecera con Recuadro ---
    (doc as any).autoTable({
        body: [
            [{ content: `ENTIDAD U ORGANIZACIÓN DE LA ENTIDAD: ${String(headerData.entidad || '').toUpperCase()}`, styles: { fontStyle: 'bold', fontSize: 9, textColor: [0,0,0] } }, { content: `FECHA: ${String(headerData.fecha || '').toUpperCase()}`, styles: { fontStyle: 'bold', halign: 'right', fontSize: 9, textColor: [0,0,0] } }]
        ],
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, lineColor: [0,0,0], lineWidth: 0.1, fillColor: [255, 255, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    // --- Datos del Usuario con Recuadro ---
    (doc as any).autoTable({
        head: [[{ content: 'DATOS DEL USUARIO', styles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontSize: 9, halign: 'center', fontStyle: 'bold' } }]],
        startY: y,
        theme: 'grid', 
        styles: { lineColor: [0,0,0], lineWidth: 0.1, textColor: [0, 0, 0] },
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
        styles: { fontSize: 8, cellPadding: 2, lineColor: [0,0,0], lineWidth: 0.1, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
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
        headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontSize: 8, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
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
    const considerationsText = [
        '(1) Se consigna para el caso de entrega o devolución de bienes muebles patrimoniales para teletrabajo',
        '(2) En caso de vehículos, se utiliza adicionalmente el Formato de Ficha Técnica de Vehículo, contemplado en el Anexo N°08',
        '(3) El estado es consignado en base a la siguiente escala: bueno, regular o malo. En caso de semovientes, utilizar escala de acuerdo a su naturaleza',
        '> El usuario es responsable de la permanencia y conservación de cada uno de los bienes descritos, recomendándose tomar las precauciones del caso para evitar sustracciones, deterioros, etc.',
        '> Cualquier necesidad de traslado del bien mueble patrimonial dentro o fuera del local de la Entidad u Organización de la Entidad, es previamente comunicado al encargado de la OCP.',
    ];
    doc.setTextColor(0, 0, 0);
    const splitText = doc.splitTextToSize(considerationsText.join('\n'), pageWidth - (margin * 2));
    doc.text(splitText, margin, finalY);
    finalY = doc.internal.pageSize.getHeight() - 45;

    // --- Firmas ---
    const drawSignatureLine = (text: string, x: number, y: number, width: number) => {
        doc.setTextColor(0, 0, 0);
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


const drawStyledCellText = (label: string, value: string, data: any) => {
    if (!label || value === undefined || value === null) return;
    const { doc, cell, settings } = data;
    const x = cell.x + settings.cellPadding;
    // A more robust way to calculate vertical center
    const yPos = cell.y + cell.height / 2 + doc.getLineHeight() / 2 - 1;

    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, x, yPos);
    
    const labelWidth = doc.getTextWidth(`${label}: `);

    doc.setFont('helvetica', 'normal');
    doc.text(String(value).toUpperCase(), x + labelWidth, yPos);
};


export const generateBajaTransferenciaPDF = (headerData: ReportHeaderData, products: Product[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDEN DE SALIDA, REINGRESO Y DESPLAZAMIENTO INTERNO DE BIENES MUEBLES PATRIMONIALES', pageWidth / 2, y, { align: 'center' });
    y += 8;


    // Header section
    (doc as any).autoTable({
        body: [
            [{ content: `ENTIDAD: ${String(headerData.entidad || '').toUpperCase()}`, colSpan: 4, styles: { fontStyle: 'bold', textColor: [0,0,0], fontSize: 8 } }],
            [
                { content: '', name: 'tipo' },
                { content: '', name: 'salida' },
                { content: '', name: 'reingreso' },
                { content: '', name: 'numeroMovimiento' }
            ],
            [
                { content: '', name: 'motivo' },
                { content: '', name: 'mantenimiento' },
                { content: '', name: 'comisionServicio' },
                { content: '', name: 'desplazamiento' }
            ],
            [{ content: '', name: 'capacitacionEvento', colSpan: 4 }]
        ],
        startY: y,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.1, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
        didDrawCell: (data: any) => {
            doc.setTextColor(0,0,0);
            const cellName = data.cell.raw.name;
            if (data.row.section === 'body' && cellName) {
                switch(cellName) {
                    case 'tipo': drawStyledCellText('Tipo', headerData.tipo, data); break;
                    case 'salida': drawStyledCellText('Salida', headerData.salida, data); break;
                    case 'reingreso': drawStyledCellText('Reingreso', headerData.reingreso, data); break;
                    case 'numeroMovimiento': drawStyledCellText('Numero Movimiento', headerData.numeroMovimiento, data); break;
                    case 'motivo': drawStyledCellText('Motivo', headerData.motivo, data); break;
                    case 'mantenimiento': drawStyledCellText('Mantenimiento', headerData.mantenimiento, data); break;
                    case 'comisionServicio': drawStyledCellText('Comision Servicio', headerData.comisionServicio, data); break;
                    case 'desplazamiento': drawStyledCellText('Desplazamiento', headerData.desplazamiento, data); break;
                    case 'capacitacionEvento': drawStyledCellText('Capacitacion o Evento', headerData.capacitacionEvento, data); break;
                }
            }
        }
    });
    y = (doc as any).lastAutoTable.finalY;
    y+= 2;

    // Remite y Recibe
    (doc as any).autoTable({
        head: [[{ content: 'DATOS DEL RESPONSABLE DEL REMITE', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0,0,0] } }, { content: 'DATOS RESPONSABLE DEL RECIBE', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0,0,0] } }]],
        body: [
            [{content: '', name: 'remiteNombre'}, {content: '', name: 'recibeNombre'}],
            [{content: '', name: 'remiteDNI'}, {content: '', name: 'recibeDNI'}],
            [{content: '', name: 'remiteCorreo'}, {content: '', name: 'recibeCorreo'}],
            [{content: '', name: 'remiteUnidadOrganica'}, {content: '', name: 'recibeUnidadOrganica'}],
            [{content: '', name: 'remiteLocalSede'}, {content: '', name: 'recibeLocalSede'}],
            [{content: '', name: 'remiteOficio'}, {content: '', name: 'recibeDocumento'}],
        ],
        startY: y,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.1, fillColor: [255, 255, 255], textColor: [0, 0, 0] },
        didDrawCell: (data: any) => {
             doc.setTextColor(0,0,0);
             const cellName = data.cell.raw.name;
             if (data.row.section === 'body' && cellName) {
                switch(cellName) {
                    case 'remiteNombre': drawStyledCellText('Nombre y Apellidos', headerData.remiteNombre, data); break;
                    case 'recibeNombre': drawStyledCellText('Nombre y Apellidos', headerData.recibeNombre, data); break;
                    case 'remiteDNI': drawStyledCellText('DNI', headerData.remiteDNI, data); break;
                    case 'recibeDNI': drawStyledCellText('DNI', headerData.recibeDNI, data); break;
                    case 'remiteCorreo': drawStyledCellText('Correo Electronico', headerData.remiteCorreo, data); break;
                    case 'recibeCorreo': drawStyledCellText('Correo Electronico', headerData.recibeCorreo, data); break;
                    case 'remiteUnidadOrganica': drawStyledCellText('Unidad Organica', headerData.remiteUnidadOrganica, data); break;
                    case 'recibeUnidadOrganica': drawStyledCellText('Unidad Organica', headerData.recibeUnidadOrganica, data); break;
                    case 'remiteLocalSede': drawStyledCellText('Local o Sede', headerData.remiteLocalSede, data); break;
                    case 'recibeLocalSede': drawStyledCellText('Local o Sede', headerData.recibeLocalSede, data); break;
                    case 'remiteOficio': drawStyledCellText('Oficio', headerData.remiteOficio, data); break;
                    case 'recibeDocumento': drawStyledCellText('Documento', headerData.recibeDocumento, data); break;
                }
             }
        }
    });
    y = (doc as any).lastAutoTable.finalY;
    y+= 2;

    // Tabla de productos
    (doc as any).autoTable({
        head: [[{ content: 'DESCRIPCION DE LOS BIENES', styles: { halign: 'center', fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0,0,0] } }]],
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, lineColor: [0,0,0], lineWidth: 0.1, textColor: [0, 0, 0] },
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
        headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontSize: 7, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
        styles: { fontSize: 7, cellPadding: 1, halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
        columnStyles: {
            'DENOMINACION': { halign: 'left', cellWidth: 60 },
            'OBSERVACIONES': { halign: 'left', cellWidth: 40 },
        }
    });
    let finalY = (doc as any).lastAutoTable.finalY;
    
    // --- Firmas ---
    const pageHeight = doc.internal.pageSize.getHeight();
    if (finalY > pageHeight - 80) { 
        doc.addPage();
        finalY = 20;
    }

    const drawSignatureLine = (textLines: (string | null)[], x: number, y: number, width: number) => {
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
    
        const lineLength = Math.min(width * 0.8, 60); 
        const lineXStart = x + (width - lineLength) / 2;
        const lineXEnd = lineXStart + lineLength;
        const textYStart = y + 4;
        
        let hasContent = false;
        let currentY = textYStart;
        textLines.forEach(line => {
            if (line) {
                doc.text(line.toUpperCase(), x + width / 2, currentY, { align: 'center' });
                hasContent = true;
                currentY += 4; 
            }
        });
        
        if(hasContent || textLines.length <= 2) {
           doc.line(lineXStart, y, lineXEnd, y);
        }
    };
    
    const signatureBlockY1 = finalY + 40;
    const signatureBlockY2 = signatureBlockY1 + 40;

    const pageContentWidth = pageWidth - margin * 2;

    const sigs1 = [
        ["Firma y sello Administrador Local", "(Sale el bien)"],
        ["Firma y sello remite la Salida"],
        ["Firma y Sello Administrador local", "(Ingresa el bien)"],
        ["Firma y sello recibe el Bien"]
    ];
    const numSignatures1 = sigs1.length;
    const sigWidth1 = pageContentWidth / numSignatures1;
    sigs1.forEach((lines, index) => {
        drawSignatureLine(lines, margin + (index * sigWidth1), signatureBlockY1, sigWidth1);
    });

    const sigs2 = [
        ["Datos Vehiculo", headerData.datosVehiculo || null],
        ["Nombre y firma Responsable del traslado", headerData.nombreResponsableTraslado || null],
        ["Nombre y firma Unidad Patrimonio", headerData.nombreUnidadPatrimonio || null]
    ];
    const numSignatures2 = sigs2.length;
    const sigWidth2 = pageContentWidth / numSignatures2;
    sigs2.forEach((lines, index) => {
        drawSignatureLine(lines, margin + (index * sigWidth2), signatureBlockY2, sigWidth2);
    });

    doc.save(`Acta_${(headerData.tipo || 'Reporte').replace(/ /g, '_').toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`);
}
