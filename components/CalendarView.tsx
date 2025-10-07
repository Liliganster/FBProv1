

import React, { useState, useEffect, useMemo } from 'react';
import useGoogleCalendar from '../hooks/useGoogleCalendar';
import useTranslation from '../hooks/useTranslation';
import useUserProfile from '../hooks/useUserProfile';
import { LoaderIcon, UsersIcon, SettingsIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import EventActionModal from './EventActionModal';
import { PersonalizationSettings } from '../types';

type View = 'dashboard' | 'trips' | 'projects' | 'settings' | 'reports' | 'calendar';

interface CalendarViewProps {
    setCurrentView: (view: View) => void;
    personalization: PersonalizationSettings;
    theme: 'light' | 'dark';
}

const CalendarView: React.FC<CalendarViewProps> = ({ setCurrentView, personalization, theme }) => {
  const { t, language } = useTranslation();
  const { userProfile } = useUserProfile();
  const { isInitialized, isSignedIn, signIn, signOut, calendars, fetchEvents } = useGoogleCalendar();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  // Google Calendar is now automatically configured via environment variables
  const isConfigured = true; // Always true if env vars are set

  useEffect(() => {
    if (calendars.length > 0 && selectedCalendars.length === 0) {
      const primaryCalendar = calendars.find(cal => cal.primary);
      setSelectedCalendars(primaryCalendar ? [primaryCalendar.id] : [calendars[0].id]);
    }
  }, [calendars, selectedCalendars]);
  
  const daysInMonth = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const days = [];
    while (date.getMonth() === currentDate.getMonth()) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  const firstDayOfMonth = useMemo(() => {
      const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
      return day === 0 ? 6 : day - 1; // Adjust so Monday is 0
  }, [currentDate]);
  
  const weekdays = useMemo(() => {
      const monday = new Date(2024, 0, 1); // A known Monday
      return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          return d.toLocaleDateString(language, { weekday: 'short' });
      });
  }, [language]);


  const changeMonth = (offset: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };

  const handleCalendarSelection = (calendarId: string) => {
    setSelectedCalendars(prev =>
      prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  useEffect(() => {
    if (isSignedIn && selectedCalendars.length > 0) {
      setLoadingEvents(true);
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      lastDay.setHours(23, 59, 59, 999);
      fetchEvents(selectedCalendars, firstDay.toISOString(), lastDay.toISOString())
        .then(setEvents)
        .finally(() => setLoadingEvents(false));
    } else {
      setEvents([]);
    }
  }, [isSignedIn, selectedCalendars, currentDate, fetchEvents]);
  
  const contentStyle = {
    backgroundColor: theme === 'dark'
        ? `rgba(30, 30, 30, ${1 - personalization.uiTransparency})`
        : `rgba(243, 244, 246, ${1 - personalization.uiTransparency})`,
    backdropFilter: `blur(${personalization.uiBlur}px)`,
  };

  if (!userProfile) {
    return (
      <div style={contentStyle} className="p-8 rounded-lg text-center flex flex-col items-center justify-center min-h-[20rem]">
        <UsersIcon className="w-16 h-16 mb-4 text-gray-600" />
        <p className="text-lg">{t('calendar_no_driver_selected_prompt')}</p>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div style={contentStyle} className="p-8 rounded-lg text-center flex flex-col items-center justify-center min-h-[20rem]">
        <SettingsIcon className="w-16 h-16 mb-4 text-gray-600" />
        <h2 className="text-2xl font-bold mb-2">{t('calendar_config_prompt_title')}</h2>
        <p className="text-lg mb-4 max-w-md">{t('calendar_config_prompt_desc')}</p>
        <button onClick={() => setCurrentView('settings')} className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg">
          {t('nav_settings')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full -m-8">
      <div style={contentStyle} className="w-64 p-4 border-r border-gray-700/50 flex flex-col">
        <h2 className="text-xl font-semibold mb-4">{t('calendar_calendars_title')}</h2>
        <ul className="space-y-2 overflow-y-auto">
          {calendars.map(cal => (
            <li key={cal.id}>
              <label className="flex items-center p-2 rounded-md hover:bg-background-dark/50 cursor-pointer">
                <input type="checkbox" checked={selectedCalendars.includes(cal.id)} onChange={() => handleCalendarSelection(cal.id)} className="h-4 w-4 rounded border-gray-500 bg-background-dark text-brand-primary focus:ring-brand-primary" style={{ accentColor: cal.backgroundColor }}/>
                <span className="ml-3 text-sm font-medium truncate" style={{ color: cal.foregroundColor }}>{cal.summary}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-auto">
            {isSignedIn && <button onClick={signOut} className="w-full text-center bg-red-600/20 text-red-300 hover:bg-red-600/40 font-semibold py-2 px-4 rounded-lg">{t('calendar_sign_out_btn')}</button>}
        </div>
      </div>
      <div className="flex-1 p-6 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-surface-dark"><ChevronLeftIcon className="w-6 h-6"/></button>
            <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-surface-dark"><ChevronRightIcon className="w-6 h-6"/></button>
            <h1 className="text-2xl font-bold text-white ml-2">
              {currentDate.toLocaleDateString(language, { month: 'long', year: 'numeric' })}
            </h1>
          </div>
          {!isSignedIn && (
            <button onClick={signIn} disabled={!isInitialized} className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                {t('calendar_connect_btn')}
            </button>
          )}
        </div>
        {!isSignedIn ? (
            <div className="flex-1 flex items-center justify-center text-on-surface-dark-secondary">{t('calendar_connect_btn')} to view events.</div>
        ) : loadingEvents ? (
            <div className="flex-1 flex items-center justify-center"><LoaderIcon className="w-8 h-8 animate-spin"/></div>
        ) : (
          <div className="grid grid-cols-7 grid-rows-6 gap-1 flex-1">
            {weekdays.map(day => <div key={day} className="text-center font-bold text-on-surface-dark-secondary text-sm">{day}</div>)}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="border border-transparent"></div>)}
            {daysInMonth.map(day => {
              const dayEvents = events.filter(e => {
                const eventDateStr = e.start.dateTime || e.start.date;
                if (!eventDateStr) return false;
                
                // For all-day events (e.g., '2023-11-15'), parse as a local date
                // to prevent timezone shifting issues. `new Date('YYYY-MM-DD')` parses as UTC midnight.
                if (e.start.date && eventDateStr.length === 10) { 
                    const [year, month, dayOfMonth] = eventDateStr.split('-').map(Number);
                    const eventDate = new Date(year, month - 1, dayOfMonth);
                    return eventDate.toDateString() === day.toDateString();
                }
                
                // For timed events, the full ISO string with timezone is handled correctly by new Date().
                return new Date(eventDateStr).toDateString() === day.toDateString();
              });
              const isToday = day.toDateString() === new Date().toDateString();
              return (
                <div key={day.toString()} className="bg-surface-dark/50 rounded-lg p-1.5 flex flex-col gap-1 overflow-y-auto">
                  <span className={`font-semibold text-xs ${isToday ? 'bg-brand-primary text-white rounded-full h-5 w-5 flex items-center justify-center' : ''}`}>{day.getDate()}</span>
                  {dayEvents.map(event => (
                    <div key={event.id} onClick={() => setSelectedEvent(event)} className="text-xs p-1 rounded cursor-pointer text-white truncate" style={{backgroundColor: event.backgroundColor || '#007aff'}}>
                      {event.summary}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {selectedEvent && (
        <EventActionModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
};

export default CalendarView;