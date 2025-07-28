// timezone-utils.js
// Centralized timezone handling utilities for consistent date/time operations

/**
 * Gets the user's current timezone
 */
export const getUserTimezone = () => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  };
  
  /**
   * Gets today's date in the user's timezone in YYYY-MM-DD format
   */
  export const getTodayInUserTimezone = () => {
    const userTimezone = getUserTimezone();
    const today = new Date();
    return today.toLocaleDateString('en-CA', { timeZone: userTimezone });
  };
  
  /**
   * Gets a date X days ago in the user's timezone in YYYY-MM-DD format
   */
  export const getDaysAgoInUserTimezone = (daysAgo) => {
    const userTimezone = getUserTimezone();
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toLocaleDateString('en-CA', { timeZone: userTimezone });
  };
  
  /**
   * Converts a date string to a Date object safely (without timezone shifts)
   */
  export const parseLocalDate = (dateString) => {
    if (!dateString) return null;
    
    // Handle YYYY-MM-DD format specifically to avoid timezone issues
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    
    return new Date(dateString);
  };
  
  /**
   * Formats a Date object to YYYY-MM-DD string in user's timezone
   */
  export const formatDateForComparison = (date) => {
    if (!date) return '';
    
    const userTimezone = getUserTimezone();
    return date.toLocaleDateString('en-CA', { timeZone: userTimezone });
  };
  
  /**
   * Safely compares two date strings (YYYY-MM-DD format)
   * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
   */
  export const compareDateStrings = (dateString1, dateString2) => {
    if (!dateString1 || !dateString2) return 0;
    
    const date1 = parseLocalDate(dateString1);
    const date2 = parseLocalDate(dateString2);
    
    if (!date1 || !date2) return 0;
    
    return date1 < date2 ? -1 : date1 > date2 ? 1 : 0;
  };
  
  /**
   * Checks if date1 is same or after date2
   */
  export const isSameOrAfter = (dateString1, dateString2) => {
    return compareDateStrings(dateString1, dateString2) >= 0;
  };
  
  /**
   * Checks if a date string is today
   */
  export const isToday = (dateString) => {
    const today = getTodayInUserTimezone();
    return dateString === today;
  };
  
  /**
   * Gets a range of dates for the last N days (including today)
   */
  export const getLastNDaysRange = (days = 7) => {
    const dates = [];
    const userTimezone = getUserTimezone();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toLocaleDateString('en-CA', { timeZone: userTimezone });
      dates.push(dateString);
    }
    
    return dates;
  };
  
  /**
   * Formats a date string for display (e.g., "Today", "Yesterday", or "12/25")
   */
  export const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    
    const today = getTodayInUserTimezone();
    const yesterday = getDaysAgoInUserTimezone(1);
    
    if (dateString === today) {
      return 'Today';
    } else if (dateString === yesterday) {
      return 'Yesterday';
    } else {
      // Format as MM/DD
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        return `${month}/${day}`;
      }
      return dateString;
    }
  };
  
  /**
   * Gets a readable date header for grouping (e.g., "Today - Friday, December 25, 2024")
   */
  export const formatDateHeader = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = parseLocalDate(dateString);
      if (!date) return dateString;
      
      const today = getTodayInUserTimezone();
      const yesterday = getDaysAgoInUserTimezone(1);
      
      const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      const formattedDate = date.toLocaleDateString('en-US', options);
      
      if (dateString === today) {
        return `Today - ${formattedDate}`;
      } else if (dateString === yesterday) {
        return `Yesterday - ${formattedDate}`;
      } else {
        return formattedDate;
      }
    } catch (error) {
      console.warn('Error formatting date header:', error);
      return dateString;
    }
  };
  
  /**
   * Gets the current time in user's timezone as HH:MM format
   */
  export const getCurrentTimeInUserTimezone = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  /**
   * Converts 12-hour time format to 24-hour format
   */
  export const convertTo24Hour = (time12h) => {
    if (!time12h) return '';
    
    const [time, modifier] = time12h.split(' ');
    if (!time || !modifier) return time12h;
    
    let [hours, minutes] = time.split(':');
    
    if (hours === '12') {
      hours = '00';
    }
    
    if (modifier.toUpperCase() === 'PM') {
      hours = String(parseInt(hours, 10) + 12);
    }
    
    hours = String(hours);
    
    return `${hours.padStart(2, '0')}:${minutes}`;
  };
  
  /**
   * Converts 24-hour time format to 12-hour format
   */
  export const convertTo12Hour = (time24h) => {
    if (!time24h) return '';
    
    const [hours, minutes] = time24h.split(':');
    const hour24 = parseInt(hours, 10);
    
    if (hour24 === 0) {
      return `12:${minutes} AM`;
    } else if (hour24 < 12) {
      return `${hour24}:${minutes} AM`;
    } else if (hour24 === 12) {
      return `12:${minutes} PM`;
    } else {
      return `${hour24 - 12}:${minutes} PM`;
    }
  };
  
  /**
   * Gets the start and end dates for a given week (Monday to Sunday)
   */
  export const getWeekDateRange = (dateString) => {
    const date = parseLocalDate(dateString);
    if (!date) return null;
    
    const dayOfWeek = date.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, Monday = 1
    
    const monday = new Date(date);
    monday.setDate(date.getDate() + mondayOffset);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
      start: formatDateForComparison(monday),
      end: formatDateForComparison(sunday)
    };
  };
  
  /**
   * Gets all dates in a given month in user's timezone
   */
  export const getMonthDateRange = (year, month) => {
    const dates = [];
    const userTimezone = getUserTimezone();
    
    // Get first and last day of month
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month - 1, day);
      const dateString = date.toLocaleDateString('en-CA', { timeZone: userTimezone });
      dates.push(dateString);
    }
    
    return dates;
  };
  
  /**
   * Checks if two date strings are in the same week
   */
  export const isSameWeek = (dateString1, dateString2) => {
    const week1 = getWeekDateRange(dateString1);
    const week2 = getWeekDateRange(dateString2);
    
    if (!week1 || !week2) return false;
    
    return week1.start === week2.start && week1.end === week2.end;
  };
  
  /**
   * Gets a human-readable relative time string (e.g., "2 days ago", "in 3 days")
   */
  export const getRelativeTimeString = (dateString) => {
    const targetDate = parseLocalDate(dateString);
    const today = parseLocalDate(getTodayInUserTimezone());
    
    if (!targetDate || !today) return dateString;
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1) return `In ${diffDays} days`;
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
    
    return dateString;
  };
  
  /**
   * Debug function to log timezone information
   */
  export const debugTimezone = (context = '') => {
    const userTimezone = getUserTimezone();
    const now = new Date();
    const localToday = getTodayInUserTimezone();
    const utcToday = now.toISOString().split('T')[0];
    
    console.log(`🌍 Timezone Debug ${context}:`, {
      userTimezone,
      localToday,
      utcToday,
      timezoneOffset: now.getTimezoneOffset(),
      localTime: now.toLocaleString(),
      utcTime: now.toUTCString()
    });
    
    return {
      userTimezone,
      localToday,
      utcToday,
      timezoneOffset: now.getTimezoneOffset(),
      localTime: now.toLocaleString(),
      utcTime: now.toUTCString()
    };
  };
  
  /**
   * Validates if a date string is in the correct YYYY-MM-DD format
   */
  export const isValidDateString = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return false;
    
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = parseLocalDate(dateString);
    if (!date || isNaN(date.getTime())) return false;
    
    // Check if the parsed date matches the input (prevents invalid dates like 2023-02-30)
    const formatted = formatDateForComparison(date);
    return formatted === dateString;
  };
  
  /**
   * Gets the timezone offset string (e.g., "UTC-5", "UTC+2")
   */
  export const getTimezoneOffsetString = () => {
    const now = new Date();
    const offsetMinutes = now.getTimezoneOffset();
    const offsetHours = Math.abs(offsetMinutes) / 60;
    const sign = offsetMinutes <= 0 ? '+' : '-';
    
    return `UTC${sign}${offsetHours}`;
  };
  
  /**
   * Converts a UTC timestamp to user's local date string
   */
  export const utcTimestampToLocalDate = (timestamp) => {
    const date = new Date(timestamp);
    return formatDateForComparison(date);
  };
  
  /**
   * Gets a date range for analytics (last 7, 30, 90 days, etc.)
   */
  export const getAnalyticsDateRange = (period) => {
    const today = getTodayInUserTimezone();
    let daysBack;
    
    switch (period) {
      case 'week': daysBack = 7; break;
      case 'month': daysBack = 30; break;
      case 'quarter': daysBack = 90; break;
      case 'year': daysBack = 365; break;
      default: daysBack = 7;
    }
    
    const startDate = getDaysAgoInUserTimezone(daysBack - 1);
    
    return {
      start: startDate,
      end: today,
      dates: getLastNDaysRange(daysBack)
    };
  };
  
  // Export default object with all functions for convenience
  export default {
    getUserTimezone,
    getTodayInUserTimezone,
    getDaysAgoInUserTimezone,
    parseLocalDate,
    formatDateForComparison,
    compareDateStrings,
    isSameOrAfter,
    isToday,
    getLastNDaysRange,
    formatDateForDisplay,
    formatDateHeader,
    getCurrentTimeInUserTimezone,
    convertTo24Hour,
    convertTo12Hour,
    getWeekDateRange,
    getMonthDateRange,
    isSameWeek,
    getRelativeTimeString,
    debugTimezone,
    isValidDateString,
    getTimezoneOffsetString,
    utcTimestampToLocalDate,
    getAnalyticsDateRange
  };