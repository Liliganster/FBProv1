import { useState, useEffect } from 'react';
import { Report } from '../types';
import { useAuth } from './useAuth';

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

  const addReport = (report: Omit<Report, 'id'>) => {
    const newReport = { ...report, id: `report-${Date.now()}` };
    updateAndSaveReports([newReport, ...reports]);
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

  return { reports, addReport, deleteReport, deleteMultipleReports, setAllReports, deleteAllReports };
};

export default useReports;