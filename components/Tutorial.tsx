import React, { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { UserProfile } from '../types';
import useTranslation from '../hooks/useTranslation';

interface TutorialProps {
    userProfile: UserProfile | null;
    updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

export const Tutorial: React.FC<TutorialProps> = ({ userProfile, updateUserProfile }) => {
    const { t } = useTranslation();
    const driverObj = useRef<any>(null);

    const hasStartedRef = useRef(false);

    useEffect(() => {
        if (!userProfile) return;

        const tutorialEnabled = userProfile.isTutorialEnabled !== false;
        const tutorialSeen = userProfile.hasSeenTutorial === true;

        // If tutorial is explicitly disabled or already seen, ensure it's destroyed and return
        if (!tutorialEnabled || tutorialSeen) {
            if (driverObj.current) {
                driverObj.current.destroy();
                driverObj.current = null;
            }
            hasStartedRef.current = false;
            return;
        }

        if (driverObj.current) {
            driverObj.current.destroy();
            driverObj.current = null;
        }

        // Initialize driver
        driverObj.current = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            doneBtnText: t('tutorial_done') || 'Hecho',
            nextBtnText: t('tutorial_next') || 'Siguiente',
            prevBtnText: t('tutorial_prev') || 'Anterior',
            steps: [
                {
                    element: '#dashboard-overview',
                    popover: {
                        title: t('tutorial_dashboard_title') || 'Panel de Control',
                        description: t('tutorial_dashboard_desc') || 'Aquí puedes ver un resumen de tus viajes, distancia total y estadísticas clave.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#dashboard-trips-cta',
                    popover: {
                        title: t('tutorial_add_trip_title') || 'Añadir Viaje',
                        description: t('tutorial_add_trip_desc') || 'Haz clic aquí para registrar un nuevo viaje manualmente.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#nav-projects',
                    popover: {
                        title: t('tutorial_projects_title') || 'Proyectos',
                        description: t('tutorial_projects_desc') || 'Gestiona tus proyectos y asigna viajes a ellos.',
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '#nav-reports',
                    popover: {
                        title: t('tutorial_reports_title') || 'Informes',
                        description: t('tutorial_reports_desc') || 'Genera informes PDF detallados para tus declaraciones de impuestos.',
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '#nav-settings',
                    popover: {
                        title: t('tutorial_settings_title') || 'Configuración',
                        description: t('tutorial_settings_desc') || 'Personaliza tu perfil, tarifas y preferencias de la aplicación.',
                        side: "right",
                        align: 'start'
                    }
                }
            ],
            onDestroyed: () => {
                // Mark tutorial as seen when closed or finished
                if (!tutorialSeen) {
                    void updateUserProfile({ hasSeenTutorial: true });
                }
                hasStartedRef.current = false;
                driverObj.current = null;
            }
        });

        // Start tutorial if not already started
        let startTimer: ReturnType<typeof setTimeout> | undefined;
        if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            // Small delay to ensure UI is rendered
            startTimer = setTimeout(() => {
                if (driverObj.current) {
                    driverObj.current.drive();
                }
            }, 1500);
        }

        return () => {
            if (startTimer) {
                clearTimeout(startTimer);
            }
            if (driverObj.current) {
                driverObj.current.destroy();
                driverObj.current = null;
            }
        };

    }, [userProfile?.hasSeenTutorial, userProfile?.isTutorialEnabled, t, updateUserProfile]);

    // Expose a way to restart manually if needed (could be via context or prop, but for now auto-trigger is key)
    return null; // This component doesn't render anything visible itself
};
