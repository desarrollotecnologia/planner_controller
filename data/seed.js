function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatDateISO(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function buildSeedTasks() {
    const today = new Date();
    const rel = (offset) => formatDateISO(addDays(today, offset));
    const nowStr = new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

    return [
        {
            title: 'Cierre financiero mensual y análisis de márgenes',
            description: 'Consolidar estado de resultados por planta y revisar variaciones de costo de materia prima.',
            assignee: 'arley', priority: 'Alta', startDate: rel(-3), dueDate: rel(1), estimatedHours: 14,
            status: 'En progreso', progress: 75,
            logs: [{ text: 'Conciliación de planta principal completada al 100%.', author: 'Arley Quesada', timestamp: nowStr }],
        },
        {
            title: 'Preparación Comité de Presidencia Colbeef',
            description: 'Presentación ejecutiva de KPIs financieros, flujo de caja y cumplimiento presupuestal.',
            assignee: 'arley', priority: 'Alta', startDate: rel(-1), dueDate: rel(4), estimatedHours: 10,
            status: 'En revisión', progress: 85,
            logs: [{ text: 'Pendiente validar gráfica de exportaciones con comercial.', author: 'Arley Quesada', timestamp: nowStr }],
        },
        {
            title: 'Aprobación presupuesto CAPEX Q4',
            description: 'Evaluar retornos de inversión para proyectos de cadena de frío y empaque.',
            assignee: 'arley', priority: 'Media', startDate: rel(-8), dueDate: rel(-2), estimatedHours: 8,
            status: 'Finalizado', progress: 100,
            logs: [{ text: 'Aprobado en comité directivo.', author: 'Arley Quesada', timestamp: nowStr }],
        },
        {
            title: 'Auditoría de inventarios y mermas en planta',
            description: 'Arqueo selectivo de cuartos fríos y validación de controles de despacho.',
            assignee: 'laura', priority: 'Alta', startDate: rel(-4), dueDate: rel(0), estimatedHours: 16,
            status: 'En revisión', progress: 90,
            logs: [{ text: 'Hallazgos preliminares socializados con Jefe de Planta.', author: 'Laura Higuera', timestamp: nowStr }],
        },
        {
            title: 'Actualización Matriz de Riesgos SARLAFT y Operativos',
            description: 'Revisión semestral de controles críticos en compras de ganado y proveedores.',
            assignee: 'laura', priority: 'Alta', startDate: rel(-6), dueDate: rel(-1), estimatedHours: 12,
            status: 'En progreso', progress: 65,
            logs: [{ text: 'Se requieren soportes adicionales del área de compras.', author: 'Laura Higuera', timestamp: nowStr }],
        },
        {
            title: 'Seguimiento a planes de acción auditoría anterior',
            description: 'Verificar cierre efectivo de 14 recomendaciones de control interno.',
            assignee: 'laura', priority: 'Media', startDate: rel(1), dueDate: rel(7), estimatedHours: 10,
            status: 'En planeación', progress: 15,
            logs: [],
        },
        {
            title: 'Tablero de seguimiento portafolio proyectos estratégicos',
            description: 'Actualizar cronogramas, hitos críticos y semáforo de desviaciones PMO.',
            assignee: 'diego', priority: 'Alta', startDate: rel(-2), dueDate: rel(2), estimatedHours: 12,
            status: 'En progreso', progress: 60,
            logs: [{ text: 'Actualizado avance de 6 de los 8 proyectos activos.', author: 'Diego Rojas', timestamp: nowStr }],
        },
        {
            title: 'Definición de acta de constitución proyecto ERP',
            description: 'Alinear alcance, presupuesto, equipo líder y riesgos con TI y Operaciones.',
            assignee: 'diego', priority: 'Alta', startDate: rel(-5), dueDate: rel(3), estimatedHours: 14,
            status: 'En revisión', progress: 80,
            logs: [{ text: 'Borrador enviado a Dirección Controller para visto bueno.', author: 'Diego Rojas', timestamp: nowStr }],
        },
        {
            title: 'Estandarización plantillas de gestión de proyectos',
            description: 'Publicar formatos oficiales Colbeef para seguimiento semanal y lecciones aprendidas.',
            assignee: 'diego', priority: 'Baja', startDate: rel(-9), dueDate: rel(-3), estimatedHours: 6,
            status: 'Finalizado', progress: 100,
            logs: [{ text: 'Plantillas disponibles en carpeta compartida del equipo.', author: 'Diego Rojas', timestamp: nowStr }],
        },
        {
            title: 'Automatización ETL de ventas y rentabilidad diaria',
            description: 'Conectar base transaccional con modelo de Power BI para reporte diario automático.',
            assignee: 'data', priority: 'Alta', startDate: rel(0), dueDate: rel(8), estimatedHours: 20,
            status: 'En planeación', progress: 10,
            logs: [{ text: 'Requerimiento técnico documentado a la espera de ingreso del analista.', author: 'Arley Quesada', timestamp: nowStr }],
        },
        {
            title: 'Diccionario de datos y gobierno de indicadores',
            description: 'Documentar fórmulas oficiales de KPIs financieros, operativos y de calidad.',
            assignee: 'data', priority: 'Media', startDate: rel(3), dueDate: rel(11), estimatedHours: 12,
            status: 'En planeación', progress: 0,
            logs: [],
        },
        {
            title: 'Validación de pruebas técnicas candidatos vacante DATA',
            description: 'Revisar caso práctico en SQL y Power BI con los 3 finalistas del proceso.',
            assignee: 'arley', priority: 'Alta', startDate: rel(-1), dueDate: rel(2), estimatedHours: 5,
            status: 'En progreso', progress: 50,
            logs: [{ text: 'Entrevistas técnicas agendadas para esta semana.', author: 'Arley Quesada', timestamp: nowStr }],
        },
    ];
}
