import React, { useState, useRef, useMemo, useEffect } from 'react';
import RouteTemplatesView from './RouteTemplatesView';
import CO2RankingView from './CO2RankingView';
import useTranslation from '../hooks/useTranslation';
import useToast from '../hooks/useToast';
import useUserProfile from '../hooks/useUserProfile';
import useTrips from '../hooks/useTrips';
import useReports from '../hooks/useReports';
import { useAuth } from '../hooks/useAuth';
import { DownloadIcon, UploadIcon, CheckCircleIcon, XCircleIcon, AlertTriangleIcon, ShieldCheckIcon, DollarSign, SaveIcon, ArrowLeftIcon, Route, TreePine, X } from 'lucide-react';
import { Trip, PersonalizationSettings, UserProfile } from '../types';
import { formatDateForDisplay } from '../i18n/translations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

type AuditResult = {
    ok: boolean;
    errors: { trip: Trip, reason: string }[];
} | null;

type ViewMode = 'main' | 'costAnalysis' | 'costSettings' | 'routeTemplates' | 'co2Ranking' | 'co2Settings';

interface AdvancedViewProps {
    personalization: PersonalizationSettings;
    theme: 'light' | 'dark';
}

const CostAnalysisDashboard: React.FC<{
    setViewMode: (mode: ViewMode) => void;
    personalization: PersonalizationSettings;
    theme: 'light' | 'dark';
}> = ({ setViewMode, personalization, theme }) => {
    const { t, language } = useTranslation();
    const { userProfile, setUserProfile } = useUserProfile();
    const { showToast } = useToast();
    const { projects } = useTrips();
    const { trips } = useTrips();
    const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | 'all'>('3m');
    const [costView, setCostView] = useState<'summary' | 'monthly'>('summary');
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [vehicleForm, setVehicleForm] = useState<UserProfile | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    // Inicializar el formulario cuando se abre el modal
    useEffect(() => {
        if (showVehicleModal && userProfile) {
            setVehicleForm({ ...userProfile });
        }
    }, [showVehicleModal, userProfile]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(value);
    };

    const handleVehicleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!vehicleForm) return;
        const { name, value } = e.target;
        const type = 'type' in e.target ? e.target.type : 'text';
        const finalValue = type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value;
        
        setVehicleForm(prev => {
            if (!prev) return null;
            return { ...prev, [name]: finalValue as any };
        });
    };

    const handleSaveVehicleSettings = () => {
        if (vehicleForm) {
            setUserProfile(vehicleForm);
            showToast(t('settings_alert_saveSuccess'), 'success');
            setShowVehicleModal(false);
        }
    };

    const filteredTrips = useMemo(() => {
        const now = new Date();
        let startDate = new Date(0);

        switch(timeRange) {
            case '3m':
                startDate = new Date(new Date().setMonth(now.getMonth() - 3));
                break;
            case '6m':
                startDate = new Date(new Date().setMonth(now.getMonth() - 6));
                break;
            case '1y':
                startDate = new Date(new Date().setFullYear(now.getFullYear() - 1));
                break;
            case 'all':
            default:
                break;
        }

        return trips.filter(trip => new Date(trip.date) >= startDate);
    }, [timeRange, trips]);

    const costData = useMemo(() => {
        if (!userProfile) return null;
        
        const totalKm = filteredTrips.reduce((sum, trip) => sum + trip.distance, 0);
        const totalTrips = filteredTrips.length;

        let costFuelEnergy = 0;
        if (userProfile.vehicleType === 'combustion' && userProfile.fuelConsumption && userProfile.fuelPrice) {
            costFuelEnergy = totalKm * (userProfile.fuelConsumption / 100) * userProfile.fuelPrice;
        } else if (userProfile.vehicleType === 'electric' && userProfile.energyConsumption && userProfile.energyPrice) {
            costFuelEnergy = totalKm * (userProfile.energyConsumption / 100) * userProfile.energyPrice;
        }
        
    // Ajuste: los costos siguientes ahora se interpretan como montos totales ingresados por el usuario
    // en lugar de tarifas por kilómetro. Se usan directamente sin multiplicar por distancia.
    const costMaintenance = (userProfile.maintenanceCostPerKm ?? 0);
    const costParking = (userProfile.parkingCostPerKm ?? 0);
    const costTolls = (userProfile.tollsCostPerKm ?? 0);
    const costFines = (userProfile.finesCostPerKm ?? 0);
    const costMisc = (userProfile.miscCostPerKm ?? 0);

        const totalCost = costFuelEnergy + costMaintenance + costParking + costTolls + costFines + costMisc;

        return {
            totalKm,
            totalTrips,
            totalCost,
            avgCostPerKm: totalKm > 0 ? totalCost / totalKm : 0,
        };
    }, [userProfile, filteredTrips]);
    
    const monthlyChartData = useMemo(() => {
        if (!costData || !userProfile) return [];

        const costsByMonth: { [key: string]: number } = {};

        filteredTrips.forEach(trip => {
            const monthYear = new Date(trip.date).toLocaleDateString(language, { year: '2-digit', month: 'short' });
            
            let tripCost = 0;
            if (userProfile.vehicleType === 'combustion' && userProfile.fuelConsumption && userProfile.fuelPrice) {
                tripCost += trip.distance * (userProfile.fuelConsumption / 100) * userProfile.fuelPrice;
            } else if (userProfile.vehicleType === 'electric' && userProfile.energyConsumption && userProfile.energyPrice) {
                tripCost += trip.distance * (userProfile.energyConsumption / 100) * userProfile.energyPrice;
            }
            // Antes: sumaba (tarifa por km * distancia). Ahora se añade el valor fijo definido por el usuario por cada viaje.
            tripCost += (userProfile.maintenanceCostPerKm ?? 0)
                + (userProfile.parkingCostPerKm ?? 0)
                + (userProfile.tollsCostPerKm ?? 0)
                + (userProfile.finesCostPerKm ?? 0)
                + (userProfile.miscCostPerKm ?? 0);
            
            costsByMonth[monthYear] = (costsByMonth[monthYear] || 0) + tripCost;
        });
        
        const sortedKeys = Object.keys(costsByMonth).sort((a, b) => {
            const [m1, y1] = a.split(/[\s'./-]+/);
            const [m2, y2] = b.split(/[\s'./-]+/);
            const dateA = new Date(`01 ${m1} ${y1}`);
            const dateB = new Date(`01 ${m2} ${y2}`);
            return dateA.getTime() - dateB.getTime();
        });
        
        return sortedKeys.map(key => ({
            name: key,
            cost: parseFloat(costsByMonth[key].toFixed(2)),
        }));

    }, [costData, userProfile, filteredTrips, language]);

    // Lista de proyectos únicos para el selector
    const availableProjects = useMemo(() => {
        const projectIds = [...new Set(filteredTrips.map(trip => trip.projectId).filter(Boolean))];
        const projectList = projectIds.map(id => projects.find(p => p.id === id)).filter(Boolean) as any[];
        
        // Verificar si hay viajes sin proyecto
        const hasUnassignedTrips = filteredTrips.some(trip => !trip.projectId);
        if (hasUnassignedTrips) {
            projectList.push({ id: 'unassigned', name: 'Sin Proyecto' });
        }
        
        return projectList.sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredTrips, projects]);

    const projectChartData = useMemo(() => {
        if (!costData || !userProfile) return [];

        const costsByProject: { [key: string]: {
            name: string;
            cost: number;
            distance: number;
            trips: number;
        } } = {};

        // Filtrar viajes por proyecto seleccionado si hay uno
        const tripsToAnalyze = selectedProjectId 
            ? filteredTrips.filter(trip => {
                if (selectedProjectId === 'unassigned') {
                    return !trip.projectId;
                }
                return trip.projectId === selectedProjectId;
            })
            : filteredTrips;

        tripsToAnalyze.forEach(trip => {
            const project = projects.find(p => p.id === trip.projectId);
            const projectName = project?.name || 'Sin Proyecto';
            
            if (!costsByProject[projectName]) {
                costsByProject[projectName] = { 
                    name: projectName, 
                    cost: 0, 
                    distance: 0, 
                    trips: 0 
                };
            }
            
            let tripCost = 0;
            if (userProfile.vehicleType === 'combustion' && userProfile.fuelConsumption && userProfile.fuelPrice) {
                tripCost += trip.distance * (userProfile.fuelConsumption / 100) * userProfile.fuelPrice;
            } else if (userProfile.vehicleType === 'electric' && userProfile.energyConsumption && userProfile.energyPrice) {
                tripCost += trip.distance * (userProfile.energyConsumption / 100) * userProfile.energyPrice;
            }
            tripCost += (userProfile.maintenanceCostPerKm ?? 0)
                + (userProfile.parkingCostPerKm ?? 0)
                + (userProfile.tollsCostPerKm ?? 0)
                + (userProfile.finesCostPerKm ?? 0)
                + (userProfile.miscCostPerKm ?? 0);
            
            costsByProject[projectName].cost += tripCost;
            costsByProject[projectName].distance += trip.distance;
            costsByProject[projectName].trips += 1;
        });

        return Object.values(costsByProject)
            .sort((a, b) => b.cost - a.cost)
            .map(project => ({
                ...project,
                cost: parseFloat(project.cost.toFixed(2)),
            }));

    }, [costData, userProfile, filteredTrips, projects, selectedProjectId]);

    const monthlyTableData = useMemo(() => {
        if (!costData || !userProfile) return [];

        const costsByMonth: { [key: string]: {
            date: Date;
            distance: number;
            trips: number;
            fuel: number;
            maintenance: number;
            other: number;
            total: number;
        } } = {};

        filteredTrips.forEach(trip => {
            const tripDate = new Date(trip.date);
            const monthYearKey = `${tripDate.getFullYear()}-${String(tripDate.getMonth()).padStart(2, '0')}`;
            
            if (!costsByMonth[monthYearKey]) {
                costsByMonth[monthYearKey] = { date: new Date(tripDate.getFullYear(), tripDate.getMonth(), 1), distance: 0, trips: 0, fuel: 0, maintenance: 0, other: 0, total: 0 };
            }

            let tripFuelCost = 0;
            if (userProfile.vehicleType === 'combustion' && userProfile.fuelConsumption && userProfile.fuelPrice) {
                tripFuelCost = trip.distance * (userProfile.fuelConsumption / 100) * userProfile.fuelPrice;
            } else if (userProfile.vehicleType === 'electric' && userProfile.energyConsumption && userProfile.energyPrice) {
                tripFuelCost = trip.distance * (userProfile.energyConsumption / 100) * userProfile.energyPrice;
            }
            const tripMaintenanceCost = (userProfile.maintenanceCostPerKm ?? 0);
            const tripOtherCost = (
                (userProfile.parkingCostPerKm ?? 0) +
                (userProfile.tollsCostPerKm ?? 0) +
                (userProfile.finesCostPerKm ?? 0) +
                (userProfile.miscCostPerKm ?? 0)
            );
            const tripTotalCost = tripFuelCost + tripMaintenanceCost + tripOtherCost;

            costsByMonth[monthYearKey].distance += trip.distance;
            costsByMonth[monthYearKey].trips += 1;
            costsByMonth[monthYearKey].fuel += tripFuelCost;
            costsByMonth[monthYearKey].maintenance += tripMaintenanceCost;
            costsByMonth[monthYearKey].other += tripOtherCost;
            costsByMonth[monthYearKey].total += tripTotalCost;
        });

        return Object.values(costsByMonth)
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .map(monthData => ({
                month: monthData.date.toLocaleDateString(language, { year: 'numeric', month: 'long' }),
                distance: monthData.distance,
                trips: monthData.trips,
                fuel: monthData.fuel,
                maintenance: monthData.maintenance,
                other: monthData.other,
                total: monthData.total,
                avg_cost_km: monthData.distance > 0 ? monthData.total / monthData.distance : 0,
            }));

    }, [costData, userProfile, filteredTrips, language]);


    const dashboardStyle = {
      backgroundColor: theme === 'dark'
          ? `rgba(18, 18, 18, ${1 - personalization.uiTransparency})`
          : `rgba(229, 231, 235, ${1 - personalization.uiTransparency})`,
      backdropFilter: `blur(${personalization.uiBlur}px)`,
    };
    
    const cardStyle = {
      backgroundColor: theme === 'dark'
          ? `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`
          : `rgba(243, 244, 246, ${1 - personalization.uiTransparency})`,
      backdropFilter: `blur(${personalization.uiBlur}px)`,
    };

    return (
        <div style={dashboardStyle} className="p-8 rounded-lg -m-8">
            <header className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                     <button onClick={() => setViewMode('main')} className="flex items-center bg-gray-700 hover:bg-gray-600 text-white font-bold p-3 rounded-lg">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t('cost_analysis_title')}</h1>
                        <p className="text-sm text-on-surface-dark-secondary">{t('cost_analysis_description_personal')}</p>
                    </div>
                </div>
                 <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)} className="bg-surface-dark border border-gray-600 rounded-lg py-2 px-4 focus:ring-2 focus:ring-brand-primary focus:outline-none text-on-surface-dark">
                    <option value="3m">{t('cost_analysis_time_range_3m')}</option>
                    <option value="6m">{t('cost_analysis_time_range_6m')}</option>
                    <option value="1y">{t('cost_analysis_time_range_1y')}</option>
                    <option value="all">{t('cost_analysis_time_range_all')}</option>
                </select>
            </header>
            
            <main>
                {/* Tabs de navegación */}
                <div className="flex items-center gap-2 mb-6">
                    <button 
                        onClick={() => setCostView('summary')} 
                        className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                            costView === 'summary' 
                                ? 'bg-brand-primary text-white' 
                                : 'bg-surface-dark text-on-surface-dark-secondary hover:bg-gray-700/50'
                        }`}
                    >
                        {t('cost_analysis_summary_tab')}
                    </button>
                    <button 
                        onClick={() => setCostView('monthly')} 
                        className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                            costView === 'monthly' 
                                ? 'bg-brand-primary text-white' 
                                : 'bg-surface-dark text-on-surface-dark-secondary hover:bg-gray-700/50'
                        }`}
                    >
                        {t('cost_view_monthly')}
                    </button>
                </div>
                
                {/* Tarjetas de métricas principales */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard title={t('cost_total_distance')} value={`${(costData?.totalKm || 0).toFixed(1)} km`} />
                    <StatCard title={t('cost_total_trips')} value={(costData?.totalTrips || 0).toString()} />
                    <StatCard title={t('cost_est_total')} value={formatCurrency(costData?.totalCost || 0)} />
                    <StatCard title={t('cost_avg_cost_km')} value={formatCurrency(costData?.avgCostPerKm || 0)} />
                </div>

                {/* Contenido condicional según el tab seleccionado */}
                {costView === 'summary' ? (
                    // Vista de Resumen con barras de progreso
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Desglose de costos con barras de progreso */}
                        <div style={cardStyle} className="p-6 rounded-lg">
                            <h3 className="text-lg font-semibold mb-6 text-white">{t('cost_basic_breakdown')}</h3>
                            
                            <div className="space-y-4">
                                {(() => {
                                    if (!costData || !userProfile) return null;
                                    
                                    const fuelCost = userProfile.vehicleType === 'combustion' && userProfile.fuelConsumption && userProfile.fuelPrice
                                        ? costData.totalKm * (userProfile.fuelConsumption / 100) * userProfile.fuelPrice
                                        : userProfile.vehicleType === 'electric' && userProfile.energyConsumption && userProfile.energyPrice
                                        ? costData.totalKm * (userProfile.energyConsumption / 100) * userProfile.energyPrice
                                        : 0;
                                        
                                    const maintenanceCost = (userProfile.maintenanceCostPerKm || 0);
                                    const otherCost = ((userProfile.parkingCostPerKm || 0) + (userProfile.tollsCostPerKm || 0) + (userProfile.finesCostPerKm || 0) + (userProfile.miscCostPerKm || 0));
                                    const avgTripCost = costData.totalTrips > 0 ? costData.totalCost / costData.totalTrips : 0;
                                    
                                    return (
                                        <>
                                            <CostProgressBar 
                                                label={t('cost_fuel')} 
                                                amount={fuelCost}
                                                percentage={costData.totalCost > 0 ? (fuelCost / costData.totalCost) * 100 : 0}
                                                color="bg-red-500"
                                                formatCurrency={formatCurrency}
                                            />
                                            
                                            <CostProgressBar 
                                                label={t('cost_maintenance')} 
                                                amount={maintenanceCost}
                                                percentage={costData.totalCost > 0 ? (maintenanceCost / costData.totalCost) * 100 : 0}
                                                color="bg-blue-500"
                                                formatCurrency={formatCurrency}
                                            />
                                            
                                            <CostProgressBar 
                                                label={t('cost_other')} 
                                                amount={otherCost}
                                                percentage={costData.totalCost > 0 ? (otherCost / costData.totalCost) * 100 : 0}
                                                color="bg-purple-500"
                                                formatCurrency={formatCurrency}
                                            />
                                            
                                            <CostProgressBar 
                                                label={t('cost_avg_trip')} 
                                                amount={avgTripCost}
                                                percentage={100}
                                                color="bg-green-500"
                                                formatCurrency={formatCurrency}
                                            />
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Supuestos de costos */}
                        <div style={cardStyle} className="p-6 rounded-lg">
                            <h3 className="text-lg font-semibold mb-6 text-white">{t('cost_assumptions')}</h3>
                            
                            <div className="space-y-3">
                                {userProfile && (
                                    <>
                                        <div className="flex items-center text-sm text-gray-300">
                                            <span className="w-2 h-2 bg-gray-400 rounded-full mr-3"></span>
                                            <span>Fuel: €{(
                                                userProfile.vehicleType === 'combustion' && userProfile.fuelConsumption && userProfile.fuelPrice
                                                    ? (userProfile.fuelConsumption * userProfile.fuelPrice / 100).toFixed(2)
                                                    : userProfile.vehicleType === 'electric' && userProfile.energyConsumption && userProfile.energyPrice
                                                    ? (userProfile.energyConsumption * userProfile.energyPrice / 100).toFixed(2)
                                                    : '0.00'
                                            )}/km</span>
                                        </div>
                                        <div className="flex items-center text-sm text-gray-300">
                                            <span className="w-2 h-2 bg-gray-400 rounded-full mr-3"></span>
                                            <span>Maintenance (total): €{(userProfile.maintenanceCostPerKm || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center text-sm text-gray-300">
                                            <span className="w-2 h-2 bg-gray-400 rounded-full mr-3"></span>
                                            <span>Other (total): €{((userProfile.parkingCostPerKm || 0) + (userProfile.tollsCostPerKm || 0) + (userProfile.finesCostPerKm || 0) + (userProfile.miscCostPerKm || 0)).toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center text-sm text-gray-300 mt-4">
                                            <span className="w-2 h-2 bg-gray-400 rounded-full mr-3"></span>
                                            <span>
                                                {t('cost_note_personal')}{' '}
                                                <button 
                                                    onClick={() => setShowVehicleModal(true)}
                                                    className="text-brand-primary hover:text-blue-300 underline cursor-pointer"
                                                >
                                                    {t('cost_note_personal_cta')}
                                                </button>
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Vista Mensual con tabla
                    <div style={cardStyle} className="p-6 rounded-lg">
                        <h3 className="text-lg font-semibold mb-4 text-white">{t('cost_monthly_summary')}</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-700/50">
                                    <tr>
                                        <th className="p-3 font-semibold uppercase tracking-wider">{t('cost_month')}</th>
                                        <th className="p-3 font-semibold uppercase tracking-wider text-right">{t('cost_distance')}</th>
                                        <th className="p-3 font-semibold uppercase tracking-wider text-right">{t('nav_trips')}</th>
                                        <th className="p-3 font-semibold uppercase tracking-wider text-right">{t('cost_fuel')}</th>
                                        <th className="p-3 font-semibold uppercase tracking-wider text-right">{t('cost_maintenance')}</th>
                                        <th className="p-3 font-semibold uppercase tracking-wider text-right">{t('cost_other')}</th>
                                        <th className="p-3 font-semibold uppercase tracking-wider text-right">{t('cost_total')}</th>
                                        <th className="p-3 font-semibold uppercase tracking-wider text-right">{t('cost_avg_cost_km')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/50">
                                    {monthlyTableData.map(row => (
                                        <tr key={row.month} className="hover:bg-gray-800/40">
                                            <td className="p-3 font-semibold">{row.month}</td>
                                            <td className="p-3 text-right">{row.distance.toFixed(1)} km</td>
                                            <td className="p-3 text-right">{row.trips}</td>
                                            <td className="p-3 text-right">{formatCurrency(row.fuel)}</td>
                                            <td className="p-3 text-right">{formatCurrency(row.maintenance)}</td>
                                            <td className="p-3 text-right">{formatCurrency(row.other)}</td>
                                            <td className="p-3 text-right font-bold text-brand-primary">{formatCurrency(row.total)}</td>
                                            <td className="p-3 text-right">{formatCurrency(row.avg_cost_km)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Análisis por Proyecto - solo en vista Resumen */}
                {costView === 'summary' && (
                    <div style={cardStyle} className="p-6 rounded-lg mt-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-white">{t('cost_project_analysis_title')}</h3>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-300">{t('cost_project_selector_label')}</label>
                                <select
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                    className="bg-surface-dark border border-gray-600 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none text-on-surface-dark min-w-[200px]"
                                >
                                    <option value="">{t('cost_project_selector_all')}</option>
                                    {availableProjects.map(project => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {projectChartData.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Gráfico más pequeño */}
                                <div>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={projectChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
                                            <XAxis 
                                                dataKey="name" 
                                                stroke="#a0a0a0" 
                                                tick={{fontSize: 10}} 
                                                angle={-45}
                                                textAnchor="end"
                                                height={70}
                                            />
                                            <YAxis 
                                                stroke="#a0a0a0" 
                                                tickFormatter={(value) => formatCurrency(value)} 
                                                tick={{fontSize: 10}} 
                                            />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: '#1e1e1e', 
                                                    border: '1px solid #4a4a4a',
                                                    borderRadius: '8px'
                                                }}
                                                formatter={(value: number, name: string) => {
                                                    if (name === 'cost') return [formatCurrency(value), 'Costo Total'];
                                                    return [value, name];
                                                }}
                                                labelFormatter={(label) => `${t('cost_project_selector_label')} ${label}`}
                                            />
                                            <Bar 
                                                dataKey="cost" 
                                                fill="#007aff" 
                                                name="Costo Total"
                                                radius={[4, 4, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                
                                {/* Tabla a la derecha del gráfico */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-700/50">
                                            <tr>
                                                <th className="p-2 font-semibold uppercase tracking-wider text-xs">Proyecto</th>
                                                <th className="p-2 font-semibold uppercase tracking-wider text-right text-xs">Dist.</th>
                                                <th className="p-2 font-semibold uppercase tracking-wider text-right text-xs">Viajes</th>
                                                <th className="p-2 font-semibold uppercase tracking-wider text-right text-xs">Total</th>
                                                <th className="p-2 font-semibold uppercase tracking-wider text-right text-xs">€/km</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700/50">
                                            {projectChartData.map((project, index) => (
                                                <tr key={project.name} className="hover:bg-gray-800/40">
                                                    <td className="p-2 font-medium text-xs" title={project.name}>
                                                        {project.name.length > 12 ? project.name.substring(0, 12) + '...' : project.name}
                                                    </td>
                                                    <td className="p-2 text-right text-xs">{project.distance.toFixed(0)} km</td>
                                                    <td className="p-2 text-right text-xs">{project.trips}</td>
                                                    <td className="p-2 text-right font-bold text-brand-primary text-xs">{formatCurrency(project.cost)}</td>
                                                    <td className="p-2 text-right text-xs">{formatCurrency(project.distance > 0 ? project.cost / project.distance : 0)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400">
                                <p>{t('cost_project_no_data')}</p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Modal de Configuración de Vehículo */}
            {showVehicleModal && vehicleForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div 
                        style={{
                            backgroundColor: theme === 'dark'
                                ? `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`
                                : `rgba(243, 244, 246, ${1 - personalization.uiTransparency})`,
                            backdropFilter: `blur(${personalization.uiBlur}px)`,
                        }}
                        className="bg-background-dark rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-white">{t('settings_vehicle_title')}</h2>
                                <button
                                    onClick={() => setShowVehicleModal(false)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xl font-semibold text-white">{t('settings_vehicle_title')}</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Tipo de Vehículo */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            {t('settings_vehicle_type')}
                                        </label>
                                        <select
                                            name="vehicleType"
                                            value={vehicleForm.vehicleType || ''}
                                            onChange={handleVehicleFormChange}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
                                        >
                                            <option value="">{t('settings_vehicle_type_select')}</option>
                                            <option value="combustion">{t('settings_vehicle_type_combustion')}</option>
                                            <option value="electric">{t('settings_vehicle_type_electric')}</option>
                                        </select>
                                    </div>

                                    {/* Campos específicos para combustión */}
                                    {vehicleForm.vehicleType === 'combustion' && (
                                        <>
                                            <VehicleInputField
                                                label={t('settings_vehicle_fuel_consumption')}
                                                name="fuelConsumption"
                                                type="number"
                                                value={vehicleForm.fuelConsumption}
                                                onChange={handleVehicleFormChange}
                                                placeholder="l/100km"
                                            />
                                            <VehicleInputField
                                                label={t('settings_vehicle_fuel_price')}
                                                name="fuelPrice"
                                                type="number"
                                                value={vehicleForm.fuelPrice}
                                                onChange={handleVehicleFormChange}
                                                placeholder="€/l"
                                            />
                                        </>
                                    )}

                                    {/* Campos específicos para eléctrico */}
                                    {vehicleForm.vehicleType === 'electric' && (
                                        <>
                                            <VehicleInputField
                                                label={t('settings_vehicle_energy_consumption')}
                                                name="energyConsumption"
                                                type="number"
                                                value={vehicleForm.energyConsumption}
                                                onChange={handleVehicleFormChange}
                                                placeholder="kWh/100km"
                                            />
                                            <VehicleInputField
                                                label={t('settings_vehicle_energy_price')}
                                                name="energyPrice"
                                                type="number"
                                                value={vehicleForm.energyPrice}
                                                onChange={handleVehicleFormChange}
                                                placeholder="€/kWh"
                                            />
                                        </>
                                    )}
                                </div>

                                {/* Costos adicionales */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <VehicleInputField
                                        label={t('settings_vehicle_maintenance_cost')}
                                        name="maintenanceCostPerKm"
                                        type="number"
                                        value={vehicleForm.maintenanceCostPerKm}
                                        onChange={handleVehicleFormChange}
                                        placeholder="€/km"
                                    />
                                    <VehicleInputField
                                        label={t('settings_vehicle_parking_cost')}
                                        name="parkingCostPerKm"
                                        type="number"
                                        value={vehicleForm.parkingCostPerKm}
                                        onChange={handleVehicleFormChange}
                                        placeholder="€/km"
                                    />
                                    <VehicleInputField
                                        label={t('settings_vehicle_tolls_cost')}
                                        name="tollsCostPerKm"
                                        type="number"
                                        value={vehicleForm.tollsCostPerKm}
                                        onChange={handleVehicleFormChange}
                                        placeholder="€/km"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <VehicleInputField
                                        label={t('settings_vehicle_fines_cost')}
                                        name="finesCostPerKm"
                                        type="number"
                                        value={vehicleForm.finesCostPerKm}
                                        onChange={handleVehicleFormChange}
                                        placeholder="€/km"
                                    />
                                    <VehicleInputField
                                        label={t('settings_vehicle_misc_cost')}
                                        name="miscCostPerKm"
                                        type="number"
                                        value={vehicleForm.miscCostPerKm}
                                        onChange={handleVehicleFormChange}
                                        placeholder="€/km"
                                    />
                                </div>

                                {/* Botones */}
                                <div className="flex justify-end gap-4 pt-6 border-t border-gray-700">
                                    <button
                                        onClick={() => setShowVehicleModal(false)}
                                        className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                                    >
                                        {t('common_cancel')}
                                    </button>
                                    <button
                                        onClick={handleSaveVehicleSettings}
                                        className="px-6 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <SaveIcon size={16} />
                                        {t('advanced_costing_save_settings_btn')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string; }> = ({ title, value }) => (
    <div className="bg-background-dark p-4 rounded-lg">
        <h3 className="text-sm font-medium text-on-surface-dark-secondary">{title}</h3>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
);

const AdvancedView: React.FC<AdvancedViewProps> = ({ personalization, theme }) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { userProfile, setUserProfile } = useUserProfile();
    const { trips, projects, replaceAllTrips, replaceAllProjects, deleteAllData, verifyLedgerIntegrity } = useTrips();
    const { reports, setAllReports, deleteAllReports } = useReports();
    const { user, logout } = useAuth();
    const [auditResult, setAuditResult] = useState<AuditResult>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [costingProfile, setCostingProfile] = useState<UserProfile | null>(userProfile);
    const [viewMode, setViewMode] = useState<ViewMode>('main');


    useEffect(() => {
        setCostingProfile(userProfile);
    }, [userProfile]);

    const handleCostingProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!costingProfile) return;
        const { name, value } = e.target;
        const type = 'type' in e.target ? e.target.type : 'text';
        const finalValue = type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value;
        
        setCostingProfile(prev => {
            if (!prev) return null;
            return { ...prev, [name]: finalValue as any };
        });
    };

    const handleSaveCostingSettings = () => {
        if (costingProfile) {
            setUserProfile(costingProfile);
            showToast(t('settings_alert_saveSuccess'), 'success');
        }
    };
    
    const contentStyle = {
      backgroundColor: theme === 'dark'
          ? `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`
          : `rgba(243, 244, 246, ${1 - personalization.uiTransparency})`,
      backdropFilter: `blur(${personalization.uiBlur}px)`,
    };
    
    const dangerContentStyle = {
      backgroundColor: theme === 'dark'
          ? `rgba(127, 29, 29, ${1 - personalization.uiTransparency})` 
          : `rgba(254, 226, 226, ${1 - personalization.uiTransparency})`,
      backdropFilter: `blur(${personalization.uiBlur}px)`,
    };

    const handleExportData = () => {
        const dataToExport = {
            userProfile,
            trips,
            projects,
            reports,
            version: '1.0.0',
            exportDate: new Date().toISOString(),
        };
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fahrtenbuch-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error('File content is not readable text.');
                
                const data = JSON.parse(text);

                if (!data.userProfile || !Array.isArray(data.trips) || !Array.isArray(data.projects) || !Array.isArray(data.reports)) {
                    throw new Error('Invalid backup file structure.');
                }
                
                if (window.confirm(t('advanced_import_confirm'))) {
                    await replaceAllTrips(data.trips);
                    await replaceAllProjects(data.projects);
                    setUserProfile(data.userProfile);
                    setAllReports(data.reports);
                    showToast(t('advanced_import_success'), 'success');
                }
            } catch (error) {
                console.error("Import failed:", error);
                showToast(t('advanced_import_error'), 'error');
            } finally {
                if(event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleDeleteAllTrips = async () => {
        if (window.confirm(t('advanced_delete_all_trips_confirm'))) {
            await replaceAllTrips([]);
            showToast('All trips have been deleted.', 'success');
        }
    };
    
    const handleDeleteAllProjects = async () => {
        if (window.confirm(t('advanced_delete_all_projects_confirm'))) {
            await replaceAllProjects([]);
            showToast('All projects have been deleted.', 'success');
        }
    };

    const handleResetApp = async () => {
        if (window.confirm(t('advanced_reset_app_confirm'))) {
            await deleteAllData();
            deleteAllReports();
            setUserProfile(null);
             if(user) {
                Object.keys(localStorage).forEach(key => {
                    if (key.includes(user.id)) {
                        localStorage.removeItem(key);
                    }
                });
             }
            showToast('Application has been reset.', 'success');
            logout();
        }
    };

    const handleVerifyHashes = async () => {
        const result = await verifyLedgerIntegrity();
        setAuditResult({ 
            ok: result.isValid, 
            errors: result.errors.map(error => ({ 
                trip: {} as Trip, 
                reason: error 
            }))
        });
    };
    
    const Section: React.FC<{ title: string; isDanger?: boolean; children: React.ReactNode }> = ({ title, isDanger = false, children }) => (
        <div style={isDanger ? dangerContentStyle : contentStyle} className={`p-6 rounded-lg shadow-lg ${isDanger ? 'border border-red-500/30' : ''}`}>
            <h2 className={`text-xl font-semibold mb-4 border-b pb-2 ${isDanger ? 'text-red-300 border-red-500/30' : 'text-white border-gray-700'}`}>{title}</h2>
            {children}
        </div>
    );
    
    const renderCostSettingsView = () => (
        <div>
            <div className="flex items-center mb-8">
                <button onClick={() => setViewMode('costAnalysis')} className="flex items-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">
                    <ArrowLeftIcon className="w-5 h-5 mr-2" />
                    {t('common_back')}
                </button>
                <h1 className="text-3xl font-bold text-white ml-4">{t('settings_vehicle_title')}</h1>
            </div>
             <div className="space-y-8">
                <Section title={t('settings_vehicle_title')}>
                    {costingProfile ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label htmlFor="vehicleType" className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{t('settings_vehicle_type')}</label>
                                    <select id="vehicleType" name="vehicleType" value={costingProfile.vehicleType || ''} onChange={handleCostingProfileChange} className="w-full bg-background-dark border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none">
                                        <option value="">{t('settings_vehicle_type_select')}</option>
                                        <option value="combustion">{t('settings_vehicle_type_combustion')}</option>
                                        <option value="electric">{t('settings_vehicle_type_electric')}</option>
                                    </select>
                                </div>
                                {costingProfile.vehicleType === 'combustion' && (
                                    <>
                                        <InputField label={t('settings_vehicle_fuel_consumption')} name="fuelConsumption" type="number" value={costingProfile.fuelConsumption} onChange={handleCostingProfileChange} placeholder="L/100km"/>
                                        <InputField label={t('settings_vehicle_fuel_price')} name="fuelPrice" type="number" value={costingProfile.fuelPrice} onChange={handleCostingProfileChange} placeholder="€/L"/>
                                    </>
                                )}
                                {costingProfile.vehicleType === 'electric' && (
                                    <>
                                        <InputField label={t('settings_vehicle_energy_consumption')} name="energyConsumption" type="number" value={costingProfile.energyConsumption} onChange={handleCostingProfileChange} placeholder="kWh/100km"/>
                                        <InputField label={t('settings_vehicle_energy_price')} name="energyPrice" type="number" value={costingProfile.energyPrice} onChange={handleCostingProfileChange} placeholder="€/kWh"/>
                                    </>
                                )}
                                <div className="md:col-span-2"><hr className="border-gray-700/50 my-2"/></div>
                                <InputField label={t('settings_vehicle_maintenance_cost')} name="maintenanceCostPerKm" type="number" value={costingProfile.maintenanceCostPerKm} onChange={handleCostingProfileChange} placeholder="€/km"/>
                                <InputField label={t('settings_vehicle_parking_cost')} name="parkingCostPerKm" type="number" value={costingProfile.parkingCostPerKm} onChange={handleCostingProfileChange} placeholder="€/km"/>
                                <InputField label={t('settings_vehicle_tolls_cost')} name="tollsCostPerKm" type="number" value={costingProfile.tollsCostPerKm} onChange={handleCostingProfileChange} placeholder="€/km"/>
                                <InputField label={t('settings_vehicle_fines_cost')} name="finesCostPerKm" type="number" value={costingProfile.finesCostPerKm} onChange={handleCostingProfileChange} placeholder="€/km"/>
                                <InputField label={t('settings_vehicle_misc_cost')} name="miscCostPerKm" type="number" value={costingProfile.miscCostPerKm} onChange={handleCostingProfileChange} placeholder="€/km"/>
                            </div>
                            <div className="mt-6 flex justify-end">
                                <ActionButton icon={<SaveIcon size={20} />} onClick={handleSaveCostingSettings} color="blue">
                                    {t('advanced_costing_save_settings_btn')}
                                </ActionButton>
                            </div>
                        </>
                    ) : (
                        <p className="text-on-surface-dark-secondary">{t('dashboard_no_driver_selected_prompt')}</p>
                    )}
                </Section>
            </div>
        </div>
    );
    
    const renderMainView = () => (
         <div>
            <h1 className="text-3xl font-bold text-white mb-8">{t('advanced_title')}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ActionCard
                    title={t('advanced_route_templates_title')}
                    description={t('advanced_route_templates_desc')}
                    icon={<Route size={24} className="text-brand-secondary" />}
                    onClick={() => setViewMode('routeTemplates')}
                    theme={theme}
                    personalization={personalization}
                />
                
                <ActionCard
                    title={t('cost_analysis_title')}
                    description={t('cost_analysis_description_personal')}
                    icon={<DollarSign size={24} className="text-brand-secondary" />}
                    onClick={() => setViewMode('costAnalysis')}
                    theme={theme}
                    personalization={personalization}
                />
                
                <ActionCard
                    title={t('co2_ranking_title')}
                    description={t('co2_ranking_card_description')}
                    icon={<TreePine size={24} className="text-brand-secondary" />}
                    onClick={() => setViewMode('co2Ranking')}
                    theme={theme}
                    personalization={personalization}
                />
            </div>
        </div>
    );

    if (viewMode === 'costSettings') {
        return renderCostSettingsView();
    }
    if (viewMode === 'costAnalysis') {
        return <CostAnalysisDashboard setViewMode={setViewMode} personalization={personalization} theme={theme} />;
    } else if (viewMode === 'routeTemplates') {
        return <RouteTemplatesView onBack={() => setViewMode('main')} theme={theme} personalization={personalization} />;
    } else if (viewMode === 'co2Ranking') {
        return <CO2RankingView
            onBack={() => setViewMode('main')}
            theme={theme}
            personalization={personalization}
        />;
    }
    return renderMainView();
};

const InputField: React.FC<{label: string, name: string, value?: string | number, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void, type?: string, placeholder?: string, disabled?: boolean}> = ({ label, name, value, onChange, type = 'text', placeholder, disabled = false }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-on-surface-dark-secondary mb-1">{label}</label>
        <input 
            type={type} 
            id={name}
            name={name} 
            value={value ?? ''} 
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            step={type === 'number' ? '0.01' : undefined}
            className="w-full bg-background-dark border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
    </div>
);

const ActionButton: React.FC<{ icon: React.ReactNode; onClick: () => void; children: React.ReactNode, color: 'blue' | 'green' | 'red' | 'gray' }> = ({ icon, onClick, children, color }) => {
    const colors = {
        blue: 'bg-blue-600 hover:bg-blue-500 text-white',
        green: 'bg-green-600 hover:bg-green-500 text-white',
        red: 'bg-red-600 hover:bg-red-500 text-white',
        gray: 'bg-gray-600 hover:bg-gray-500 text-white',
    };
    return (
        <button
            onClick={onClick}
            className={`flex items-center justify-center gap-2 font-bold py-2 px-4 rounded-lg transition-colors ${colors[color]}`}
        >
            {icon}
            {children}
        </button>
    );
};

const ActionCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    theme: 'light' | 'dark';
    personalization: PersonalizationSettings;
}> = ({ title, description, icon, onClick, theme, personalization }) => {
    const cardStyle = {
      backgroundColor: theme === 'dark'
          ? `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`
          : `rgba(243, 244, 246, ${1 - personalization.uiTransparency})`,
      backdropFilter: `blur(${personalization.uiBlur}px)`,
    };
    
    return (
        <div 
            style={cardStyle} 
            className="p-6 rounded-lg shadow-lg flex items-center gap-6 cursor-pointer hover:ring-2 hover:ring-brand-primary transition-all duration-200"
            onClick={onClick}
        >
            <div className="flex-shrink-0">
                {icon}
            </div>
            <div>
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                <p className="text-on-surface-dark-secondary mt-1">{description}</p>
            </div>
        </div>
    );
};

const CostProgressBar: React.FC<{
    label: string;
    amount: number;
    percentage: number;
    color: string;
    formatCurrency: (value: number) => string;
}> = ({ label, amount, percentage, color, formatCurrency }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-300">{label}</span>
            <span className="text-sm font-semibold text-white">{formatCurrency(amount)}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
                className={`h-2 rounded-full ${color}`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
            />
        </div>
    </div>
);

const VehicleInputField: React.FC<{
    label: string;
    name: string;
    value?: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    placeholder?: string;
}> = ({ label, name, value, onChange, type = 'text', placeholder }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-2">
            {label}
        </label>
        <input 
            type={type} 
            id={name}
            name={name} 
            value={value ?? ''} 
            onChange={onChange}
            placeholder={placeholder}
            step={type === 'number' ? '0.01' : undefined}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-brand-primary focus:outline-none"
        />
    </div>
);

export default AdvancedView;