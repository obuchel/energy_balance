// src/components/Debug/FitbitDebugTool.js
import React, { useState, useCallback, useEffect } from 'react';
import { auth, db } from '../../firebase-config'; // Adjust path as needed
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

const FitbitDebugTool = () => {
  const [user, setUser] = useState(null);
  const [debugResults, setDebugResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Listen for auth changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return unsubscribe;
  }, []);

  const runComprehensiveDebug = useCallback(async () => {
    if (!user?.uid) {
      alert('Please log in first');
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 Starting comprehensive debug analysis...');
      
      const results = {
        userInfo: {
          uid: user.uid,
          email: user.email,
          timezone: timezone
        },
        selectedDate: selectedDate,
        analysis: {},
        recommendations: []
      };

      // 1. Check all documents for the selected date
      console.log('📊 Checking timeseries documents...');
      const dateString = selectedDate.replace(/-/g, '');
      const timeseriesRef = collection(db, 'fitbit_timeseries');
      const allDocs = await getDocs(timeseriesRef);
      
      const userDocs = [];
      const timeSlots = {};
      
      allDocs.forEach((doc) => {
        const docId = doc.id;
        const docData = doc.data();
        
        if (docId.startsWith(`${user.uid}_${dateString}_`)) {
          userDocs.push({
            id: docId,
            data: docData,
            extractedTime: docId.split('_')[2] || 'unknown'
          });
          
          // Extract hour for analysis
          const timePart = docId.split('_')[2];
          if (timePart && timePart.length >= 4) {
            const hour = timePart.substring(0, 2);
            timeSlots[hour] = (timeSlots[hour] || 0) + 1;
          }
        }
      });

      results.analysis.totalDocuments = userDocs.length;
      results.analysis.timeSlots = timeSlots;
      results.analysis.documents = userDocs;

      // 2. Check for missing hours (especially 20:00-21:00)
      console.log('⏰ Analyzing time gaps...');
      const expectedHours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
      const missingHours = expectedHours.filter(hour => !timeSlots[hour]);
      const eveningGap = missingHours.includes('20') || missingHours.includes('21');
      
      results.analysis.missingHours = missingHours;
      results.analysis.eveningGapDetected = eveningGap;

      // 3. Check sync logs
      console.log('📝 Checking sync logs...');
      try {
        const syncLogsRef = collection(db, 'sync_logs');
        const syncQuery = query(
          syncLogsRef,
          where('timestamp', '>=', `${selectedDate}T00:00:00Z`),
          where('timestamp', '<=', `${selectedDate}T23:59:59Z`),
          orderBy('timestamp'),
          limit(50)
        );
        const syncDocs = await getDocs(syncQuery);
        
        const syncLogs = [];
        syncDocs.forEach((doc) => {
          syncLogs.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        results.analysis.syncLogs = syncLogs;
        
        // Check for failures during 8-9 PM
        const eveningFailures = syncLogs.filter(log => {
          const logTime = new Date(log.timestamp);
          const hour = logTime.getUTCHours();
          return (hour === 20 || hour === 21) && log.failed > 0;
        });
        
        results.analysis.eveningFailures = eveningFailures;
        
      } catch (syncError) {
        console.error('Error checking sync logs:', syncError);
        results.analysis.syncLogsError = syncError.message;
      }

      // 4. Timezone analysis
      console.log('🌍 Analyzing timezone issues...');
      const localDate = new Date(selectedDate + 'T20:00:00');
      const utcDate = new Date(localDate.toISOString());
      const timezoneOffset = localDate.getTimezoneOffset();
      
      results.analysis.timezoneInfo = {
        local8PM: localDate.toISOString(),
        utc8PM: utcDate.toISOString(),
        offsetMinutes: timezoneOffset,
        offsetHours: timezoneOffset / 60,
        expectedUTCHour: (20 - (timezoneOffset / 60)) % 24
      };

      // 5. Generate recommendations
      if (eveningGap) {
        results.recommendations.push({
          type: 'critical',
          title: 'Evening Data Gap Detected',
          description: 'Missing data between 8-9 PM. This could be due to timezone issues or sync failures.',
          action: 'Check sync logs and implement timezone-aware queries'
        });
      }

      if (results.analysis.eveningFailures?.length > 0) {
        results.recommendations.push({
          type: 'error',
          title: 'Sync Failures During Evening Hours',
          description: `Found ${results.analysis.eveningFailures.length} sync failures during evening hours.`,
          action: 'Review error logs and implement retry mechanism'
        });
      }

      if (Math.abs(timezoneOffset) > 0) {
        results.recommendations.push({
          type: 'warning',
          title: 'Timezone Offset Detected',
          description: `Your timezone offset is ${timezoneOffset / 60} hours. Document IDs use UTC time.`,
          action: 'Ensure queries account for timezone differences'
        });
      }

      console.log('✅ Debug analysis complete:', results);
      setDebugResults(results);

    } catch (error) {
      console.error('❌ Debug analysis failed:', error);
      setDebugResults({
        error: error.message,
        userInfo: { uid: user?.uid, email: user?.email }
      });
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate, timezone]);

  const runTimezoneFixedQuery = useCallback(async () => {
    if (!user?.uid) return;

    try {
      console.log('🔧 Running timezone-aware query...');
      
      // Convert local 8-9 PM to UTC for document ID query
      const localDate = new Date(selectedDate);
      const local8PM = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 20, 0, 0);
      const local9PM = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 21, 0, 0);
      
      // Convert to UTC
      const utc8PM = new Date(local8PM.getTime() - (local8PM.getTimezoneOffset() * 60000));
      const utc9PM = new Date(local9PM.getTime() - (local9PM.getTimezoneOffset() * 60000));
      
      // Format for document ID search
      const startDocId = `${user.uid}_${utc8PM.toISOString().slice(0, 10).replace(/-/g, '')}_${utc8PM.toISOString().slice(11, 19).replace(/:/g, '')}`;
      const endDocId = `${user.uid}_${utc9PM.toISOString().slice(0, 10).replace(/-/g, '')}_${utc9PM.toISOString().slice(11, 19).replace(/:/g, '')}`;
      
      console.log('🔍 Searching for documents between:', startDocId, 'and', endDocId);
      
      const timeseriesRef = collection(db, 'fitbit_timeseries');
      const allDocs = await getDocs(timeseriesRef);
      
      const foundDocs = [];
      allDocs.forEach((doc) => {
        const docId = doc.id;
        if (docId >= startDocId && docId <= endDocId) {
          foundDocs.push({
            id: docId,
            data: doc.data()
          });
        }
      });
      
      console.log('🎯 Timezone-aware query found:', foundDocs.length, 'documents');
      
      setDebugResults(prev => ({
        ...prev,
        timezoneFixedQuery: {
          searchRange: { startDocId, endDocId },
          localTimes: { local8PM: local8PM.toISOString(), local9PM: local9PM.toISOString() },
          utcTimes: { utc8PM: utc8PM.toISOString(), utc9PM: utc9PM.toISOString() },
          foundDocuments: foundDocs
        }
      }));
      
    } catch (error) {
      console.error('❌ Timezone-aware query failed:', error);
    }
  }, [user, selectedDate]);

  // Copy the rest of your component JSX here...
  // [Include all the JSX from the artifact - the return statement with all the UI]

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen">
      {/* Rest of your component JSX... */}
      {!user ? (
        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">🔍 Fitbit Debug Tool</h1>
          <p className="text-gray-600">Please log in to use the debug tool.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">🔍 Fitbit Data Debug Tool</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date to Analyze</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Timezone</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">User</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600">
                  {user.email || user.uid.substring(0, 8) + '...'}
                </div>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={runComprehensiveDebug}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Analyzing...
                  </>
                ) : (
                  <>🔍 Run Full Debug</>
                )}
              </button>
              
              {debugResults && (
                <button
                  onClick={runTimezoneFixedQuery}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  🌍 Test Timezone Fix
                </button>
              )}
            </div>
          </div>

          {/* Results display */}
          {debugResults && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Debug Results</h2>
              <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto">
                {JSON.stringify(debugResults, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FitbitDebugTool;