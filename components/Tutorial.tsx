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
                    description: tr('tutorial_welcome_desc', 'Esta guía rápida te mostrará cómo gestionar tus viajes, proyectos y reportes en este panel.'),
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
            return currentView;
        };

        const resolveSteps = (contextKey: string) => {
            const selectedSteps =
                contextKey === 'bulk-ai' || contextKey === 'bulk-csv' || contextKey === 'bulk-review'
                    ? bulkSteps
                    : contextKey === 'trip-editor'
                        ? tripEditorSteps
                        : contextKey === 'trips'
                            ? tripsSteps
                            : contextKey === 'projects'
                                ? projectsSteps
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
