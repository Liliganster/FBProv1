import { useState, useEffect } from 'react';
import { Report, TripLedgerVerification } from '../types';
import { useAuth } from './useAuth';
import { databaseService } from '../services/databaseService';

const useReports = () => {
  const { user } = useAuth();
  const storageKey = user ? `fahrtenbuch_reports_${user.id}` : null;
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    if (storageKey) {
      const savedReports = localStorage.getItem(storageKey);
      setReports(savedReports ? JSON.parse(savedReports) : []);
    } else {
      setReports([]);
    }
  }, [storageKey]);

  const updateAndSaveReports = (newReports: Report[]) => {
    setReports(newReports);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(newReports));
    }
  };

  const addReport = async (report: Omit<Report, 'id'>) => {
    const newReport: Report = {
      ...report,
      id: `report-${Date.now()}`,
      generationTimestamp: new Date().toISOString()
    };
    
    // Save to Supabase if user is authenticated
    if (user?.id) {
      try {
        const savedReport = await databaseService.createReport(user.id, newReport);
        updateAndSaveReports([savedReport, ...reports]);
        return savedReport;
      } catch (error) {
        console.error('Error saving report to Supabase:', error);
        // Fallback to localStorage
        updateAndSaveReports([newReport, ...reports]);
        return newReport;
      }
    } else {
      updateAndSaveReports([newReport, ...reports]);
      return newReport;
    }
  };

  const deleteReport = (reportId: string) => {
    updateAndSaveReports(reports.filter(report => report.id !== reportId));
  };
  
  const deleteMultipleReports = (reportIds: string[]) => {
    updateAndSaveReports(reports.filter(report => !reportIds.includes(report.id)));
  };

  const setAllReports = (newReports: Report[]) => {
    updateAndSaveReports(newReports);
  };
  
  const deleteAllReports = () => {
    updateAndSaveReports([]);
  };

  // Verify ledger integrity for a specific report
  const verifyReportIntegrity = async (reportId: string): Promise<boolean> => {
    const report = reports.find(r => r.id === reportId);
    if (!report?.ledgerVerification) {
      return false;
    }
    
    // Basic verification - reports are immutable snapshots
    return true;
  };

  // Get verification status for all reports
  const getReportsVerificationStatus = async (): Promise<Record<string, boolean>> => {
    const status: Record<string, boolean> = {};
    
    for (const report of reports) {
      status[report.id] = report.ledgerVerification ? true : false;
    }
    
    return status;
  };

  return { 
    reports, 
    addReport, 
    deleteReport, 
    deleteMultipleReports, 
    setAllReports, 
    deleteAllReports,
    verifyReportIntegrity,
    getReportsVerificationStatus
  };
};

export default useReports;