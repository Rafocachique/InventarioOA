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


export const generateAsignacionPDF = (headerData: ReportHeaderData, products: Product[]) => {
    const doc = new jsPDF();

    // Título
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("ACTA DE ASIGNACIÓN DE BIENES MUEBLES PATRIMONIALES", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    doc.text("PARA USO DEL TRABAJADOR", doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });


    // Datos de cabecera
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let y = 40;
    
    const headerInfo = [
        { label: 'ENTIDAD:', value: headerData.entidad },
        { label: 'FECHA:', value: headerData.fecha },
        { label: 'NOMBRES Y APELLIDOS:', value: headerData.nombreApellidos },
        { label: 'N° DNI:', value: headerData.dni },
        { label: 'CORREO ELECTRÓNICO:', value: headerData.correo },
        { label: 'ÓRGANO O UNIDAD ORGÁNICA:', value: headerData.organo },
        { label: 'DIRECCIÓN:', value: headerData.direccion },
        { label: 'LOCAL O SEDE:', value: headerData.localSede },
        { label: 'OFICINA O ÁREA:', value: headerData.oficinaArea }
    ];

    headerInfo.forEach(info => {
        doc.setFont('helvetica', 'bold');
        doc.text(info.label, 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(info.value, 65, y);
        y += 7;
    });

    // Tabla de productos
    const tableBody = products.map((product, index) => {
        return tableHeaders.map(header => {
            if (header === 'Item') return index + 1;
            const dbField = reportColumnMapping[header];
            return String(product[dbField] ?? '');
        });
    });

    (doc as any).autoTable({
        head: [tableHeaders],
        body: tableBody,
        startY: y + 5,
        headStyles: { fillColor: [22, 160, 133], textColor: [255,255,255] },
        styles: { fontSize: 8, cellPadding: 2 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
    });


    // Pie de página (Firmas)
    let finalY = (doc as any).lastAutoTable.finalY + 20;
    if (finalY > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        finalY = 30;
    }
    
    doc.setFontSize(10);
    doc.text("Conste por el presente documento, que los bienes descritos están bajo mi responsabilidad, comprometiéndome a su", 14, finalY);
    doc.text("cuidado y conservación, así como destinarlos para el uso exclusivo de las funciones que desempeño.", 14, finalY + 5);
    
    const signatureY = finalY + 40;
    
    doc.line(40, signatureY, 100, signatureY); // Línea para firma de usuario
    doc.text("FIRMA DEL USUARIO", 55, signatureY + 5);

    doc.line(120, signatureY, 180, signatureY); // Línea para firma de responsable
    doc.text("ENTREGUE CONFORME", 130, signatureY + 5);


    doc.save(`Acta_Asignacion_${headerData.dni || 'usuario'}.pdf`);
};
