
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
    'Nro de Orden': 'item',
    'Patrimonial': 'codbien',
    'Interno': 'codanterio',
    'Denominacion': 'descrip',
    'Marca': 'marca',
    'Modelo': 'modelo',
    'Color': 'color',
    'Serie': 'serie',
    'Otros': 'otros',
    'Estado Conserv.': 'estado',
    'Observaciones': 'Observacion_Reporte',
};
const tableHeaders = [
    'Nro de Orden', 
    'Patrimonial', 
    'Interno', 
    'Denominacion', 
    'Marca', 
    'Modelo', 
    'Color', 
    'Serie', 
    'Otros', 
    'Estado Conserv.', 
    'Observaciones'
];


export const generateAsignacionPDF = (headerData: ReportHeaderData, products: Product[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    let y = 15;

    // --- Start of Header Table ---
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    const createHeaderTable = (body: any[], startY: number, options = {}) => {
        (doc as any).autoTable({
            body: body,
            startY: startY,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 1.5, ...options },
            didDrawCell: (data: any) => {
                if (data.row.index === data.table.body.length - 1) {
                    doc.line(data.table.settings.margin.left, data.cell.y + data.cell.height, pageWidth - data.table.settings.margin.right, data.cell.y + data.cell.height);
                }
            },
            margin: { left: margin, right: margin }
        });
        return (doc as any).lastAutoTable.finalY;
    };
    
    // Linea superior
    doc.line(margin, 10, pageWidth - margin, 10);

    // Título
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    y = createHeaderTable(
        [[{ content: 'ANEXO N° 03', styles: { halign: 'center' } }]],
        10
    );
    y = createHeaderTable(
        [[{ content: 'FICHA ASIGNACION EN USO Y DEVOLUCION DE BIENES MUEBLES PATRIMONIALES', styles: { halign: 'center' } }]],
        y
    );
    
    // Cabecera Entidad y Fecha
    y = createHeaderTable(
        [[
            `ENTIDAD U ORGANIZACIÓN DE LA ENTIDAD: ${headerData.entidad.toUpperCase()}`,
            { content: `FECHA: ${headerData.fecha.toUpperCase()}`, styles: { halign: 'right' } }
        ]],
        y
    );
    
    // Datos del Usuario Header
    y = createHeaderTable(
        [[{ content: 'DATOS DEL USUARIO', styles: { fontStyle: 'bold' } }]],
        y
    );

    // Datos del Usuario Content
    y = createHeaderTable(
        [[
            `Nombre y apellidos: ${headerData.nombreApellidos.toUpperCase()}`,
            `N° DNI: ${headerData.dni.toUpperCase()}`,
            `Correo Electronico: ${headerData.correo}`
        ]],
        y, { cellWidth: 'wrap' }
    );
     y = createHeaderTable(
        [[
            `Organo o Unidad Organica: ${headerData.organo.toUpperCase()}`,
            `Local o sede: ${headerData.localSede.toUpperCase()}`
        ]],
        y, { cellWidth: 'wrap' }
    );
    y = createHeaderTable(
        [[
            `Direccion: ${headerData.direccion.toUpperCase()}`,
            `Oficina o area: ${headerData.oficinaArea.toUpperCase()}`
        ]],
        y, { cellWidth: 'wrap' }
    );
    // --- End of Header Table ---


    // Tabla de productos
    const tableBody = products.map((product, index) => {
        return tableHeaders.map(header => {
            if (header === 'Nro de Orden') return index + 1;
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
        styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', lineColor: [44, 62, 80], lineWidth: 0.1 },
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
