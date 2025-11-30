import React, { useState } from 'react';
import useTranslation from '../hooks/useTranslation';
import useExpenses from '../hooks/useExpenses';
import useTrips from '../hooks/useTrips';
import { ExpenseCategory } from '../types';
import { XIcon, UploadCloudIcon } from './Icons';
import { Button } from './Button';

interface ExpenseUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string | null;
  defaultTripId?: string | null;
}

const categories: ExpenseCategory[] = ['fuel', 'maintenance'];

const ExpenseUploadModal: React.FC<ExpenseUploadModalProps> = ({
  isOpen,
  onClose,
  defaultProjectId = null,
  defaultTripId = null,
}) => {
  const { t } = useTranslation();
  const { addExpense, loading } = useExpenses();
  const { trips } = useTrips();

  const [category, setCategory] = useState<ExpenseCategory>('fuel');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('EUR');
  const [description, setDescription] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setCategory('fuel');
    setAmount('');
    setCurrency('EUR');
    setDescription('');
    setInvoiceDate('');
    setFile(null);
    setError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError(t('expense_upload_select') || 'Please select a file');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError(t('expense_upload_amount') || 'Please enter an amount');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const sanitizedProjectId =
        defaultProjectId && defaultProjectId !== 'unassigned' ? defaultProjectId : null;
      const tripProjectId = defaultTripId
        ? trips.find(trip => trip.id === defaultTripId)?.projectId ?? null
        : null;
      const projectIdToUse = sanitizedProjectId ?? tripProjectId ?? null;

      await addExpense({
        projectId: projectIdToUse,
        tripId: defaultTripId,
        category,
        amount: Number(amount),
        currency: currency || null,
        description: description || null,
        invoiceDate: invoiceDate || null,
        file,
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg rounded-lg border border-glass bg-surface-dark p-6 shadow-glass-lg"
        onClick={event => event.stopPropagation()}
      >
        <Button
          variant="icon"
          onClick={handleClose}
          aria-label={t('common_close')}
          className="absolute right-4 top-4 text-on-surface-secondary hover:text-white"
        >
          <XIcon className="h-5 w-5" />
        </Button>
        <h2 className="mb-5 text-xl font-semibold text-white">
          {t('expense_upload_title') || 'Upload Invoice'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-on-surface-secondary">
              {t('expense_upload_category') || 'Category'}
            </label>
            <select
              className="w-full rounded-md border border-glass bg-background-dark/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              value={category}
              onChange={event => setCategory(event.target.value as ExpenseCategory)}
            >
              {categories.map(value => (
                <option key={value} value={value}>
                  {value === 'fuel'
                    ? t('expense_category_fuel') || 'Fuel'
                    : t('expense_category_maintenance') || 'Maintenance'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface-secondary">
                {t('expense_upload_amount') || 'Amount'}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={event => setAmount(event.target.value)}
                className="w-full rounded-md border border-glass bg-background-dark/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface-secondary">
                {t('expense_upload_currency') || 'Currency'}
              </label>
              <input
                type="text"
                maxLength={3}
                value={currency}
                onChange={event => setCurrency(event.target.value.toUpperCase())}
                className="w-full rounded-md border border-glass bg-background-dark/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface-secondary">
                {t('expense_upload_date') || 'Invoice Date'}
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={event => setInvoiceDate(event.target.value)}
                className="w-full rounded-md border border-glass bg-background-dark/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface-secondary">
                {t('expense_upload_description') || 'Description'}
              </label>
              <input
                type="text"
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder={t('expense_upload_description_placeholder') || 'Optional note'}
                className="w-full rounded-md border border-glass bg-background-dark/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-on-surface-secondary">
              {t('expense_upload_document') || 'Invoice Document'}
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-glass bg-background-dark/60 px-4 py-3.5 text-sm text-on-surface-secondary transition hover:border-brand-primary hover:text-white">
              <UploadCloudIcon className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{file ? file.name : (t('expense_upload_select') || 'Click to select invoice file')}</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t('common_cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSubmitting || loading}
            >
              <UploadCloudIcon className="h-4 w-4 mr-2" />
              {isSubmitting
                ? (t('expense_upload_submitting') || 'Uploading...')
                : (t('expense_upload_submit') || 'Upload Invoice')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseUploadModal;
