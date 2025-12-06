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

        const steps: Array<{ element: string; popover: any }> = [
            {
                element: '#dashboard-overview',
                popover: {
                    title: t('tutorial_welcome_title') || 'Bienvenido a Fahrtenbuch Pro',
                    description: t('tutorial_welcome_desc') || 'Esta guía rápida te mostrará cómo gestionar tus viajes y proyectos de forma eficiente.',
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#dashboard-trips-cta',
                popover: {
                    title: t('tutorial_add_trip_title') || 'Añadir Viaje',
                    description: t('tutorial_add_trip_desc') || 'Haz clic aquí para registrar un nuevo viaje manualmente.',
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#nav-projects',
                popover: {
                    title: t('tutorial_projects_title') || 'Proyectos',
                    description: t('tutorial_projects_desc') || 'Gestiona tus proyectos y asigna viajes a ellos.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#nav-reports',
                popover: {
                    title: t('tutorial_reports_title') || 'Informes',
                    description: t('tutorial_reports_desc') || 'Genera informes PDF detallados para tus declaraciones de impuestos.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#nav-settings',
                popover: {
                    title: t('tutorial_settings_title') || 'Configuración',
                    description: t('tutorial_settings_desc') || 'Personaliza tu perfil, tarifas y preferencias de la aplicación.',
                    side: 'right',
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

        const showStep = (step: { element: string; popover: any }) => {
            const target = document.querySelector(step.element);
            if (!target) return;

            destroyDriver();
            driverObj.current = driver({
                showProgress: false,
                animate: true,
                allowClose: true,
                allowKeyboardControl: false,
                doneBtnText: t('tutorial_done') || 'Hecho',
                nextBtnText: t('tutorial_next') || 'Siguiente',
                prevBtnText: t('tutorial_prev') || 'Anterior',
                steps: [step],
                onDestroyed: () => {
                    driverObj.current = null;
                }
            });
            requestAnimationFrame(() => {
                setTimeout(() => {
                    driverObj.current?.drive();
                }, 200);
            });
        };

        // Primer popup explicando la vista
        const introStep = steps[0];
        const introTimer = setTimeout(() => showStep(introStep), 300);

        // Popups por hover en las cajas
        const listeners: Array<{ el: Element; handler: () => void }> = [];
        steps.forEach(step => {
            const el = document.querySelector(step.element);
            if (!el) return;
            const handler = () => showStep(step);
            el.addEventListener('mouseenter', handler);
            listeners.push({ el, handler });
        });

        return () => {
            clearTimeout(introTimer);
            listeners.forEach(({ el, handler }) => el.removeEventListener('mouseenter', handler));
            destroyDriver();
        };
    }, [currentView, t, userProfile?.isTutorialEnabled, userProfile?.id]);

    return null; // No renderiza nada visible
};
