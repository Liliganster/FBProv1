/**
 * Google Calendar Service
 * Provides utility functions for Google Calendar integration
 */

import { Trip } from '../types';

/**
 * Formats a trip into a Google Calendar event object
 * @param trip - The trip to format
 * @param projectName - The name of the project associated with the trip
 * @returns Google Calendar event object
 */
export function formatTripAsCalendarEvent(trip: Trip, projectName: string): any {
  return {
    summary: `${projectName}: ${trip.reason}`,
    description: `Route: ${trip.locations.join(' -> ')}\nDistance: ${trip.distance} km\nProject: ${projectName}`,
    start: {
      date: trip.date,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    end: {
      date: trip.date,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
  };
}

/**
 * Checks if a calendar event matches a trip
 * @param event - The calendar event
 * @param trip - The trip to compare
 * @returns true if the event matches the trip
 */
export function isEventMatchingTrip(event: any, trip: Trip): boolean {
  if (!event || !trip) return false;
  
  const eventDate = event.start?.date || event.start?.dateTime?.split('T')[0];
  const tripDate = trip.date;
  
  if (eventDate !== tripDate) return false;
  
  // Check if the event summary contains the trip reason
  const summary = event.summary?.toLowerCase() || '';
  const reason = trip.reason?.toLowerCase() || '';
  
  return summary.includes(reason);
}

/**
 * Validates calendar event data
 * @param event - The event to validate
 * @returns true if the event is valid
 */
export function isValidCalendarEvent(event: any): boolean {
  if (!event || typeof event !== 'object') return false;
  
  // Must have either start.date or start.dateTime
  if (!event.start || (!event.start.date && !event.start.dateTime)) return false;
  
  // Must have either end.date or end.dateTime
  if (!event.end || (!event.end.date && !event.end.dateTime)) return false;
  
  return true;
}

/**
 * Extracts date from a calendar event
 * @param event - The calendar event
 * @returns ISO date string (YYYY-MM-DD) or null
 */
export function getEventDate(event: any): string | null {
  if (!event) return null;
  
  // For all-day events
  if (event.start?.date) {
    return event.start.date;
  }
  
  // For timed events
  if (event.start?.dateTime) {
    return event.start.dateTime.split('T')[0];
  }
  
  return null;
}

/**
 * Formats event date for display
 * @param event - The calendar event
 * @param locale - The locale to use for formatting
 * @returns Formatted date string
 */
export function formatEventDate(event: any, locale: string = 'es-ES'): string {
  const dateStr = getEventDate(event);
  if (!dateStr) return 'Invalid Date';
  
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Checks if two events overlap in time
 * @param event1 - First event
 * @param event2 - Second event
 * @returns true if events overlap
 */
export function doEventsOverlap(event1: any, event2: any): boolean {
  const date1 = getEventDate(event1);
  const date2 = getEventDate(event2);
  
  if (!date1 || !date2) return false;
  
  // For all-day events, just check if dates match
  if (event1.start?.date && event2.start?.date) {
    return date1 === date2;
  }
  
  // For timed events, check actual time overlap
  if (event1.start?.dateTime && event2.start?.dateTime) {
    const start1 = new Date(event1.start.dateTime).getTime();
    const end1 = new Date(event1.end.dateTime).getTime();
    const start2 = new Date(event2.start.dateTime).getTime();
    const end2 = new Date(event2.end.dateTime).getTime();
    
    return start1 < end2 && start2 < end1;
  }
  
  return false;
}

/**
 * Filters events by date range
 * @param events - Array of calendar events
 * @param startDate - Start date (ISO string)
 * @param endDate - End date (ISO string)
 * @returns Filtered events
 */
export function filterEventsByDateRange(
  events: any[],
  startDate: string,
  endDate: string
): any[] {
  if (!Array.isArray(events)) return [];
  
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  
  return events.filter(event => {
    const eventDate = getEventDate(event);
    if (!eventDate) return false;
    
    const eventTime = new Date(eventDate).getTime();
    return eventTime >= start && eventTime <= end;
  });
}

/**
 * Groups events by date
 * @param events - Array of calendar events
 * @returns Object with dates as keys and arrays of events as values
 */
export function groupEventsByDate(events: any[]): Record<string, any[]> {
  if (!Array.isArray(events)) return {};
  
  return events.reduce((acc, event) => {
    const date = getEventDate(event);
    if (!date) return acc;
    
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, any[]>);
}

/**
 * Sorts events by start time
 * @param events - Array of calendar events
 * @returns Sorted events
 */
export function sortEventsByStartTime(events: any[]): any[] {
  if (!Array.isArray(events)) return [];
  
  return [...events].sort((a, b) => {
    const aTime = a.start?.dateTime || a.start?.date;
    const bTime = b.start?.dateTime || b.start?.date;
    
    if (!aTime) return 1;
    if (!bTime) return -1;
    
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });
}

/**
 * Checks if a calendar is writable
 * @param calendar - The calendar object
 * @returns true if the calendar can be written to
 */
export function isCalendarWritable(calendar: any): boolean {
  if (!calendar) return false;
  
  // Check access role
  const role = calendar.accessRole?.toLowerCase();
  return role === 'owner' || role === 'writer';
}

/**
 * Gets the primary calendar from a list of calendars
 * @param calendars - Array of calendars
 * @returns The primary calendar or null
 */
export function getPrimaryCalendar(calendars: any[]): any | null {
  if (!Array.isArray(calendars) || calendars.length === 0) return null;
  
  return calendars.find(cal => cal.primary === true) || calendars[0];
}
