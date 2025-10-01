import { useContext } from 'react';
import { ActiveDriverContext } from '../context/ActiveDriverContext';

const useActiveDriver = () => {
  const context = useContext(ActiveDriverContext);
  if (!context) {
    throw new Error('useActiveDriver must be used within an ActiveDriverProvider');
  }
  return context;
};

export default useActiveDriver;