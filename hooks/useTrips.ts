import { useContext } from 'react';
import { LedgerTripsContext } from '../context/LedgerTripsContext';

const useTrips = () => {
  const context = useContext(LedgerTripsContext);
  if (!context) {
    throw new Error('useTrips must be used within a LedgerTripsProvider');
  }
  return context;
};

export default useTrips;