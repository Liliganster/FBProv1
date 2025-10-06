// Supabase-only hook for trips functionality
import { useContext } from 'react';
import { LedgerTripsContext } from '../context/SupabaseLedgerTripsContext';

const useTrips = () => {
  const context = useContext(LedgerTripsContext);
  if (!context) {
    throw new Error('useTrips must be used within a LedgerTripsProvider');
  }
  return context;
};

export default useTrips;