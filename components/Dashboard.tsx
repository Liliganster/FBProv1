import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import useTrips from '../hooks/useTrips';
import { BarChartIcon, BellIcon, Co2EmissionIcon, ListIcon, FolderIcon } from './Icons';
import useTranslation from '../hooks/useTranslation';
import useUserProfile from '../hooks/useUserProfile';
import { Trip, View, PersonalizationSettings } from '../types';
import TripDetailModal from './TripDetailModal';

import useDashboardSettings from '../hooks/useDashboardSettings';
import { formatDateForDisplay } from '../i18n/translations';

type ChartType = 'projectKm';

interface DashboardProps {
    setCurrentView: (view: View) => void;
    personalization: PersonalizationSettings;
    theme: 'light' | 'dark';
}

const Dashboard: React.FC<DashboardProps> = ({ setCurrentView, personalization, theme }) => {
    const { trips, projects } = useTrips();
    const { userProfile } = useUserProfile();
    const { visibleProjectIds, hasSettings } = useDashboardSettings();
    const [chartType, setChartType] = useState<ChartType>('projectKm');
    const [viewingTrip, setViewingTrip] = useState<Trip | null>(null);
    const [isAlertsOpen, setIsAlertsOpen] = useState(false);
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
          if (!trip.reason?.trim()) {
            allAlerts.push({ trip, type: 'missing_reason', message: t('dashboard_alert_missing_reason') });
          }
          if (trip.distance > 1000) {
            allAlerts.push({ trip, type: 'improbable_distance', message: t('dashboard_alert_improbable_distance') });
          }
          if (trip.distance === 0) {
            allAlerts.push({ trip, type: 'zero_distance', message: t('dashboard_alert_zero_distance') });
          }
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
    
    const PIE_COLORS = ['#007aff', '#34c759', '#ff9500', '#ff3b30', '#5856d6', '#5ac8fa'];
    
    const contentStyle = theme === 'dark' 
        ? {
            backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
            backdropFilter: `blur(${personalization.uiBlur}px)`,
            WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
          }
        : {
            backgroundColor: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(14px) saturate(160%)',
            WebkitBackdropFilter: 'blur(14px) saturate(160%)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          };

const StatCard = ({ title, value, cta, onClick, children }: { title: string, value: string, cta?: string, onClick?: () => void, children?: React.ReactNode }) => (
    <div style={contentStyle} className="bg-frost-glass border-glass rounded-fluid p-6 flex flex-col justify-between min-h-[140px] transition-all duration-300 hover:transform hover:translate-y-[-2px] hover:shadow-glass backdrop-blur-glass">
            <div>
                <div className="flex items-start justify-between">
                    <h3 className="text-sm font-medium text-on-surface-secondary uppercase tracking-wider">{title}</h3>
                    {children && !cta && <div className="text-right">{children}</div>}
                </div>
                <p className="text-3xl font-bold mt-2 text-white">{value}</p>
            </div>
            <div className="flex-grow flex flex-col justify-end">
                {children && cta && <div className="mt-4">{children}</div>}
                {cta && onClick && (
                    <button onClick={onClick} className="text-sm text-brand-primary hover:text-white transition-colors duration-200 mt-2 block text-left">
                        {cta}
                    </button>
                )}
            </div>
        </div>
    );
    
    const renderChart = () => {
        return <Bar dataKey="km" fill="url(#brandGradient)" name={t('dashboard_tooltip_kms')} />;
    };
    
    const chartData = kmByProject;

    return (
        <div className="text-on-surface-dark">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-title bg-clip-text text-transparent">{t('dashboard_title')}</h1>
                    {userProfile && <h2 className="text-lg font-semibold text-brand-primary">{userProfile.name}</h2>}
                </div>
                <div className="relative" ref={alertsRef}>
                    <button onClick={() => setIsAlertsOpen(!isAlertsOpen)} className="relative p-2 rounded-smooth hover:bg-gradient-surface transition-all duration-200">
                        <BellIcon className="w-6 h-6 text-on-surface-secondary"/>
                        {alerts.length > 0 && <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-600 border-2 border-surface-dark animate-pulse"></span>}
                    </button>
                    {isAlertsOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-frost-glass border-glass rounded-gentle shadow-glass z-20 backdrop-blur-glass">
                            <div className="p-3 font-semibold border-b border-glass text-white">{t('dashboard_proactive_alerts_title')}</div>
                            <div className="max-h-80 overflow-y-auto">
                                {alerts.length > 0 ? (
                                    alerts.slice(0, 10).map((alert, index) => (
                                        <div key={index} className="p-3 border-b border-glass hover:bg-gradient-surface transition-colors duration-200">
                                            <p className="text-sm text-on-surface-medium">{alert.message}</p>
                                            <button onClick={() => { setViewingTrip(alert.trip); setIsAlertsOpen(false); }} className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors duration-200 mt-1 cursor-pointer underline">{t('dashboard_alert_view_trip_cta')}</button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="p-4 text-sm text-on-surface-secondary">{t('dashboard_alert_no_alerts')}</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard title={t('dashboard_totalKm')} value={`${totalKm.toFixed(1)} km`} cta={t('dashboard_viewAllTrips')} onClick={() => setCurrentView('trips')} />
                <StatCard title={t('dashboard_activeProjects')} value={activeProjectsCount.toString()} cta={t('dashboard_manageProjects')} onClick={() => setCurrentView('projects')} />
                {hasCO2Settings ? (
                    <StatCard title={t('dashboard_total_co2')} value={`${totalCo2.toFixed(1)} kg`} />
                ) : (
                    <div style={contentStyle} className="bg-frost-glass border-glass rounded-fluid p-6 backdrop-blur-glass">
                        <h4 className="text-sm font-medium text-on-surface-secondary mb-2">{t('dashboard_total_co2')}</h4>
                        <p className="text-xs text-on-surface-secondary mb-3">{t('co2_settings_required_notice')}</p>
                        <button 
                            onClick={() => setCurrentView('advanced')}
                            className="text-xs text-brand-primary hover:text-brand-secondary transition-colors duration-200 underline"
                        >
                            {t('settings_vehicle_title')}
                        </button>
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div style={contentStyle} className="lg:col-span-2 bg-frost-glass border-glass rounded-fluid p-6 backdrop-blur-glass">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-white">{t('dashboard_visualAnalysis')}</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                            <defs>
                                <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#007aff" />
                                    <stop offset="100%" stopColor="#5856d6" />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                            <XAxis dataKey="name" stroke="#a3a3a3" />
                            <YAxis stroke="#a3a3a3" />
                            <Legend />
                            {renderChart()}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div style={contentStyle} className="bg-frost-glass border-glass rounded-fluid p-6 backdrop-blur-glass">
                    <h3 className="text-lg font-semibold mb-4 text-white">{t('dashboard_recentTrips')}</h3>
                    <div className="space-y-3">
                        {recentTrips.length > 0 ? recentTrips.map(trip => (
                             <div key={trip.id} onClick={() => setViewingTrip(trip)} className="flex items-center p-3 rounded-smooth hover:bg-gradient-surface cursor-pointer transition-all duration-200 hover:shadow-glass">
                                <div className="flex-shrink-0 mr-3">
                                    <div className={`p-2 rounded-smooth ${trip.specialOrigin === 'HOME' ? 'bg-brand-primary/20' : 'bg-brand-secondary/20'}`}>
                                       {trip.specialOrigin === 'HOME' ? <ListIcon className="w-5 h-5 text-brand-primary"/> : <FolderIcon className="w-5 h-5 text-brand-secondary"/>}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-semibold text-sm truncate text-white">{getProjectName(trip.projectId)}</p>
                                    <p className="text-xs text-on-surface-secondary">{formatDateForDisplay(trip.date)}</p>
                                </div>
                                <p className="font-bold text-brand-primary">{trip.distance.toFixed(1)} km</p>
                            </div>
                        )) : (
                            <p className="text-sm text-on-surface-secondary">{t('dashboard_noRecentTrips')}</p>
                        )}
                    </div>
                </div>
            </div>

            {viewingTrip && (
                <TripDetailModal 
                    trip={viewingTrip}
                    project={projects.find(p => p.id === viewingTrip.projectId)}
                    onClose={() => setViewingTrip(null)}
                />
            )}
        </div>
    );
};

const ChartButton: React.FC<{ type: ChartType, label: string, icon: React.ReactNode, current: ChartType, setType: (type: ChartType) => void }> = ({ type, label, icon, current, setType }) => (
    <button
        onClick={() => setType(type)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-smooth transition-all duration-200 ${
            current === type
                ? 'bg-gradient-brand text-white shadow-brand'
                : 'text-on-surface-secondary hover:bg-gradient-surface hover:text-white'
        }`}
    >
        {icon}
        {label}
    </button>
);

export default Dashboard;
