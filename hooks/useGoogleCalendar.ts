import { useContext } from 'react';
import { GoogleCalendarContext } from '../context/GoogleCalendarContext';

const useGoogleCalendar = () => {
  const context = useContext(GoogleCalendarContext);
  if (!context) {
    throw new Error('useGoogleCalendar must be used within a GoogleCalendarProvider');
  }
  return context;
};

export default useGoogleCalendar;