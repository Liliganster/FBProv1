import { useContext } from 'react';
import { TripsContext } from '../context/TripsContext';

const useTrips = () => {
  const context = useContext(TripsContext);
  if (!context) {
    throw new Error('useTrips must be used within a TripsProvider');
  }
  return context;
};

export default useTrips;