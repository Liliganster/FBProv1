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

        const selectedSteps = currentView === 'trips' ? tripsSteps : dashboardSteps;
        const resolvedSteps = selectedSteps.filter(step => document.querySelector(step.element));
        if (resolvedSteps.length === 0) {
            return;
        }

        const destroyDriver = () => {
            if (driverObj.current) {
                driverObj.current.destroy();
                driverObj.current = null;
            }
        };

        destroyDriver();
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
                driverObj.current = null;
            }
        });

        const startTimer = setTimeout(() => {
            driverObj.current?.drive();
        }, 400);

        return () => {
            clearTimeout(startTimer);
            destroyDriver();
        };
    }, [currentView, t, userProfile?.isTutorialEnabled, userProfile?.id]);

    return null; // No renderiza nada visible
};
