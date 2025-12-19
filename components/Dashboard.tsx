import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import useTrips from '../hooks/useTrips';
import { BarChartIcon, BellIcon, Co2EmissionIcon, ListIcon, FolderIcon, SparklesIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useUserProfile from '../hooks/useUserProfile';
import { Trip, View, PersonalizationSettings } from '../types';
import { AiQuotaCheck } from '../services/aiQuotaService';
import TripDetailModal from './TripDetailModal';

import useDashboardSettings from '../hooks/useDashboardSettings';
import { formatDateForDisplay } from '../i18n/translations';
import { Button } from './Button';
import VehicleSettingsModal from './VehicleSettingsModal';

type ChartType = 'projectKm';

interface DashboardProps {
    setCurrentView: (view: View) => void;
    personalization: PersonalizationSettings;
    theme: 'light' | 'dark';
}

const Dashboard: React.FC<DashboardProps> = ({ setCurrentView, personalization, theme }) => {
    const { trips, projects, getAiQuota } = useTrips();
    const { userProfile } = useUserProfile();
    const { visibleProjectIds, hasSettings } = useDashboardSettings();
    const [chartType, setChartType] = useState<ChartType>('projectKm');
    const [viewingTrip, setViewingTrip] = useState<Trip | null>(null);
    const [isAlertsOpen, setIsAlertsOpen] = useState(false);
    const [isVehicleSettingsOpen, setIsVehicleSettingsOpen] = useState(false);
    const [aiQuota, setAiQuota] = useState<AiQuotaCheck | null>(null);
    const [aiQuotaLoading, setAiQuotaLoading] = useState(false);
    const alertsRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    const userTrips = useMemo(() => {
        if (!userProfile) return [];

        const showAll = !hasSettings();

        const filteredByProject = showAll
            ? trips
            : trips.filter(trip => visibleProjectIds.includes(trip.projectId));

        return filteredByProject.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [trips, userProfile, visibleProjectIds, hasSettings]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
                setIsAlertsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const totalKm = userTrips.reduce((sum, trip) => sum + trip.distance, 0);

    useEffect(() => {
        const loadQuota = async () => {
            if (!getAiQuota) return;
            setAiQuotaLoading(true);
            try {
                const q = await getAiQuota();
                setAiQuota(q);
            } catch (err) {
                console.error('Failed to load AI quota', err);
            } finally {
                setAiQuotaLoading(false);
            }
        };
        loadQuota();
    }, [getAiQuota]);

    // Check if CO2 settings are configured (vehicleType and fuel/energy consumption)
    const hasCO2Settings = useMemo(() => {
        if (!userProfile?.vehicleType) return false;

        if (userProfile.vehicleType === 'combustion') {
            return !!userProfile.fuelConsumption && userProfile.fuelConsumption > 0;
        } else if (userProfile.vehicleType === 'electric') {
            return !!userProfile.energyConsumption && userProfile.energyConsumption > 0;
        }

        return false;
    }, [userProfile]);

    const EMISSION_FACTOR_G_PER_KM = 140;
    const totalCo2 = (totalKm * EMISSION_FACTOR_G_PER_KM) / 1000; // in kg

    const activeProjectsCount = useMemo(() => {
        if (!userProfile) return 0;
        const showAll = !hasSettings();

        if (showAll) {
            const userProjectIds = new Set(trips.map(t => t.projectId));
            return userProjectIds.size;
        } else {
            return visibleProjectIds.length;
        }
    }, [userProfile, projects, trips, visibleProjectIds, hasSettings]);


    const kmByProject = projects.map(project => ({
        name: project.name,
        km: userTrips
            .filter(trip => trip.projectId === project.id)
            .reduce((sum, trip) => sum + trip.distance, 0),
    })).filter(p => p.km > 0);

    const alerts = useMemo(() => {
        if (!userTrips) return [];
        const allAlerts: { trip: Trip; type: string; message: string }[] = [];
        userTrips.forEach(trip => {
            const warnings = trip.warnings || [];

            // Check for missing reason
            if (!trip.reason?.trim()) {
                allAlerts.push({ trip, type: 'missing_reason', message: t('dashboard_alert_missing_reason') });
            }

            // Check for improbable distance (explicit numeric check)
            if (Number(trip.distance) > 1000) {
                // Avoid duplicate if backend already sent it
                if (!warnings.some(w => w.includes('Improbable'))) {
                    allAlerts.push({ trip, type: 'improbable_distance', message: t('dashboard_alert_improbable_distance') });
                }
            }

            // Check for zero distance (explicit numeric check)
            if (Number(trip.distance) === 0) {
                // Avoid duplicate if backend already sent it
                if (!warnings.some(w => w.includes('Zero'))) {
                    allAlerts.push({ trip, type: 'zero_distance', message: t('dashboard_alert_zero_distance') });
                }
            }

            // Add any other backend warnings not covered above
            warnings.forEach(w => {
                // Simple deduplication based on content matching
                const isDistanceWarning = w.includes('1000') || w.includes('0 km');
                if (!isDistanceWarning) {
                    allAlerts.push({ trip, type: 'backend_warning', message: w });
                }
            });
        });
        return allAlerts;
    }, [userTrips, t]);

    const recentTrips = useMemo(() => userTrips.slice(0, 5), [userTrips]);

    const getProjectName = (projectId: string) => {
        const byId = projects.find(p => p.id === projectId)?.name;
        if (byId) return byId;
        if (projectId) {
            const byName = projects.find(p => (p.name || '').toLowerCase() === projectId.toLowerCase())?.name;
            if (byName) return byName;
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId);
            if (!isUuid) return projectId;
        }
        return t('dashboard_unknownProject');
    };

    const translatePlanName = (plan: string) => {
        const key = `plan_name_${plan}`;
        const translated = t(key);
        return translated === key ? plan : translated;
    };

    const renderPlanValue = () => {
        if (!aiQuota) return aiQuotaLoading ? 'Cargando…' : 'Plan no asignado';
        const planDisplay = translatePlanName(aiQuota.plan).toUpperCase();
        if (aiQuota.limit === null) {
            return `${planDisplay} · IA ∞`;
        }
        return `${planDisplay} · ${aiQuota.used}/${aiQuota.limit} solicitudes`;
    };

    const renderPlanHint = () => {
        if (!aiQuota || aiQuota.limit === null) return 'IA ilimitada en este plan.';
        if (aiQuota.remaining === 0) return 'Sin solicitudes restantes. Mejora tu plan para más IA.';
        return `Te quedan ${aiQuota.remaining} solicitudes IA este ciclo.`;
    };

    // Dynamic style for glass effect based on personalization
    const glassStyle = {
        backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
        backdropFilter: `blur(${personalization.uiBlur}px)`,
        WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
    };

    const StatCard = ({ title, value, cta, onClick, children }: { title: string, value: string, cta?: string, onClick?: () => void, children?: React.ReactNode }) => (
        <div style={glassStyle} className="bg-frost-glass border border-white/10 rounded-fluid p-4 md:p-6 flex flex-col justify-between min-h-[140px] md:min-h-[160px] h-full transition-all duration-300 hover:-translate-y-[2px] hover:shadow-glass shadow-sm">
            <div>
                <div className="flex items-start justify-between">
                    <h3 className="text-xs md:text-sm font-medium text-on-surface-secondary uppercase tracking-wider">{title}</h3>
                    {children && !cta && <div className="text-right">{children}</div>}
                </div>
                <p className="text-2xl md:text-3xl font-bold mt-2 text-white tracking-tight">{value}</p>
            </div>
            <div className="flex-grow flex flex-col justify-end">
                {children && cta && <div className="mt-4">{children}</div>}
                {cta && onClick && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClick}
                        className="text-brand-primary hover:text-white hover:bg-brand-primary/20 -ml-3 mt-2 justify-start"
                    >
                        {cta} →
                    </Button>
                )}
            </div>
        </div>
    );

    const renderChart = () => {
        return <Bar dataKey="km" fill="url(#brandGradient)" name={t('dashboard_tooltip_kms')} radius={[4, 4, 0, 0]} />;
    };

    const chartData = kmByProject;

    return (
        <div className="text-on-surface-dark animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4" id="dashboard-header">
                <div>
                    <h1 id="dashboard-title" className="text-2xl md:text-3xl font-bold text-white tracking-tight">{t('dashboard_title')}</h1>
                    {userProfile && <h2 className="text-base md:text-lg font-medium text-brand-primary/90">{userProfile.name}</h2>}
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <div className="relative" ref={alertsRef} id="dashboard-alerts">
                        <Button variant="icon" onClick={() => setIsAlertsOpen(!isAlertsOpen)} className="relative hover:bg-white/10">
                            <BellIcon className="w-6 h-6 text-on-surface-secondary" />
                            {alerts.length > 0 && <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-600 border-2 border-surface-dark animate-pulse"></span>}
                        </Button>
                        {isAlertsOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-surface-dark/95 border border-white/10 rounded-gentle shadow-glass-lg z-50 backdrop-blur-xl">
                                <div className="p-3 font-semibold border-b border-white/10 text-white flex justify-between items-center">
                                    {t('dashboard_proactive_alerts_title')}
                                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{alerts.length}</span>
                                </div>
                                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                    {alerts.length > 0 ? (
                                        alerts.slice(0, 10).map((alert, index) => (
                                            <div key={index} className="p-3 border-b border-white/5 hover:bg-white/5 transition-colors duration-200">
                                                <p className="text-sm text-on-surface-medium mb-2">{alert.message}</p>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => { setViewingTrip(alert.trip); setIsAlertsOpen(false); }}
                                                    className="text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 h-auto py-1 px-2"
                                                >
                                                    {t('dashboard_alert_view_trip_cta')}
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="p-4 text-sm text-on-surface-secondary text-center">{t('dashboard_alert_no_alerts')}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <div
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-sm text-white shadow-sm backdrop-blur-sm"
                        title={renderPlanHint()}
                    >
                        <SparklesIcon className="w-4 h-4 text-brand-primary" />
                        <span className="font-semibold text-brand-primary/90">
                            {aiQuotaLoading ? 'IA…' : renderPlanValue()}
                        </span>
                        {aiQuota && aiQuota.limit !== null && aiQuota.remaining === 0 && (
                            <button
                                onClick={() => setCurrentView('plans')}
                                className="ml-2 text-xs underline text-brand-primary hover:text-white transition-colors"
                                type="button"
                            >
                                Mejorar
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div id="dashboard-overview" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 items-stretch">
                <div id="dashboard-card-total-km">
                    <StatCard title={t('dashboard_totalKm')} value={`${totalKm.toFixed(1)} km`} cta={t('dashboard_viewAllTrips')} onClick={() => setCurrentView('trips')}>
                        <div id="dashboard-trips-cta" />
                    </StatCard>
                </div>
                <div id="dashboard-card-projects">
                    <StatCard title={t('dashboard_activeProjects')} value={activeProjectsCount.toString()} cta={t('dashboard_manageProjects')} onClick={() => setCurrentView('projects')} />
                </div>
                <div id="dashboard-card-co2" className="h-full">
                    {hasCO2Settings ? (
                        <StatCard title={t('dashboard_total_co2')} value={`${totalCo2.toFixed(1)} kg`} />
                    ) : (
                        <div style={glassStyle} className="bg-frost-glass border border-white/10 rounded-fluid p-4 md:p-6 backdrop-blur-glass flex flex-col justify-center items-center text-center hover:shadow-glass transition-all duration-300 h-full">
                            <Co2EmissionIcon className="w-10 h-10 text-on-surface-secondary mb-3 opacity-50" />
                            <h4 className="text-sm font-medium text-on-surface-secondary mb-2">{t('dashboard_total_co2')}</h4>
                            <p className="text-xs text-on-surface-secondary mb-4 max-w-[200px]">{t('co2_settings_required_notice')}</p>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setIsVehicleSettingsOpen(true)}
                            >
                                {t('settings_vehicle_title')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                <div id="dashboard-chart" style={glassStyle} className="lg:col-span-2 bg-frost-glass border border-white/10 rounded-fluid p-4 md:p-6 backdrop-blur-glass shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
                            <BarChartIcon className="w-5 h-5 text-brand-primary" />
                            {t('dashboard_visualAnalysis')}
                        </h3>
                    </div>
                    <div className="h-56 md:h-72 lg:h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#007aff" stopOpacity={0.8} />
                                        <stop offset="100%" stopColor="#5856d6" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="#a3a3a3"
                                    tick={{ fill: '#a3a3a3', fontSize: 12 }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#a3a3a3"
                                    tick={{ fill: '#a3a3a3', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                {renderChart()}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div id="dashboard-recent-trips" style={glassStyle} className="bg-frost-glass border border-white/10 rounded-fluid p-4 md:p-6 backdrop-blur-glass shadow-sm flex flex-col">
                    <h3 className="text-base md:text-lg font-semibold mb-4 text-white flex items-center gap-2">
                        <ListIcon className="w-5 h-5 text-brand-secondary" />
                        {t('dashboard_recentTrips')}
                    </h3>
                    <div className="space-y-3 overflow-y-auto custom-scrollbar flex-grow pr-1">
                        {recentTrips.length > 0 ? recentTrips.map(trip => (
                            <div key={trip.id} onClick={() => setViewingTrip(trip)} className="group flex items-center p-3 rounded-smooth hover:bg-white/5 cursor-pointer transition-all duration-200 border border-transparent hover:border-white/5">
                                <div className="flex-shrink-0 mr-3">
                                    <div className={`p-2 rounded-lg shadow-inner ${trip.specialOrigin === 'HOME' ? 'bg-brand-primary/20 text-brand-primary' : 'bg-brand-secondary/20 text-brand-secondary'}`}>
                                        {trip.specialOrigin === 'HOME' ? <ListIcon className="w-5 h-5" /> : <FolderIcon className="w-5 h-5" />}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-semibold text-sm truncate text-white group-hover:text-brand-primary transition-colors">{getProjectName(trip.projectId)}</p>
                                    <p className="text-xs text-on-surface-secondary">{formatDateForDisplay(trip.date)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-white text-sm">{trip.distance.toFixed(1)} km</p>
                                </div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-40 text-on-surface-secondary opacity-60">
                                <ListIcon className="w-12 h-12 mb-2" />
                                <p className="text-sm">{t('dashboard_noRecentTrips')}</p>
                            </div>
                        )}
                    </div>
                    {recentTrips.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <Button variant="ghost" className="w-full justify-center text-sm" onClick={() => setCurrentView('trips')}>
                                {t('dashboard_viewAllTrips')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {viewingTrip && (
                <TripDetailModal
                    trip={viewingTrip}
                    project={projects.find(p => p.id === viewingTrip.projectId)}
                    onClose={() => setViewingTrip(null)}
                    personalization={personalization}
                    theme={theme}
                />
            )}

            <VehicleSettingsModal
                isOpen={isVehicleSettingsOpen}
                onClose={() => setIsVehicleSettingsOpen(false)}
                personalization={personalization}
            />
        </div>
    );
};

export default Dashboard;
