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

        const steps: Array<{ element: string; popover: any }> = [
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
            steps,
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
