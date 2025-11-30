import React, { useState, useMemo, useEffect } from 'react';
import useTranslation from '../hooks/useTranslation';
import useTrips from '../hooks/useTrips';
import useUserProfile from '../hooks/useUserProfile';
import {
  calculateCO2Emissions,
  calculateCO2Efficiency,
  calculateFuelConsumption,
  calculateTreesNeeded,
  getCO2EfficiencyRating,
  CO2CalculationParams
} from '../services/co2Service';
import {
  ArrowLeftIcon,
  DownloadIcon,
  Co2EmissionIcon,
  GaugeIcon,
  FuelIcon,
  CheckCircleIcon,
  XCircleIcon,
  TreePineIcon,
  SettingsIcon
} from './Icons';
import CO2AnalysisSettings from './CO2AnalysisSettings';

interface CO2RankingViewProps {
  onBack: () => void;
  theme: 'light' | 'dark';
  personalization: any;
}

interface ProjectCO2Data {
  projectId: string;
  projectName: string;
  totalCO2: number;
  totalDistance: number;
  totalFuel: number;
  averageEfficiency: number;
  tripCount: number;
  efficiency: number;
  treesNeeded: number;
  efficiencyRating: ReturnType<typeof getCO2EfficiencyRating>;
}

const StatCard: React.FC<{
  title: string;
  value: string;
  icon?: React.ReactNode;
  color?: string;
  iconColor?: string;
}> = ({ title, value, icon, color = 'text-white', iconColor }) => (
  <div className="bg-frost-glass p-6 rounded-lg">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-on-surface-dark-secondary">{title}</h3>
        <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      </div>
      {icon && (
        <div className={`${iconColor || color}`}>
          {icon}
        </div>
      )}
    </div>
  </div>
);

const ProjectRow: React.FC<{
  project: ProjectCO2Data;
  rank: number;
  formatCurrency: (value: number) => string;
  t: (key: string) => string;
}> = ({ project, rank, formatCurrency, t }) => (
  <div className="bg-frost-glass p-6 rounded-lg">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
          rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
          rank === 2 ? 'bg-gray-400/20 text-gray-300' :
          rank === 3 ? 'bg-amber-600/20 text-amber-400' :
          'bg-background-light text-on-surface-dark-secondary'
        }`}>
          #{rank}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{project.projectName}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              project.efficiencyRating.level === 'excellent' ? 'bg-green-500/20 text-green-400' :
              project.efficiencyRating.level === 'good' ? 'bg-blue-500/20 text-blue-400' :
              project.efficiencyRating.level === 'poor' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {t(`efficiency_${project.efficiencyRating.label}`)}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
              project.efficiency >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {project.efficiency >= 0 ? <CheckCircleIcon className="w-3 h-3" /> : <XCircleIcon className="w-3 h-3" />}
              {t(project.efficiency >= 0 ? 'trend_improving' : 'trend_worsening')}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      <div>
        <p className="text-sm text-on-surface-dark-secondary">{t('trips_col_emissions')} (kg)</p>
        <p className="text-xl font-bold text-white">{project.totalCO2.toFixed(1)}</p>
      </div>
      <div>
        <p className="text-sm text-on-surface-dark-secondary">{t('co2_metric_efficiency')} (kg/km)</p>
        <p className="text-xl font-bold text-white">{project.averageEfficiency.toFixed(2)}</p>
      </div>
      <div>
        <p className="text-sm text-on-surface-dark-secondary">{t('co2_metric_distance')} (km)</p>
        <p className="text-xl font-bold text-white">{project.totalDistance.toFixed(0)}</p>
      </div>
      <div>
        <p className="text-sm text-on-surface-dark-secondary">{t('co2_metric_trips')}</p>
        <p className="text-xl font-bold text-white">{project.tripCount}</p>
      </div>
    </div>
  </div>
);

const CO2RankingView: React.FC<CO2RankingViewProps> = ({
  onBack,
  theme,
  personalization
}) => {
  const { t } = useTranslation();
  const { trips, projects } = useTrips();
  const { userProfile } = useUserProfile();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [sortBy, setSortBy] = useState<'total_co2' | 'efficiency' | 'distance'>('total_co2');
  const [timeRange, setTimeRange] = useState<'30' | '90' | '365' | 'all'>('30');
  const [viewMode, setViewMode] = useState<'projects_only' | 'all'>('projects_only');


  const [isInitialized, setIsInitialized] = useState(false);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const handleSettingsSave = (settings: any) => {
    setSortBy(settings.sortBy);
    setTimeRange(settings.timeRange);
    setViewMode(settings.viewMode);


    setShowWelcomeMessage(false);
    setShowSettingsModal(false);
  };

  const handleExportData = () => {
    const exportData = {
      summary: summaryMetrics,
      projects: projectCO2Data,
      settings: {
        sortBy,
        timeRange,
        viewMode
      },
      exportDate: new Date().toISOString()
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `co2-ranking-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load saved settings on component mount
  useEffect(() => {
    if (!userProfile?.id) return;
    
    const savedSettings = localStorage.getItem(`co2-analysis-settings-${userProfile.id}`);
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setViewMode(settings.viewMode || 'projects_only');
        setSortBy(settings.sortBy || 'total_co2');
        setTimeRange(settings.timeRange || '30');


        setIsInitialized(true);
        setShowWelcomeMessage(false);
      } catch (error) {
        console.error('Error loading CO2 settings:', error);
        setIsInitialized(true);
      }
    } else {
      // No hay configuraciones guardadas, mostrar mensaje de bienvenida
      setIsInitialized(true);
    }
  }, [userProfile?.id]);

  // Filter trips based on time range
  const filteredTrips = useMemo(() => {
    if (timeRange === 'all') return trips;

    const now = new Date();
    const daysBack = parseInt(timeRange);
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    return trips.filter(trip => new Date(trip.date) >= startDate);
  }, [trips, timeRange]);

  // Calculate project CO2 data
  const projectCO2Data = useMemo(() => {
    const projectMap = new Map<string, ProjectCO2Data>();

    // Get available projects for filtering
    const availableProjects = [...new Set(filteredTrips.map(trip => trip.projectId).filter(Boolean))];
    const availableProjectNames = availableProjects
      .map(id => projects.find(p => p.id === id)?.name)
      .filter(Boolean) as string[];

    filteredTrips.forEach(trip => {
      // Skip trips that don't match view mode
      if (viewMode === 'projects_only' && !trip.projectId) return;

      // No project filtering needed anymore

      const project = projects.find(p => p.id === trip.projectId);
      const projectName = project?.name || 'Unassigned';

      if (!projectMap.has(projectName)) {
        projectMap.set(projectName, {
          projectId: trip.projectId || 'unassigned',
          projectName,
          totalCO2: 0,
          totalDistance: 0,
          totalFuel: 0,
          averageEfficiency: 0,
          tripCount: 0,
          efficiency: 0, // This would be calculated from trend analysis
          treesNeeded: 0,
          efficiencyRating: getCO2EfficiencyRating(0)
        });
      }

      const projectData = projectMap.get(projectName)!;

      // Calculate CO2 for this trip
      const params: CO2CalculationParams = {
        distance: trip.distance,
        vehicleType: userProfile?.vehicleType,
        fuelConsumption: userProfile?.fuelConsumption,
        energyConsumption: userProfile?.energyConsumption
      };

      const tripCO2 = calculateCO2Emissions(params);
      const tripEfficiency = calculateCO2Efficiency(params);

      projectData.totalCO2 += tripCO2;
      projectData.totalDistance += trip.distance;
      projectData.tripCount += 1;

      // Calculate fuel consumption for combustion vehicles
      if (userProfile?.vehicleType === 'combustion' && userProfile.fuelConsumption) {
        projectData.totalFuel += calculateFuelConsumption(trip.distance, userProfile.fuelConsumption);
      }
    });

    // Calculate derived metrics
    projectMap.forEach(project => {
      project.averageEfficiency = project.totalDistance > 0 ? project.totalCO2 / project.totalDistance : 0;
      project.treesNeeded = calculateTreesNeeded(project.totalCO2);
      project.efficiencyRating = getCO2EfficiencyRating(project.averageEfficiency);
    });

    return Array.from(projectMap.values())
      .filter(project => {
        // Apply emissions range filter
        return true; // No emissions range filtering
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'efficiency':
            return a.averageEfficiency - b.averageEfficiency;
          case 'distance':
            return b.totalDistance - a.totalDistance;
          case 'total_co2':
          default:
            return b.totalCO2 - a.totalCO2;
        }
      });
  }, [filteredTrips, projects, userProfile, sortBy, viewMode]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalCO2 = projectCO2Data.reduce((sum, project) => sum + project.totalCO2, 0);
    const totalDistance = projectCO2Data.reduce((sum, project) => sum + project.totalDistance, 0);
    const totalFuel = projectCO2Data.reduce((sum, project) => sum + project.totalFuel, 0);
    const averageEfficiency = totalDistance > 0 ? totalCO2 / totalDistance : 0;
    const treesNeeded = calculateTreesNeeded(totalCO2);

    return {
      totalCO2: totalCO2.toFixed(1),
      averageEfficiency: averageEfficiency.toFixed(2),
      totalFuel: totalFuel.toFixed(1),
      treesNeeded: treesNeeded.toString()
    };
  }, [projectCO2Data]);

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
    <div className="p-8 rounded-lg -m-8">
      {/* Header */}
      <header className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center bg-gray-700 hover:bg-gray-600 text-white font-bold p-3 rounded-lg"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-title bg-clip-text text-transparent">{t('co2_ranking_title')}</h1>
            <p className="text-sm text-on-surface-dark-secondary">{t('co2_ranking_card_description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
            {t('co2_settings_title') || 'Settings'}
          </button>
          <button
            onClick={handleExportData}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            <DownloadIcon className="w-4 h-4" />
            {t('common_export')}
          </button>
        </div>
      </header>

      {/* Welcome Message for First Time Users */}
      {showWelcomeMessage && isInitialized && (
        <div className="text-center py-16">
          <div className="max-w-2xl mx-auto">
            <div className="text-6xl mb-6 opacity-40">🌱</div>
            <h2 className="text-2xl font-bold text-white mb-4">
              {t('co2_welcome_title') || 'Welcome to CO₂ Analysis'}
            </h2>
            <p className="text-lg text-gray-300 mb-6 leading-relaxed">
              {t('co2_welcome_desc') || 'Get insights into the environmental impact of your trips. Configure your analysis preferences to start tracking your carbon footprint and discover opportunities for more sustainable travel.'}
            </p>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-500 text-white font-semibold px-8 py-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/20"
            >
              <SettingsIcon className="w-5 h-5" />
              {t('co2_welcome_setup') || 'Set Up CO₂ Analysis'}
            </button>
          </div>
        </div>
      )}

      {/* Summary Metrics Cards - Only show when data is available */}
      {!showWelcomeMessage && projectCO2Data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title={t('co2_metric_total_emissions') || 'Total CO₂ Emissions'}
            value={`${summaryMetrics.totalCO2} kg`}
            icon={<Co2EmissionIcon className="w-8 h-8" />}
            color="text-red-400"
          />
          <StatCard
            title={t('co2_metric_avg_efficiency') || 'Avg. Efficiency'}
            value={`${summaryMetrics.averageEfficiency} kg/km`}
            icon={<GaugeIcon className="w-8 h-8" />}
            color="text-blue-400"
          />
          <StatCard
            title={t('co2_metric_fuel_consumption') || 'Fuel Consumption'}
            value={`${summaryMetrics.totalFuel} L`}
            icon={<FuelIcon className="w-8 h-8" />}
            color="text-purple-400"
          />
          <StatCard
            title={t('co2_metric_trees_needed') || 'Trees Needed'}
            value={`${summaryMetrics.treesNeeded}`}
            icon={<TreePineIcon className="w-8 h-8 text-white" />}
            iconColor="text-white"
            color="text-green-400"
          />
        </div>
      )}

      {/* Results Section - Only show when not in welcome state */}
      {!showWelcomeMessage && (
        <>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white mb-2">
              {t('co2_results_title') || 'CO₂ Ranking Results'} ({projectCO2Data.length})
            </h2>
          </div>

          {/* Project Rankings */}
          {projectCO2Data.length > 0 ? (
            <div className="space-y-6">
              {projectCO2Data.map((project, index) => (
                <ProjectRow
                  key={project.projectName}
                  project={project}
                  rank={index + 1}
                  formatCurrency={formatCurrency}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-4 opacity-40">🔍</div>
              <h3 className="text-lg font-medium text-white mb-2">
                {t('co2_no_data_title') || 'No Data Available'}
              </h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                {t('co2_no_data_desc') || 'No trips match your current filter criteria. Try adjusting your settings or add some trips to see your CO₂ analysis.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-lg transition-colors"
                >
                  <SettingsIcon className="w-4 h-4" />
                  {t('co2_adjust_settings') || 'Adjust Settings'}
                </button>
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-medium px-6 py-3 rounded-lg transition-colors"
                >
                  {t('co2_add_trips') || 'Add Trips'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Settings Modal */}
      <CO2AnalysisSettings
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSettingsSave}
        theme={theme}
        personalization={personalization}
        initialSettings={{
          viewMode,
          sortBy,
          timeRange,
          fuelEfficiency: userProfile?.fuelConsumption || 8.5,

        }}
      />
    </div>
  );
};

export default CO2RankingView;
