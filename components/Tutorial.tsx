import React, { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { UserProfile } from '../types';
import useTranslation from '../hooks/useTranslation';
import { View } from '../types';

interface TutorialProps {
    userProfile: UserProfile | null;
    currentView: View | 'auth-callback';
}

export const Tutorial: React.FC<TutorialProps> = ({ userProfile, currentView }) => {
    const { t } = useTranslation();
    const driverObj = useRef<any>(null);
    const stopByContextRef = useRef<Record<string, boolean>>({});
    const activeContextRef = useRef<string | null>(null);

    useEffect(() => {
        if (!userProfile || userProfile.isTutorialEnabled === false) {
            if (driverObj.current) {
                driverObj.current.destroy();
                driverObj.current = null;
            }
            return;
        }

        const tr = (key: string, fallback: string) => {
            const value = t(key);
            return value === key || !value ? fallback : value;
        };

        const dashboardSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#dashboard-title',
                popover: {
                    title: tr('tutorial_welcome_title', 'Bienvenido a Fahrtenbuch Pro'),
                    description: tr('tutorial_welcome_desc', 'Esta guía rápida te mostrará cómo gestionar tus viajes y proyectos de forma eficiente. Para desactivar este tutorial, ve a Configuración > Ayuda.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#dashboard-card-total-km',
                popover: {
                    title: tr('tutorial_dashboard_totalKm_title', 'Resumen de kilómetros'),
                    description: tr('tutorial_dashboard_totalKm_desc', 'Aquí ves los kilómetros totales registrados. Haz clic en “ver todos” para ir al listado de viajes.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#dashboard-card-projects',
                popover: {
                    title: tr('tutorial_dashboard_projects_title', 'Proyectos activos'),
                    description: tr('tutorial_dashboard_projects_desc', 'Cuenta de proyectos con actividad. Desde aquí puedes saltar a gestionarlos.'),
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#dashboard-card-co2',
                popover: {
                    title: tr('tutorial_dashboard_co2_title', 'Impacto y ajustes'),
                    description: tr('tutorial_dashboard_co2_desc', 'Muestra CO₂ si configuraste tu vehículo. Si no, configura consumo para ver estos datos.'),
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '#dashboard-alerts',
                popover: {
                    title: tr('tutorial_dashboard_alerts_title', 'Alertas proactivas'),
                    description: tr('tutorial_dashboard_alerts_desc', 'Aquí verás avisos de datos incompletos o anómalos. Úsalos para corregir rápido.'),
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '#dashboard-chart',
                popover: {
                    title: tr('tutorial_dashboard_chart_title', 'Análisis visual'),
                    description: tr('tutorial_dashboard_chart_desc', 'Gráfico de kilómetros por proyecto. Usa los filtros para ver tendencias.'),
                    side: 'top',
                    align: 'start'
                }
            },
            {
                element: '#dashboard-recent-trips',
                popover: {
                    title: tr('tutorial_dashboard_recent_title', 'Viajes recientes'),
                    description: tr('tutorial_dashboard_recent_desc', 'Lista rápida de tus últimos viajes para abrir y revisar detalles al instante.'),
                    side: 'left',
                    align: 'start'
                }
            }
        ];

        const tripEditorSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#trip-editor-title',
                popover: {
                    title: tr('tutorial_trip_editor_intro_title', 'Crear o editar viaje'),
                    description: tr('tutorial_trip_editor_intro_desc', 'Completa los datos clave del viaje, guarda y opcionalmente añade al calendario.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trip-editor-date',
                popover: {
                    title: tr('tutorial_trip_editor_date_title', 'Fecha del viaje'),
                    description: tr('tutorial_trip_editor_date_desc', 'Selecciona la fecha exacta para mantener el orden y reportes correctos.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trip-editor-project',
                popover: {
                    title: tr('tutorial_trip_editor_project_title', 'Proyecto'),
                    description: tr('tutorial_trip_editor_project_desc', 'Asigna el viaje al proyecto/cliente correcto para agrupar y facturar.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trip-editor-locations',
                popover: {
                    title: tr('tutorial_trip_editor_locations_title', 'Origen y destino'),
                    description: tr('tutorial_trip_editor_locations_desc', 'Indica origen/destino (y paradas). Si no los defines, usaremos la dirección guardada en tu perfil como predeterminada. Puedes arrastrar las paradas intermedias para reordenar.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trip-editor-special-origin',
                popover: {
                    title: tr('tutorial_trip_editor_special_title', 'Origen especial'),
                    description: tr('tutorial_trip_editor_special_desc', 'Usa “Continuación” si este viaje sigue al anterior sin volver a base; usa “Fin de continuación” para cerrar la serie y fijar el destino como retorno. Esto bloquea/ajusta origen y destino según corresponda.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trip-editor-distance',
                popover: {
                    title: tr('tutorial_trip_editor_distance_title', 'Distancia'),
                    description: tr('tutorial_trip_editor_distance_desc', 'Introduce la distancia o calcula automáticamente con el botón de ruta.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trip-editor-reason',
                popover: {
                    title: tr('tutorial_trip_editor_reason_title', 'Motivo del viaje'),
                    description: tr('tutorial_trip_editor_reason_desc', 'Describe por qué se realizó el viaje; se usa para auditoría y reportes.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trip-editor-passengers',
                popover: {
                    title: tr('tutorial_trip_editor_passengers_title', 'Pasajeros'),
                    description: tr('tutorial_trip_editor_passengers_desc', 'Añade pasajeros para calcular recargos si aplica.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trip-editor-rate',
                popover: {
                    title: tr('tutorial_trip_editor_rate_title', 'Tarifa'),
                    description: tr('tutorial_trip_editor_rate_desc', 'Usa la tarifa por km por defecto o ajusta para este viaje.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trip-editor-calendar',
                popover: {
                    title: tr('tutorial_trip_editor_calendar_title', 'Añadir a calendario'),
                    description: tr('tutorial_trip_editor_calendar_desc', 'Marca esta opción para crear el evento en tu Google Calendar.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trip-editor-actions',
                popover: {
                    title: tr('tutorial_trip_editor_actions_title', 'Guardar o cancelar'),
                    description: tr('tutorial_trip_editor_actions_desc', 'Guarda los cambios o cancela; se mostrará aviso si hay cambios sin guardar.'),
                    side: 'top',
                    align: 'end'
                }
            }
        ];

        const bulkSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#bulk-modal-title',
                popover: {
                    title: tr('tutorial_bulk_intro_title', 'Carga masiva de viajes'),
                    description: tr('tutorial_bulk_intro_desc', 'Importa viajes desde CSV o usando IA. Sigue estos pasos para preparar y revisar.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-mode-toggle',
                popover: {
                    title: tr('tutorial_bulk_mode_title', 'Elige modo'),
                    description: tr('tutorial_bulk_mode_desc', 'CSV para archivos tabulares; IA para extraer desde PDFs/imágenes/correos.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-csv-section',
                popover: {
                    title: tr('tutorial_bulk_csv_title', 'Cargar CSV'),
                    description: tr('tutorial_bulk_csv_desc', 'Sigue el formato sugerido. Puedes subir archivo, pegar texto o usar Drive.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-csv-file',
                popover: {
                    title: tr('tutorial_bulk_csv_file_title', 'Sube el archivo'),
                    description: tr('tutorial_bulk_csv_file_desc', 'Selecciona tu CSV con columnas de fecha, proyecto, origen, destino y km.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-csv-paste',
                popover: {
                    title: tr('tutorial_bulk_csv_paste_title', 'Pegar datos'),
                    description: tr('tutorial_bulk_csv_paste_desc', 'Pega filas directamente y procesa si no tienes el archivo a mano.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-ai-section',
                popover: {
                    title: tr('tutorial_bulk_ai_title', 'Extracción con IA'),
                    description: tr('tutorial_bulk_ai_desc', 'Sube PDFs/imágenes o texto; la IA extrae viajes y los prepara para revisión.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-ai-doc-type',
                popover: {
                    title: tr('tutorial_bulk_ai_doc_title', 'Tipo de documento'),
                    description: tr('tutorial_bulk_ai_doc_desc', 'Selecciona callsheet o email para mejorar la extracción y mapeo.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-ai-mode',
                popover: {
                    title: tr('tutorial_bulk_ai_mode_title', 'Modo de extracción'),
                    description: tr('tutorial_bulk_ai_mode_desc', 'Directo: rápido y estructurado. Agente: más contextual, útil para documentos complejos.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-ai-files',
                popover: {
                    title: tr('tutorial_bulk_ai_files_title', 'Sube archivos'),
                    description: tr('tutorial_bulk_ai_files_desc', 'Adjunta tus PDFs, imágenes o textos; también puedes elegir desde Drive.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-ai-drive-secondary',
                popover: {
                    title: tr('tutorial_bulk_ai_drive_title', 'Importar desde Drive'),
                    description: tr('tutorial_bulk_ai_drive_desc', 'Abre Google Drive para elegir archivos ya almacenados. Ideal para callsheets o PDFs que ya tienes subidos.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-ai-paste',
                popover: {
                    title: tr('tutorial_bulk_ai_paste_title', 'Pega texto'),
                    description: tr('tutorial_bulk_ai_paste_desc', 'Pega el contenido de un correo o texto plano para extraer viajes.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-ai-textarea',
                popover: {
                    title: tr('tutorial_bulk_ai_text_title', 'Área de texto'),
                    description: tr('tutorial_bulk_ai_text_desc', 'Añade texto extra o corrige antes de procesar. Útil si la IA debe combinar con instrucciones.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-ai-drop',
                popover: {
                    title: tr('tutorial_bulk_ai_drop_title', 'Arrastra y suelta'),
                    description: tr('tutorial_bulk_ai_drop_desc', 'También puedes arrastrar archivos aquí para cargarlos rápidamente.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-ai-process',
                popover: {
                    title: tr('tutorial_bulk_ai_process_title', 'Procesar con IA'),
                    description: tr('tutorial_bulk_ai_process_desc', 'Lanza la extracción con IA. Usa modo directo para datos tabulares o agente para documentos complejos.'),
                    side: 'top',
                    align: 'end'
                }
            },
            {
                element: '#bulk-review-title',
                popover: {
                    title: tr('tutorial_bulk_review_title', 'Revisión de viajes'),
                    description: tr('tutorial_bulk_review_desc', 'Ajusta proyecto, distancia u otros datos antes de guardar definitivamente.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-review-row',
                popover: {
                    title: tr('tutorial_bulk_review_row_title', 'Editar filas'),
                    description: tr('tutorial_bulk_review_row_desc', 'Edita fecha, ruta y proyecto en cada fila detectada. Usa la X para descartar una entrada.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-review-project',
                popover: {
                    title: tr('tutorial_bulk_review_project_title', 'Asignar proyecto'),
                    description: tr('tutorial_bulk_review_project_desc', 'Selecciona el proyecto correcto para cada viaje importado.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-review-distance',
                popover: {
                    title: tr('tutorial_bulk_review_distance_title', 'Validar distancia'),
                    description: tr('tutorial_bulk_review_distance_desc', 'Ajusta los kilómetros antes de guardar si la extracción no fue exacta.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#bulk-review-save',
                popover: {
                    title: tr('tutorial_bulk_review_save_title', 'Guardar importación'),
                    description: tr('tutorial_bulk_review_save_desc', 'Confirma para guardar todos los viajes revisados o vuelve atrás para corregir.'),
                    side: 'top',
                    align: 'end'
                }
            }
        ];

        const tripsSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#trips-title',
                popover: {
                    title: tr('tutorial_trips_intro_title', 'Vista de viajes'),
                    description: tr('tutorial_trips_intro_desc', 'Aquí gestionas y revisas todos tus viajes: filtra, edita, exporta o elimina.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trips-col-date',
                popover: {
                    title: tr('tutorial_trips_date_title', 'Fecha'),
                    description: tr('tutorial_trips_date_desc', 'Ordena por fecha para revisar viajes recientes o históricos.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trips-col-route',
                popover: {
                    title: tr('tutorial_trips_route_title', 'Ruta'),
                    description: tr('tutorial_trips_route_desc', 'Origen y destino del viaje; haz clic para ver detalles y alertas.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trips-col-project',
                popover: {
                    title: tr('tutorial_trips_project_title', 'Proyecto'),
                    description: tr('tutorial_trips_project_desc', 'Proyecto asociado; úsalo para agrupar viajes por cliente o producción.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trips-col-invoices',
                popover: {
                    title: tr('tutorial_trips_invoices_title', 'Documentos'),
                    description: tr('tutorial_trips_invoices_desc', 'Número de documentos/costos vinculados al viaje. Pasa el cursor para ver el detalle.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trips-col-distance',
                popover: {
                    title: tr('tutorial_trips_distance_title', 'Distancia'),
                    description: tr('tutorial_trips_distance_desc', 'Kilómetros recorridos. Útil para validar tarifas y reembolsos.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trips-col-emissions',
                popover: {
                    title: tr('tutorial_trips_emissions_title', 'Emisiones'),
                    description: tr('tutorial_trips_emissions_desc', 'CO₂ estimado según tu configuración de vehículo y consumo.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trips-col-earnings',
                popover: {
                    title: tr('tutorial_trips_earnings_title', 'Importe'),
                    description: tr('tutorial_trips_earnings_desc', 'Importe calculado con tu tarifa y recargos.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trips-col-actions',
                popover: {
                    title: tr('tutorial_trips_actions_title', 'Acciones'),
                    description: tr('tutorial_trips_actions_desc', 'Ver, añadir al calendario, editar o eliminar el viaje seleccionado.'),
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '#trips-filter',
                popover: {
                    title: tr('tutorial_trips_filter_title', 'Filtrar proyectos'),
                    description: tr('tutorial_trips_filter_desc', 'Filtra la tabla por proyecto para enfocarte en un cliente o producción.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trips-bulk-upload-btn',
                popover: {
                    title: tr('tutorial_trips_bulk_title', 'Cargar en lote'),
                    description: tr('tutorial_trips_bulk_desc', 'Importa múltiples viajes desde CSV o IA para acelerar la captura.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#trips-add-btn',
                popover: {
                    title: tr('tutorial_trips_add_title', 'Añadir viaje'),
                    description: tr('tutorial_trips_add_desc', 'Crea un nuevo viaje manualmente desde cero.'),
                    side: 'bottom',
                    align: 'start'
                }
            }
        ];

        const projectsSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#projects-title',
                popover: {
                    title: tr('tutorial_projects_intro_title', 'Vista de proyectos'),
                    description: tr('tutorial_projects_intro_desc', 'Administra tus proyectos/clientes, revisa viajes asociados y visibilidad en dashboard.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#projects-search',
                popover: {
                    title: tr('tutorial_projects_search_title', 'Buscar proyectos'),
                    description: tr('tutorial_projects_search_desc', 'Filtra por nombre o productor para encontrar rápidamente un proyecto.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#projects-add-btn',
                popover: {
                    title: tr('tutorial_projects_add_title', 'Crear proyecto'),
                    description: tr('tutorial_projects_add_desc', 'Añade un nuevo proyecto/cliente para asociar viajes y documentos.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#projects-table',
                popover: {
                    title: tr('tutorial_projects_table_title', 'Tabla de proyectos'),
                    description: tr('tutorial_projects_table_desc', 'Aquí ves los proyectos con sus viajes, documentos, facturas y totales. Selecciona filas para acciones masivas.'),
                    side: 'top',
                    align: 'start'
                }
            },
            {
                element: '#projects-col-name',
                popover: {
                    title: tr('tutorial_projects_name_title', 'Nombre'),
                    description: tr('tutorial_projects_name_desc', 'Nombre del proyecto/cliente. Haz clic en la fila para ver detalles.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#projects-col-producer',
                popover: {
                    title: tr('tutorial_projects_producer_title', 'Productor'),
                    description: tr('tutorial_projects_producer_desc', 'Responsable o compañía del proyecto.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#projects-col-trips',
                popover: {
                    title: tr('tutorial_projects_trips_title', 'Viajes'),
                    description: tr('tutorial_projects_trips_desc', 'Cantidad de viajes asociados a este proyecto.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#projects-col-documents',
                popover: {
                    title: tr('tutorial_projects_docs_title', 'Documentos'),
                    description: tr('tutorial_projects_docs_desc', 'Cantidad de documentos/callsheets vinculados.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#projects-col-invoices',
                popover: {
                    title: tr('tutorial_projects_invoices_title', 'Facturas/gastos'),
                    description: tr('tutorial_projects_invoices_desc', 'Gastos registrados para viajes de este proyecto.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#projects-col-total-km',
                popover: {
                    title: tr('tutorial_projects_km_title', 'Kilómetros totales'),
                    description: tr('tutorial_projects_km_desc', 'Suma de kilómetros en viajes de este proyecto.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#projects-col-est-cost',
                popover: {
                    title: tr('tutorial_projects_cost_title', 'Importe estimado'),
                    description: tr('tutorial_projects_cost_desc', 'Estimación de reembolso/importe según tus tarifas.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#projects-col-dashboard',
                popover: {
                    title: tr('tutorial_projects_dashboard_title', 'Visibilidad en dashboard'),
                    description: tr('tutorial_projects_dashboard_desc', 'Activa o desactiva para mostrar este proyecto en los widgets del tablero.'),
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '#projects-col-actions',
                popover: {
                    title: tr('tutorial_projects_actions_title', 'Acciones'),
                    description: tr('tutorial_projects_actions_desc', 'Edita o elimina el proyecto. Haz clic en la fila para ver detalles completos.'),
                    side: 'left',
                    align: 'start'
                }
            }
        ];

        const reportModalSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#report-modal-title',
                popover: {
                    title: tr('tutorial_report_modal_intro_title', 'Generar informe'),
                    description: tr('tutorial_report_modal_intro_desc', 'Selecciona proyecto y rango de fechas. Luego audita antes de generar.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#report-modal-project',
                popover: {
                    title: tr('tutorial_report_modal_project_title', 'Proyecto'),
                    description: tr('tutorial_report_modal_project_desc', 'Elige un proyecto o “Todos” para incluir todos los viajes disponibles.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#report-modal-from',
                popover: {
                    title: tr('tutorial_report_modal_from_title', 'Fecha inicio'),
                    description: tr('tutorial_report_modal_from_desc', 'Define el inicio del periodo que quieres incluir en el informe.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#report-modal-to',
                popover: {
                    title: tr('tutorial_report_modal_to_title', 'Fecha fin'),
                    description: tr('tutorial_report_modal_to_desc', 'Define el fin del periodo para delimitar el informe.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#report-modal-audit',
                popover: {
                    title: tr('tutorial_report_modal_audit_title', 'Auditar datos'),
                    description: tr('tutorial_report_modal_audit_desc', 'Revisa los viajes que entran en el informe y posibles alertas antes de generar.'),
                    side: 'top',
                    align: 'end'
                }
            },
            {
                element: '#report-audit-title',
                popover: {
                    title: tr('tutorial_report_audit_title', 'Resultados de auditoría'),
                    description: tr('tutorial_report_audit_desc', 'Aquí ves alertas como motivos faltantes o distancias cero. Corrige antes de generar si es necesario.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#report-generate',
                popover: {
                    title: tr('tutorial_report_generate_title', 'Generar informe'),
                    description: tr('tutorial_report_generate_desc', 'Genera y guarda el informe con los datos auditados y la firma de integridad.'),
                    side: 'top',
                    align: 'end'
                }
            }
        ];

        const calendarSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#calendar-title',
                popover: {
                    title: tr('tutorial_calendar_intro_title', 'Calendario de eventos'),
                    description: tr('tutorial_calendar_intro_desc', 'Conecta Google Calendar y visualiza tus eventos del mes.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#calendar-connect',
                popover: {
                    title: tr('tutorial_calendar_connect_title', 'Conectar calendario'),
                    description: tr('tutorial_calendar_connect_desc', 'Inicia sesión para sincronizar tus calendarios y ver eventos.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#calendar-refresh',
                popover: {
                    title: tr('tutorial_calendar_refresh_title', 'Refrescar calendarios'),
                    description: tr('tutorial_calendar_refresh_desc', 'Actualiza la lista de calendarios y eventos desde Google.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#calendar-current-month',
                popover: {
                    title: tr('tutorial_calendar_month_title', 'Mes actual'),
                    description: tr('tutorial_calendar_month_desc', 'Navega entre meses con las flechas para revisar eventos pasados o futuros.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#calendar-grid',
                popover: {
                    title: tr('tutorial_calendar_grid_title', 'Vista mensual'),
                    description: tr('tutorial_calendar_grid_desc', 'Cada celda muestra los eventos del día. Haz clic para ver detalles en el modal.'),
                    side: 'top',
                    align: 'start'
                }
            }
        ];

        const advancedSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#advanced-title',
                popover: {
                    title: tr('tutorial_advanced_intro_title', 'Vista avanzada'),
                    description: tr('tutorial_advanced_intro_desc', 'Accede a plantillas de ruta, análisis de costos y ranking de CO₂.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#advanced-card-routes',
                popover: {
                    title: tr('tutorial_advanced_routes_title', 'Plantillas de ruta'),
                    description: tr('tutorial_advanced_routes_desc', 'Define rutas frecuentes para cargarlas rápido en tus viajes.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#advanced-card-cost-analysis',
                popover: {
                    title: tr('tutorial_advanced_cost_title', 'Análisis de costos'),
                    description: tr('tutorial_advanced_cost_desc', 'Consulta costos estimados y facturas reales por periodo o proyecto.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#advanced-card-co2',
                popover: {
                    title: tr('tutorial_advanced_co2_title', 'Ranking CO₂'),
                    description: tr('tutorial_advanced_co2_desc', 'Compara emisiones entre proyectos/trips y ajusta tu configuración.'),
                    side: 'bottom',
                    align: 'start'
                }
            }
        ];

        const costAnalysisSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#cost-analysis-title',
                popover: {
                    title: tr('tutorial_cost_intro_title', 'Análisis de costos'),
                    description: tr('tutorial_cost_intro_desc', 'Revisa costos estimados y facturas reales de tus viajes en distintos periodos.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#cost-analysis-upload',
                popover: {
                    title: tr('tutorial_cost_upload_title', 'Subir facturas'),
                    description: tr('tutorial_cost_upload_desc', 'Carga facturas para usar costos reales en lugar de estimaciones.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#cost-analysis-range',
                popover: {
                    title: tr('tutorial_cost_range_title', 'Rango de tiempo'),
                    description: tr('tutorial_cost_range_desc', 'Elige el rango (3m, 6m, 1y, todo) para recalcular métricas y gráficos.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#cost-analysis-tabs',
                popover: {
                    title: tr('tutorial_cost_tabs_title', 'Vistas de costos'),
                    description: tr('tutorial_cost_tabs_desc', 'Usa Resumen para ver desglose general o Mensual para tendencias por mes.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#cost-analysis-stats',
                popover: {
                    title: tr('tutorial_cost_stats_title', 'Resumen rápido'),
                    description: tr('tutorial_cost_stats_desc', 'Estas tarjetas muestran distancia total, viajes, costo estimado y promedio por km para el rango elegido.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#cost-analysis-breakdown',
                popover: {
                    title: tr('tutorial_cost_breakdown_title', 'Desglose de costos'),
                    description: tr('tutorial_cost_breakdown_desc', 'Compara combustible/energía, mantenimiento, otros gastos y costo promedio por viaje con barras visuales.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#cost-analysis-assumptions',
                popover: {
                    title: tr('tutorial_cost_assumptions_title', 'Supuestos del cálculo'),
                    description: tr('tutorial_cost_assumptions_desc', 'Aquí ves los valores usados (consumo, tarifas, peajes, etc.). Ajusta tu vehículo para mejorar la precisión.'),
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '#cost-analysis-monthly',
                popover: {
                    title: tr('tutorial_cost_monthly_title', 'Detalle mensual'),
                    description: tr('tutorial_cost_monthly_desc', 'Tabla por mes con distancia, viajes y costos detallados. Cambia al tab “Mensual” para verla.'),
                    side: 'top',
                    align: 'start'
                }
            },
            {
                element: '#cost-analysis-projects',
                popover: {
                    title: tr('tutorial_cost_projects_title', 'Costos por proyecto'),
                    description: tr('tutorial_cost_projects_desc', 'Compara proyectos: gráfico y tabla con distancia, viajes, total y costo por km. Usa el selector para filtrar.'),
                    side: 'top',
                    align: 'start'
                }
            }
        ];

        const routeTemplatesSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#route-templates-title',
                popover: {
                    title: tr('tutorial_routes_intro_title', 'Plantillas de ruta'),
                    description: tr('tutorial_routes_intro_desc', 'Guarda rutas frecuentes (origen/destino, distancia, descripción) para reutilizarlas al crear viajes.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#route-templates-add',
                popover: {
                    title: tr('tutorial_routes_add_title', 'Crear plantilla'),
                    description: tr('tutorial_routes_add_desc', 'Abre el formulario para definir una nueva ruta y tenerla lista en un clic.'),
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '#route-templates-metrics',
                popover: {
                    title: tr('tutorial_routes_metrics_title', 'Métricas rápidas'),
                    description: tr('tutorial_routes_metrics_desc', 'Mira cuántas plantillas tienes, distancia promedio y la más usada.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#route-templates-filters',
                popover: {
                    title: tr('tutorial_routes_filters_title', 'Filtrar por categoría'),
                    description: tr('tutorial_routes_filters_desc', 'Alterna entre negocio, commuting, cliente u otras categorías para encontrar la plantilla adecuada.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#route-templates-grid',
                popover: {
                    title: tr('tutorial_routes_grid_title', 'Lista de plantillas'),
                    description: tr('tutorial_routes_grid_desc', 'Cada tarjeta muestra ruta, distancia, tiempo y uso. Edita o elimina desde aquí.'),
                    side: 'top',
                    align: 'start'
                }
            },
            {
                element: '#route-templates-empty',
                popover: {
                    title: tr('tutorial_routes_empty_title', 'Aún no tienes plantillas'),
                    description: tr('tutorial_routes_empty_desc', 'Crea tu primera plantilla con el botón “Nueva” o desde este estado vacío.'),
                    side: 'top',
                    align: 'start'
                }
            }
        ];

        const settingsSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#settings-title',
                popover: {
                    title: tr('tutorial_settings_intro_title', 'Ajustes generales'),
                    description: tr('tutorial_settings_intro_desc', 'Administra tus datos, cumplimiento, IA, personalización y ayuda desde este panel.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#settings-tab-profile',
                popover: {
                    title: tr('tutorial_settings_profile_title', 'Perfil y tarifas'),
                    description: tr('tutorial_settings_profile_desc', 'Actualiza tu nombre, matrícula, dirección y tarifas por km o pasajeros.'),
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#settings-tab-compliance',
                popover: {
                    title: tr('tutorial_settings_compliance_title', 'Bloqueos y auditoría'),
                    description: tr('tutorial_settings_compliance_desc', 'Define fechas de bloqueo para cerrar periodos y proteger los datos.'),
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#settings-tab-api',
                popover: {
                    title: tr('tutorial_settings_api_title', 'API e IA'),
                    description: tr('tutorial_settings_api_desc', 'Gestiona claves y modelos de IA para extracción y asistentes dentro de la app.'),
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#settings-tab-personalization',
                popover: {
                    title: tr('tutorial_settings_personalization_title', 'Personalización de UI'),
                    description: tr('tutorial_settings_personalization_desc', 'Cambia tema, fondos, transparencia y desenfoque para adaptar la interfaz.'),
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#settings-tab-language',
                popover: {
                    title: tr('tutorial_settings_language_title', 'Idioma'),
                    description: tr('tutorial_settings_language_desc', 'Elige el idioma de la interfaz. Se aplica al instante.'),
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#settings-tab-changelog',
                popover: {
                    title: tr('tutorial_settings_changelog_title', 'Novedades'),
                    description: tr('tutorial_settings_changelog_desc', 'Consulta cambios recientes y mejoras de la aplicación.'),
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#settings-tab-help',
                popover: {
                    title: tr('tutorial_settings_help_title', 'Ayuda y tutorial'),
                    description: tr('tutorial_settings_help_desc', 'Activa o reinicia el tutorial interactivo y encuentra soporte.'),
                    side: 'right',
                    align: 'start'
                }
            }
        ];

        const projectEditorSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#project-editor-title',
                popover: {
                    title: tr('tutorial_project_editor_intro_title', 'Añadir/editar proyecto'),
                    description: tr('tutorial_project_editor_intro_desc', 'Completa nombre y productor; opcionalmente define tarifa por km para este proyecto.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#project-editor-name',
                popover: {
                    title: tr('tutorial_project_editor_name_title', 'Nombre del proyecto'),
                    description: tr('tutorial_project_editor_name_desc', 'Nombre único para identificar al cliente o producción.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#project-editor-producer',
                popover: {
                    title: tr('tutorial_project_editor_producer_title', 'Productor/cliente'),
                    description: tr('tutorial_project_editor_producer_desc', 'Indica quién encarga el proyecto o la compañía responsable.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#project-editor-rate',
                popover: {
                    title: tr('tutorial_project_editor_rate_title', 'Tarifa por km'),
                    description: tr('tutorial_project_editor_rate_desc', 'Tarifa específica para este proyecto. Si la dejas vacía, se usará la tarifa por defecto del perfil.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#project-editor-actions',
                popover: {
                    title: tr('tutorial_project_editor_actions_title', 'Guardar o cancelar'),
                    description: tr('tutorial_project_editor_actions_desc', 'Guarda el proyecto o cancela. Si hay cambios sin guardar, se te avisará al cerrar.'),
                    side: 'top',
                    align: 'end'
                }
            }
        ];

        const reportsSteps: Array<{ element: string; popover: any }> = [
            {
                element: '#reports-title',
                popover: {
                    title: tr('tutorial_reports_intro_title', 'Vista de informes'),
                    description: tr('tutorial_reports_intro_desc', 'Genera y revisa informes de viajes por proyecto y periodo.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#reports-generate-btn',
                popover: {
                    title: tr('tutorial_reports_generate_title', 'Crear informe'),
                    description: tr('tutorial_reports_generate_desc', 'Abre el generador para seleccionar rango de fechas y proyecto a exportar.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#reports-table',
                popover: {
                    title: tr('tutorial_reports_table_title', 'Tabla de informes'),
                    description: tr('tutorial_reports_table_desc', 'Listado de informes generados con fecha, periodo y proyecto. Selecciona filas para eliminar en lote.'),
                    side: 'top',
                    align: 'start'
                }
            },
            {
                element: '#reports-col-generated',
                popover: {
                    title: tr('tutorial_reports_generated_title', 'Fecha de generación'),
                    description: tr('tutorial_reports_generated_desc', 'Cuándo se generó el informe. Útil para auditoría.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#reports-col-period',
                popover: {
                    title: tr('tutorial_reports_period_title', 'Periodo'),
                    description: tr('tutorial_reports_period_desc', 'Rango de fechas incluido en el informe.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#reports-col-project',
                popover: {
                    title: tr('tutorial_reports_project_title', 'Proyecto'),
                    description: tr('tutorial_reports_project_desc', 'Proyecto al que pertenece el informe.'),
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#reports-col-actions',
                popover: {
                    title: tr('tutorial_reports_actions_title', 'Acciones'),
                    description: tr('tutorial_reports_actions_desc', 'Ver detalles del informe o eliminarlo si ya no lo necesitas.'),
                    side: 'left',
                    align: 'start'
                }
            }
        ];

        const destroyDriver = () => {
            if (driverObj.current) {
                driverObj.current.destroy();
                driverObj.current = null;
            }
        };

        const getContextKey = () => {
            const isBulkOpen = Boolean(document.querySelector('#bulk-modal'));
            if (isBulkOpen) {
                const isReview = Boolean(document.querySelector('#bulk-review-stage'));
                if (isReview) return 'bulk-review';
                const isAi = Boolean(document.querySelector('#bulk-ai-section'));
                return isAi ? 'bulk-ai' : 'bulk-csv';
            }
            const isTripEditorOpen = Boolean(document.querySelector('#trip-editor-modal'));
            if (isTripEditorOpen) return 'trip-editor';
            const isProjectEditorOpen = Boolean(document.querySelector('#project-editor-modal'));
            if (isProjectEditorOpen) return 'project-editor';
            const isReportModalOpen = Boolean(document.querySelector('#report-modal'));
            if (isReportModalOpen) return 'report-modal';
            const isSettings = Boolean(document.querySelector('#settings-view'));
            if (isSettings) return 'settings';
            const isRouteTemplates = Boolean(document.querySelector('#route-templates-view'));
            if (isRouteTemplates) return 'route-templates';
            const isCostAnalysis = Boolean(document.querySelector('#cost-analysis-view'));
            if (isCostAnalysis) return 'cost-analysis';
            return currentView;
        };

        const resolveSteps = (contextKey: string) => {
            const selectedSteps =
                contextKey === 'bulk-ai' || contextKey === 'bulk-csv' || contextKey === 'bulk-review'
                    ? bulkSteps
                    : contextKey === 'trip-editor'
                        ? tripEditorSteps
                        : contextKey === 'project-editor'
                            ? projectEditorSteps
                            : contextKey === 'report-modal'
                                ? reportModalSteps
                                : contextKey === 'trips'
                                    ? tripsSteps
                                    : contextKey === 'projects'
                                        ? projectsSteps
                                        : contextKey === 'reports'
                                            ? reportsSteps
                                            : contextKey === 'calendar'
                                                ? calendarSteps
                                                : contextKey === 'advanced'
                                                    ? advancedSteps
                                                    : contextKey === 'cost-analysis'
                                                        ? costAnalysisSteps
                                                        : contextKey === 'route-templates'
                                                            ? routeTemplatesSteps
                                                            : contextKey === 'settings'
                                                                ? settingsSteps
                                                                : dashboardSteps;
            return selectedSteps.filter(step => document.querySelector(step.element));
        };

        const tryStart = () => {
            const contextKey = getContextKey();
            if (activeContextRef.current && activeContextRef.current !== contextKey && driverObj.current) {
                destroyDriver();
                activeContextRef.current = null;
            }
            if (driverObj.current) return;
            if (stopByContextRef.current[contextKey]) return;
            const resolvedSteps = resolveSteps(contextKey);
            if (resolvedSteps.length === 0) return;

            destroyDriver();
            activeContextRef.current = contextKey;
            driverObj.current = driver({
                showProgress: true,
                animate: true,
                allowClose: true,
                allowKeyboardControl: false,
                doneBtnText: t('tutorial_done') || 'Hecho',
                nextBtnText: t('tutorial_next') || 'Siguiente',
                prevBtnText: t('tutorial_prev') || 'Anterior',
                steps: resolvedSteps,
                onDestroyed: () => {
                    if (activeContextRef.current) {
                        stopByContextRef.current[activeContextRef.current] = true;
                    }
                    driverObj.current = null;
                }
            });

            setTimeout(() => {
                driverObj.current?.drive();
            }, 400);
        };

        // Intento inicial
        tryStart();
        // Reintento periódico para detectar apertura del modal
        const intervalId = setInterval(() => {
            if (!driverObj.current) {
                tryStart();
            }
        }, 700);

        return () => {
            clearInterval(intervalId);
            destroyDriver();
        };
    }, [currentView, t, userProfile?.isTutorialEnabled, userProfile?.id]);

    return null; // No renderiza nada visible
};
