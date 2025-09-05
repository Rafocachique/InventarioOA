
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
    const doc = new jsPDF();
    let y = 15;

    // Título
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text("ANEXO N° 03", doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 7;
    doc.text("FICHA ASIGNACION EN USO Y DEVOLUCION DE BIENES MUEBLES PATRIMONIALES", doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 10;
    
    // Cabecera Entidad y Fecha
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('ENTIDAD U ORGANIZACIÓN DE LA ENTIDAD:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(headerData.entidad, 80, y);
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA:', 160, y);
    doc.setFont('helvetica', 'normal');
    doc.text(headerData.fecha, 175, y);
    y += 7;

    // Datos del Usuario
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL USUARIO', 14, y);
    y += 7;

    const leftColumnX = 14;
    const rightColumnX = 110;
    let initialY = y;

    // Columna Izquierda
    doc.setFont('helvetica', 'bold');
    doc.text('Nombre y apellidos:', leftColumnX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(headerData.nombreApellidos, 50, y);
    y += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Organo o Unidad Organica:', leftColumnX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(headerData.organo, 58, y);
    y += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Direccion:', leftColumnX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(headerData.direccion, 35, y);
    
    // Columna Derecha
    y = initialY;
    doc.setFont('helvetica', 'bold');
    doc.text('N° DNI:', rightColumnX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(headerData.dni, 125, y);
    y += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Correo Electronico:', rightColumnX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(headerData.correo, 145, y);
    y += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Local o sede:', rightColumnX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(headerData.localSede, 132, y);
    y += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Oficina o area:', rightColumnX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(headerData.oficinaArea, 135, y);
    y += 7;


    // Tabla de productos
    const tableBody = products.map((product, index) => {
        return tableHeaders.map(header => {
            if (header === 'Nro de Orden') return index + 1;
            const dbField = reportColumnMapping[header];
            return String(product[dbField] ?? '');
        });
    });

    (doc as any).autoTable({
        head: [tableHeaders],
        body: tableBody,
        startY: y + 2,
        headStyles: { fillColor: [22, 160, 133], textColor: [255,255,255], fontSize: 8, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 1.5, halign: 'center' },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        columnStyles: {
            'Denominacion': { halign: 'left' },
            'Observaciones': { halign: 'left' },
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
    considerationsText.forEach(line => {
        doc.text(line, 14, finalY);
        finalY += 5;
    });

    // Pie de página (Firmas)
    const signatureY = finalY + 30;
    
    doc.line(30, signatureY, 80, signatureY); 
    doc.text("Responsable", 45, signatureY + 5);

    doc.line(130, signatureY, 180, signatureY); 
    doc.text("Jefe del area", 145, signatureY + 5);

    const signatureY2 = signatureY + 25;
    doc.line(80, signatureY2, 130, signatureY2); 
    doc.text("Oficina Administracion", 85, signatureY2 + 5);


    doc.save(`Acta_Asignacion_${headerData.dni || 'usuario'}.pdf`);
};

