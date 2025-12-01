import React, { useMemo, useState } from 'react';
import { Trip, Project, PersonalizationSettings } from '../types';
import { XIcon, MapPinIcon, FileTextIcon, TrashIcon, UploadCloudIcon } from './Icons';
import { Button } from './Button';
import InteractiveMap from './InteractiveMap';
import useTranslation from '../hooks/useTranslation';
import { formatDateForDisplay } from '../i18n/translations';
import { getCountryCode } from '../services/googleMapsService';
import useUserProfile from '../hooks/useUserProfile';
import useExpenses from '../hooks/useExpenses';
import ExpenseUploadModal from './ExpenseUploadModal';

interface TripDetailModalProps {
  trip: Trip;
  project: Project | undefined;
  onClose: () => void;
  personalization?: PersonalizationSettings;
  theme?: 'light' | 'dark';
}

const TripDetailModal: React.FC<TripDetailModalProps> = ({ trip, project, onClose, personalization, theme }) => {
  const { userProfile } = useUserProfile();
  const { t } = useTranslation();
  const regionCode = getCountryCode(userProfile?.country);
  const { getExpensesForTrip, deleteExpense, loading: expensesLoading } = useExpenses();
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  const tripExpenses = useMemo(() => getExpensesForTrip(trip.id), [getExpensesForTrip, trip.id]);
  const totalExpense = useMemo(
    () => tripExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
    [tripExpenses]
  );
  const totalExpenseCurrency = tripExpenses[0]?.currency ?? 'EUR';

  const formatCurrency = (value: number, currency?: string | null) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'EUR',
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency || 'EUR'}`;
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm(t('expense_delete_confirm') || 'Delete this invoice?')) {
      return;
    }
    try {
      await deleteExpense(expenseId);
    } catch (error) {
      // errors surfaced via toast
    }
  };

  const openInvoice = (url: string) => {
    window.open(url, '_blank', 'noopener');
  };

  const projectId = project?.id ?? trip.projectId ?? null;

  // Dynamic modal style based on personalization
  const modalStyle = personalization ? {
    backgroundColor: `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
    WebkitBackdropFilter: `blur(${personalization.uiBlur}px)`,
  } : {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 py-16 overflow-y-auto bg-gradient-overlay backdrop-blur-glass"
      onClick={onClose}
    >
      <div
        style={modalStyle}
        className="relative w-full max-w-5xl bg-frost-glass border-glass rounded-fluid shadow-glass-lg flex flex-col h-[82vh] overflow-hidden backdrop-blur-glass"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-start justify-between px-6 py-4 border-b border-glass flex-shrink-0">
          <h2 className="text-lg font-semibold tracking-tight text-white">{t('detail_title')}</h2>
          <Button
            variant="icon"
            onClick={onClose}
            aria-label={t('common_close')}
            title={t('common_close')}
          >
            <XIcon className="w-5 h-5" />
          </Button>
        </header>
        <main className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Sidebar */}
          <div className="w-full md:w-1/3 px-6 py-6 space-y-4 overflow-y-auto border-r border-glass bg-gradient-surface/30">
            <InfoItem label={t('detail_date')} value={formatDateForDisplay(trip.date)} />
            <InfoItem label={t('detail_project')} value={project?.name || t('detail_unknown')} />
            <InfoItem label={t('detail_driver')} value={userProfile?.name || t('detail_unknown')} />
            <InfoItem label={t('detail_reason')} value={trip.reason} />
            {trip.passengers && trip.passengers > 0 && (
              <InfoItem label={t('detail_passengers')} value={trip.passengers.toString()} />
            )}
            <div className="border-t border-gray-700/60 pt-4 mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300/90 mb-3 flex items-center gap-2">
                <MapPinIcon className="w-4 h-4" />
                {t('detail_route')}
              </h3>
              <ol className="relative border-l border-gray-600/60 ml-2">
                {trip.locations.map((location, index) => (
                  <li key={index} className="mb-4 ml-4">
                    <div
                      className={`absolute w-3 h-3 ${index === 0
                        ? 'bg-brand-primary'
                        : index === trip.locations.length - 1
                          ? 'bg-brand-secondary'
                          : 'bg-gray-500'
                        } rounded-full mt-1.5 -left-1.5 border border-background-dark`}
                    ></div>
                    <p className="text-sm text-gray-200 leading-snug">{location}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="border-t border-gray-700/60 pt-4 mt-4">
              <InfoItem label={t('detail_totalDistance')} value={`${trip.distance.toFixed(1)} km`} highlight />
            </div>
            <div className="border-t border-gray-700/60 pt-4 mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300/90 flex items-center gap-2">
                  <FileTextIcon className="w-4 h-4" />
                  {t('expense_section_title') || 'Fuel & maintenance invoices'}
                </h3>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsExpenseModalOpen(true)}
                >
                  <UploadCloudIcon className="h-4 w-4 mr-1" />
                  {t('expense_attach_btn') || 'Attach'}
                </Button>
              </div>
              <p className="text-sm text-on-surface-secondary">
                {t('expense_section_total') || 'Total documented'}:{' '}
                <span className="font-semibold text-white">
                  {formatCurrency(totalExpense, totalExpenseCurrency)}
                </span>
              </p>
              <div className="space-y-3">
                {expensesLoading && (
                  <p className="text-sm text-on-surface-secondary">
                    {t('expense_loading') || 'Loading invoices…'}
                  </p>
                )}
                {!expensesLoading && tripExpenses.length === 0 && (
                  <p className="text-sm text-on-surface-secondary italic">
                    {t('expense_list_empty') || 'No invoices attached to this trip yet.'}
                  </p>
                )}
                {!expensesLoading &&
                  tripExpenses.map(expense => {
                    const categoryLabel =
                      expense.category === 'fuel'
                        ? t('expense_category_fuel') || 'Fuel'
                        : t('expense_category_maintenance') || 'Maintenance';
                    const invoiceDateLabel = expense.invoiceDate
                      ? formatDateForDisplay(expense.invoiceDate)
                      : null;
                    return (
                      <div
                        key={expense.id}
                        className="flex items-start justify-between rounded-md border border-glass bg-background-dark/70 px-3 py-2.5"
                      >
                        <div className="flex flex-1 gap-3">
                          <FileTextIcon className="mt-1 h-4 w-4 text-brand-secondary flex-shrink-0" />
                          <div className="space-y-1 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white">
                                {formatCurrency(expense.amount, expense.currency)}
                              </span>
                              <span className="rounded-sm bg-brand-secondary/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-secondary">
                                {categoryLabel}
                              </span>
                              {invoiceDateLabel && (
                                <span className="text-xs text-on-surface-secondary">{invoiceDateLabel}</span>
                              )}
                            </div>
                            {expense.description && (
                              <p className="text-sm text-on-surface-secondary">{expense.description}</p>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openInvoice(expense.url)}
                              className="text-xs font-medium text-brand-primary hover:text-white p-0 h-auto"
                            >
                              {t('expense_open_document') || 'View invoice'}
                            </Button>
                          </div>
                        </div>
                        <Button
                          variant="icon"
                          size="sm"
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="ml-3 text-on-surface-secondary hover:text-red-400"
                          aria-label={t('expense_delete_btn') || 'Delete invoice'}
                          disabled={expensesLoading}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
          {/* Map area */}
          <div className="w-full md:w-2/3 flex-grow bg-background-dark">
            <InteractiveMap
              locations={trip.locations}
              region={regionCode}
            />
          </div>
        </main>
      </div>
      <ExpenseUploadModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        defaultTripId={trip.id}
        defaultProjectId={projectId}
      />
    </div>
  );
};

const InfoItem: React.FC<{ label: string, value: string, highlight?: boolean }> = ({ label, value, highlight }) => (
  <div>
    <h3 className="text-xs font-medium text-on-surface-dark-secondary uppercase tracking-wide">{label}</h3>
    <p className={`text-base mt-1 ${highlight ? 'font-bold text-brand-primary' : 'text-white'}`}>{value}</p>
  </div>
);

export default React.memo(TripDetailModal);
