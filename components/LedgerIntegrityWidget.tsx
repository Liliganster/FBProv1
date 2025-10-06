/**
 * LedgerIntegrityWidget - Shows ledger verification status
 * Displays current ledger health and verification information
 */

import React, { useState, useEffect } from 'react';
import { TripLedgerVerification } from '../types';
import useTrips from '../hooks/useTrips';
import useTranslation from '../hooks/useTranslation';
import { CheckIcon, LoaderIcon, SettingsIcon } from './Icons';

interface LedgerIntegrityWidgetProps {
  className?: string;
  showDetails?: boolean;
}

const LedgerIntegrityWidget: React.FC<LedgerIntegrityWidgetProps> = ({ 
  className = '', 
  showDetails = false 
}) => {
  const { verifyLedgerIntegrity, getRootHash } = useTrips();
  const [lastVerification, setLastVerification] = useState<TripLedgerVerification | null>(null);
  const { t } = useTranslation();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verification, setVerification] = useState<TripLedgerVerification | null>(lastVerification);

  useEffect(() => {
    setVerification(lastVerification);
  }, [lastVerification]);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyLedgerIntegrity();
      const rootHash = await getRootHash();
      const verificationResult: TripLedgerVerification = {
        isValid: result.isValid,
        totalEntries: 0,
        rootHash: rootHash || '',
        verificationTimestamp: new Date().toISOString()
      };
      setVerification(verificationResult);
      setLastVerification(verificationResult);
    } catch (error) {
      console.error('Failed to verify ledger:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusIcon = () => {
    if (isVerifying) {
      return <LoaderIcon className="w-5 h-5 animate-spin text-blue-400" />;
    }
    
    if (!verification) {
      return <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">!</div>;
    }
    
    if (verification.isValid) {
      return <CheckIcon className="w-5 h-5 text-green-400" />;
    }
    
    return <div className="w-5 h-5 bg-red-400 rounded-full flex items-center justify-center text-white text-xs">!</div>;
  };

  const getStatusText = () => {
    if (isVerifying) return t('ledger_verifying');
    if (!verification) return t('ledger_not_verified');
    if (verification.isValid) return t('ledger_integrity_valid');
    return t('ledger_integrity_invalid');
  };

  const getStatusColor = () => {
    if (isVerifying) return 'text-blue-400';
    if (!verification) return 'text-yellow-400';
    if (verification.isValid) return 'text-green-400';
    return 'text-red-400';
  };

  return (
    <div className={`bg-surface-dark rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-6 h-6 text-gray-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">
              {t('ledger_integrity_title')}
            </h3>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className={`text-sm ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={handleVerify}
          disabled={isVerifying}
          className="px-3 py-1 bg-brand-primary/20 text-brand-primary rounded-md hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {isVerifying ? t('ledger_verifying') : t('ledger_verify_now')}
        </button>
      </div>

      {showDetails && verification && (
        <div className="mt-4 pt-4 border-t border-gray-700/60">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-400">{t('ledger_total_entries')}:</span>
              <span className="ml-2 text-white">{verification.totalEntries}</span>
            </div>
            <div>
              <span className="text-gray-400">{t('ledger_verification_time')}:</span>
              <span className="ml-2 text-white">
                {new Date(verification.verificationTimestamp).toLocaleString()}
              </span>
            </div>
            {verification.isValid && (
              <div className="col-span-2">
                <span className="text-gray-400">{t('ledger_root_hash')}:</span>
                <div className="mt-1 p-2 bg-gray-800/50 rounded font-mono text-xs text-gray-300 break-all">
                  {verification.rootHash}
                </div>
              </div>
            )}
            {!verification.isValid && verification.brokenChainAt && (
              <div className="col-span-2">
                <span className="text-red-400">{t('ledger_broken_at')}:</span>
                <div className="mt-1 p-2 bg-red-900/20 rounded font-mono text-xs text-red-300 break-all">
                  {verification.brokenChainAt}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerIntegrityWidget;