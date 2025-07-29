import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AlertCircle, Plus, X, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase-config';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import "../Common.css";
import './SymptomTracker.css'; // Import the CSS file

const LongCovidTracker = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(() => {
    // Use local date formatting to avoid timezone issues
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [symptomData, setSymptomData] = useState({});
  const [customSymptoms, setCustomSymptoms] = useState({});
  const [showAddSymptom, setShowAddSymptom] = useState(false);
  const [newSymptomName, setNewSymptomName] = useState('');
  const [newSymptomDescription, setNewSymptomDescription] = useState('');
  const [syncStatus, setSyncStatus] = useState('synced');
  const [loading, setLoading] = useState(true); // Initialize loading to true
  const [lastSyncDate, setLastSyncDate] = useState(null);
  const [error, setError] = useState(null);
  const [ongoingSymptoms, setOngoingSymptoms] = useState({});
  const [showOngoingModal, setShowOngoingModal] = useState(false);
  const [selectedOngoingSymptom, setSelectedOngoingSymptom] = useState(null);

  // Stable refs
  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef(null);

  // Helper function to get local date string (consistent with other pages)
  const getLocalDateString = useCallback((date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Static data
  const severityLevels = useMemo(() => [
    { value: 0, label: 'None', color: '#f3f4f6', textColor: '#6b7280' },
    { value: 1, label: 'Mild', color: '#dbeafe', textColor: '#1e40af' },
    { value: 2, label: 'Mild-Moderate', color: '#a5b4fc', textColor: '#312e81' },
    { value: 3, label: 'Moderate', color: '#c084fc', textColor: '#581c87' },
    { value: 4, label: 'Moderate-Severe', color: '#f472b6', textColor: '#831843' },
    { value: 5, label: 'Severe', color: '#fca5a5', textColor: '#7f1d1d' }
  ], []);

  const defaultSymptomCategories = useMemo(() => ({
    neurological: {
      title: 'Neurological',
      icon: '🧠',
      symptoms: {
        brain_fog: { name: 'Brain Fog', description: 'Difficulty concentrating, memory issues' },
        headache: { name: 'Headache', description: 'Head pain, pressure, tension' },
        dizziness: { name: 'Dizziness', description: 'Lightheadedness, vertigo' }
      }
    },
    energy: {
      title: 'Energy & Fatigue',
      icon: '⚡',
      symptoms: {
        fatigue: { name: 'General Fatigue', description: 'Overall tiredness, lack of energy' },
        pem: { name: 'Post-Exertional Malaise', description: 'Worsening after activity' },
        sleep_issues: { name: 'Sleep Problems', description: 'Insomnia, poor sleep quality' }
      }
    },
    cardiovascular: {
      title: 'Cardiovascular',
      icon: '❤️',
      symptoms: {
        pots: { name: 'POTS Symptoms', description: 'Heart rate spikes when standing' },
        chest_pain: { name: 'Chest Pain', description: 'Chest discomfort, tightness' },
        palpitations: { name: 'Heart Palpitations', description: 'Irregular heartbeat' }
      }
    },
    custom: {
      title: 'Custom Symptoms',
      icon: '📝',
      symptoms: {}
    }
  }), []);

  // Combine default and custom symptoms
  const symptomCategories = useMemo(() => {
    const combined = { ...defaultSymptomCategories };
    combined.custom.symptoms = { ...customSymptoms };
    return combined;
  }, [defaultSymptomCategories, customSymptoms]);

  // Helper functions for ongoing symptoms
  const isSymptomOngoing = useCallback((symptomId) => {
    return ongoingSymptoms[symptomId]?.active || false;
  }, [ongoingSymptoms]);

  const getOngoingDuration = useCallback((symptomId) => {
    const ongoing = ongoingSymptoms[symptomId];
    if (!ongoing || !ongoing.active) return 0;
    
    const startDate = new Date(ongoing.startDate);
    const today = new Date();
    const diffTime = Math.abs(today - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [ongoingSymptoms]);

  const getSeverityColor = useCallback((severity) => {
    const severityInfo = severityLevels[severity] || severityLevels[0];
    return {
      background: severityInfo.color,
      text: severityInfo.textColor
    };
  }, [severityLevels]);

  const updateOngoingSymptom = useCallback((symptomId, updates) => {
    setOngoingSymptoms(prev => ({
      ...prev,
      [symptomId]: {
        ...prev[symptomId],
        ...updates,
        lastUpdated: new Date().toLocaleDateString()
      }
    }));
  }, []);

  const endOngoingSymptom = useCallback((symptomId) => {
    setOngoingSymptoms(prev => ({
      ...prev,
      [symptomId]: {
        ...prev[symptomId],
        active: false,
        endDate: getLocalDateString(),
        lastUpdated: new Date().toLocaleDateString()
      }
    }));
    
    if (selectedOngoingSymptom === symptomId) {
      setShowOngoingModal(false);
      setSelectedOngoingSymptom(null);
    }
  }, [selectedOngoingSymptom, getLocalDateString]);

  // Save to Firestore
  const saveToFirestore = useCallback(async (date, data) => {
    if (isSavingRef.current) return;

    try {
      isSavingRef.current = true;
      setSyncStatus('pending');
      
      // Get user ID from localStorage
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const userId = userData.id;
      
      if (!userId) {
        throw new Error('No user ID found');
      }

      // Save symptom data to Firestore
      const symptomDocRef = doc(db, 'users', userId, 'symptomData', date);
      await setDoc(symptomDocRef, {
        ...data,
        lastUpdated: new Date().toISOString(),
        userId: userId
      });
      
      // Save custom symptoms to Firestore
      const customSymptomsDocRef = doc(db, 'users', userId, 'settings', 'customSymptoms');
      await setDoc(customSymptomsDocRef, {
        symptoms: customSymptoms,
        lastUpdated: new Date().toISOString(),
        userId: userId
      });

      // Save ongoing symptoms to Firestore
      const ongoingSymptomsDocRef = doc(db, 'users', userId, 'settings', 'ongoingSymptoms');
      await setDoc(ongoingSymptomsDocRef, {
        symptoms: ongoingSymptoms,
        lastUpdated: new Date().toISOString(),
        userId: userId
      });
      
      setLastSyncDate(new Date().toISOString());
      setSyncStatus('synced');
      
    } catch (error) {
      console.error('Error saving to Firestore:', error);
      setError(`Failed to save data: ${error.message}`);
      setSyncStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, [customSymptoms, ongoingSymptoms]);

  // Load data from Firestore
  const loadFromFirestore = useCallback(async () => {
    setLoading(true); // Start loading
    try {
      // Get user ID from localStorage
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const userId = userData.id;
      
      if (!userId) {
        throw new Error('No user ID found');
      }

      // Load custom symptoms from Firestore
      const customSymptomsDocRef = doc(db, 'users', userId, 'settings', 'customSymptoms');
      const customSymptomsDoc = await getDoc(customSymptomsDocRef);
      let loadedCustomSymptoms = {};
      if (customSymptomsDoc.exists()) {
        loadedCustomSymptoms = customSymptomsDoc.data().symptoms || {};
      }

      // Load ongoing symptoms from Firestore
      const ongoingSymptomsDocRef = doc(db, 'users', userId, 'settings', 'ongoingSymptoms');
      const ongoingSymptomsDoc = await getDoc(ongoingSymptomsDocRef);
      let loadedOngoingSymptoms = {};
      if (ongoingSymptomsDoc.exists()) {
        loadedOngoingSymptoms = ongoingSymptomsDoc.data().symptoms || {};
      }

      // Load symptom data for current date from Firestore
      const symptomDocRef = doc(db, 'users', userId, 'symptomData', currentDate);
      const symptomDoc = await getDoc(symptomDocRef);
      let loadedSymptomData = {};
      if (symptomDoc.exists()) {
        loadedSymptomData[currentDate] = symptomDoc.data();
      }

      // Load previous symptom data (last 30 days) for better user experience
      const promises = [];
      for (let i = 1; i <= 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = getLocalDateString(date);
        
        const docRef = doc(db, 'users', userId, 'symptomData', dateStr);
        promises.push(
          getDoc(docRef).then(doc => {
            if (doc.exists()) {
              return { date: dateStr, data: doc.data() };
            }
            return null;
          }).catch(err => {
            console.warn(`Failed to load data for ${dateStr}:`, err);
            return null;
          })
        );
      }

      const historicalData = await Promise.allSettled(promises);
      historicalData.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          loadedSymptomData[result.value.date] = result.value.data;
        }
      });
      
      setSymptomData(loadedSymptomData);
      setCustomSymptoms(loadedCustomSymptoms);
      setOngoingSymptoms(loadedOngoingSymptoms);
      setLastSyncDate(new Date().toISOString());
      setSyncStatus('synced');
      
    } catch (error) {
      console.error('Error loading from Firestore:', error);
      setError(`Failed to load symptom data: ${error.message}`);
      setSyncStatus('error');
      
      // Fallback to localStorage if Firestore fails
      try {
        const existingData = JSON.parse(localStorage.getItem('symptomTrackerData') || '{}');
        const savedCustomSymptoms = JSON.parse(localStorage.getItem('customSymptoms') || '{}');
        const savedOngoingSymptoms = JSON.parse(localStorage.getItem('ongoingSymptoms') || '{}');
        
        setSymptomData(existingData);
        setCustomSymptoms(savedCustomSymptoms);
        setOngoingSymptoms(savedOngoingSymptoms);
        
        console.log('Loaded data from localStorage as fallback');
      } catch (fallbackError) {
        console.error('Failed to load from localStorage fallback:', fallbackError);
      }
    } finally {
      setLoading(false); // End loading
    }
  }, [currentDate, getLocalDateString]);

  // Load symptom data for a specific date
  const loadSymptomDataForDate = useCallback(async (date) => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const userId = userData.id;
      
      if (!userId) return;

      // Check if we already have this date's data
      if (symptomData[date]) return;

      // Load from Firestore
      const symptomDocRef = doc(db, 'users', userId, 'symptomData', date);
      const symptomDoc = await getDoc(symptomDocRef);
      
      if (symptomDoc.exists()) {
        setSymptomData(prev => ({
          ...prev,
          [date]: symptomDoc.data()
        }));
      }
    } catch (error) {
      console.error(`Error loading data for ${date}:`, error);
    }
  }, [symptomData]);

  // Load data when date changes
  useEffect(() => {
    loadSymptomDataForDate(currentDate);
  }, [currentDate, loadSymptomDataForDate]);

  // Debounced save with stable reference
  const triggerSave = useCallback((date, data) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (!isSavingRef.current) {
        saveToFirestore(date, data);
      }
    }, 1000);
  }, [saveToFirestore]);

  // Initialize tracker
  useEffect(() => {
    loadFromFirestore();
  }, [loadFromFirestore]);

  // Auto-save effect
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userId = userData.id;
    
    if (userId && symptomData[currentDate] && !isSavingRef.current) {
      triggerSave(currentDate, symptomData[currentDate]);
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [symptomData, currentDate, triggerSave]);

  // Stable data access functions
  const getCurrentEntry = useCallback(() => {
    return symptomData[currentDate] || {
      symptoms: {},
      notes: '',
      overallWellbeing: 3,
      timestamp: new Date().toISOString()
    };
  }, [symptomData, currentDate]);

  const getSymptomInstances = useCallback((symptomId) => {
    const entry = getCurrentEntry();
    const symptomData = entry.symptoms[symptomId];
    
    // Handle migration from old format to new format
    if (!symptomData) {
      return [];
    }
    
    // If it's already an array of instances, return it
    if (Array.isArray(symptomData)) {
      return symptomData;
    }
    
    // If it's old format (single object), convert to new format
    if (typeof symptomData === 'object' && symptomData.severity !== undefined) {
      return [{
        id: Date.now().toString(),
        severity: symptomData.severity || 0,
        startTime: symptomData.startTime || '',
        duration: symptomData.duration || '',
        triggers: symptomData.triggers || [],
        timestamp: symptomData.timestamp || new Date().toISOString()
      }];
    }
    
    return [];
  }, [getCurrentEntry]);

  // Update functions with stable references
  const updateCurrentEntry = useCallback((updates) => {
    const currentEntry = getCurrentEntry();
    const updatedEntry = {
      ...currentEntry,
      ...updates,
      timestamp: new Date().toISOString()
    };
    
    setSymptomData(prev => ({
      ...prev,
      [currentDate]: updatedEntry
    }));
  }, [currentDate, getCurrentEntry]);

  const addSymptomInstance = useCallback((symptomId) => {
    const currentEntry = getCurrentEntry();
    const instances = getSymptomInstances(symptomId);
    const newInstance = {
      id: Date.now().toString(),
      severity: 1,
      startTime: new Date().toTimeString().slice(0, 5),
      duration: '',
      triggers: [],
      timestamp: new Date().toISOString()
    };
    
    updateCurrentEntry({
      symptoms: { 
        ...currentEntry.symptoms, 
        [symptomId]: [...instances, newInstance]
      }
    });
  }, [getCurrentEntry, getSymptomInstances, updateCurrentEntry]);

  const updateSymptomInstance = useCallback((symptomId, instanceId, updates) => {
    const currentEntry = getCurrentEntry();
    const instances = getSymptomInstances(symptomId);
    const updatedInstances = instances.map(instance => 
      instance.id === instanceId ? { ...instance, ...updates } : instance
    );
    
    updateCurrentEntry({
      symptoms: { 
        ...currentEntry.symptoms, 
        [symptomId]: updatedInstances
      }
    });
  }, [getCurrentEntry, getSymptomInstances, updateCurrentEntry]);

  const removeSymptomInstance = useCallback((symptomId, instanceId) => {
    const currentEntry = getCurrentEntry();
    const instances = getSymptomInstances(symptomId);
    const filteredInstances = instances.filter(instance => instance.id !== instanceId);
    
    updateCurrentEntry({
      symptoms: { 
        ...currentEntry.symptoms, 
        [symptomId]: filteredInstances
      }
    });
  }, [getCurrentEntry, getSymptomInstances, updateCurrentEntry]);

  const updateWellbeing = useCallback((rating) => {
    updateCurrentEntry({ overallWellbeing: rating });
  }, [updateCurrentEntry]);

  const updateNotes = useCallback((notes) => {
    updateCurrentEntry({ notes });
  }, [updateCurrentEntry]);

  // Custom symptom management
  const addCustomSymptom = useCallback(() => {
    if (!newSymptomName.trim()) return;
    
    const symptomId = newSymptomName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const newSymptom = {
      name: newSymptomName.trim(),
      description: newSymptomDescription.trim() || 'Custom symptom',
      isCustom: true
    };
    
    setCustomSymptoms(prev => ({
      ...prev,
      [symptomId]: newSymptom
    }));
    
    setNewSymptomName('');
    setNewSymptomDescription('');
    setShowAddSymptom(false);
  }, [newSymptomName, newSymptomDescription]);

  const removeCustomSymptom = useCallback((symptomId) => {
    setCustomSymptoms(prev => {
      const newCustom = { ...prev };
      delete newCustom[symptomId];
      return newCustom;
    });
    
    // Also remove from all entries
    setSymptomData(prev => {
      const newData = { ...prev };
      Object.keys(newData).forEach(date => {
        if (newData[date].symptoms[symptomId]) {
          const newEntry = { ...newData[date] };
          delete newEntry.symptoms[symptomId];
          newData[date] = newEntry;
        }
      });
      return newData;
    });
  }, []);

  // Navigation functions
  const handleLogout = useCallback(async () => {
    console.log('Logout clicked - starting complete logout process');
    
    try {
      // Clear only user authentication data from localStorage
      // Symptom data stays in Firestore
      console.log('Clearing localStorage userData');
      localStorage.removeItem('userData');
      
      // Clear sessionStorage
      sessionStorage.clear();
      console.log('Cleared sessionStorage');
      
      console.log('Complete logout finished, navigating to login...');
      
      // Use React Router navigation instead of window.location
      navigate('/login', { replace: true });
      
    } catch (error) {
      console.error('Error during logout:', error);
      
      // Even if something fails, still clear local data and redirect
      localStorage.removeItem('userData');
      sessionStorage.clear();
      
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleBackToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const retrySync = useCallback(async () => {
    loadFromFirestore();
  }, [loadFromFirestore]);

  // Memoized components
  const SyncStatusIndicator = useMemo(() => {
    const statusConfig = {
      synced: { icon: '✅', text: 'Synced', color: '#059669' },
      pending: { icon: '⏳', text: 'Syncing...', color: '#d97706' },
      error: { icon: '❌', text: 'Sync Error', color: '#dc2626' }
    };
    const config = statusConfig[syncStatus];
    
    return (
      <div className="sync-status" style={{ color: config.color }}>
        <span>{config.icon}</span>
        <span>{config.text}</span>
        {lastSyncDate && syncStatus === 'synced' && (
          <span className="sync-time">
            {new Date(lastSyncDate).toLocaleTimeString()}
          </span>
        )}
        {syncStatus === 'error' && (
          <button onClick={retrySync} className="retry-btn">
            Retry
          </button>
        )}
      </div>
    );
  }, [syncStatus, lastSyncDate, retrySync]);

  // Enhanced SymptomCard component with multiple instances support
  const SymptomCard = React.memo(({ symptomId, symptom, categoryKey }) => {
    const instances = getSymptomInstances(symptomId) || [];
    const hasInstances = instances.length > 0;
    const maxSeverity = hasInstances ? Math.max(...instances.map(i => i.severity || 0)) : 0;
    const severityInfo = severityLevels[maxSeverity];

    return (
      <div className="symptom-card">
        {/* Custom symptom delete button */}
        {symptom.isCustom && (
          <button
            onClick={() => removeCustomSymptom(symptomId)}
            className="delete-custom-btn"
            title="Remove custom symptom"
          >
            <X size={12} />
          </button>
        )}

        {/* Symptom header */}
        <div className="symptom-header">
          <h4 className="symptom-name">
            {symptom.name}
          </h4>
          {isSymptomOngoing(symptomId) && (
            <span className="ongoing-badge">
              ONGOING
            </span>
          )}
        </div>
        
        <div className="symptom-description">
          {symptom.description}
          {symptom.isCustom && (
            <span className="custom-badge">
              Custom
            </span>
          )}
        </div>
        
        {hasInstances && (
          <div 
            className="severity-badge"
            style={{
              background: severityInfo.color,
              color: severityInfo.textColor
            }}
          >
            Max: {severityInfo.label} ({maxSeverity}) • {instances.length} instance{instances.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Instances */}
        {instances.map((instance, index) => (
          <SymptomInstance
            key={instance.id}
            instance={instance}
            instanceIndex={index}
            symptomId={symptomId}
            onUpdate={updateSymptomInstance}
            onRemove={removeSymptomInstance}
            severityLevels={severityLevels}
          />
        ))}

        {/* Add instance button */}
        <button
          onClick={() => addSymptomInstance(symptomId)}
          className="add-instance-btn"
        >
          <Plus size={16} />
          {instances.length === 0 ? 'Log this symptom' : 'Add another instance'}
        </button>
      </div>
    );
  });

  // Individual symptom instance component
  const SymptomInstance = React.memo(({ instance, instanceIndex, symptomId, onUpdate, onRemove, severityLevels }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [newTrigger, setNewTrigger] = useState('');
    const [localStartTime, setLocalStartTime] = useState(instance.startTime || '');
    const [localDuration, setLocalDuration] = useState(instance.duration || '');

    const severityInfo = severityLevels[instance.severity];

    React.useEffect(() => {
      setLocalStartTime(instance.startTime || '');
      setLocalDuration(instance.duration || '');
    }, [instance.startTime, instance.duration]);

    const handleLevelClick = useCallback((level) => {
      onUpdate(symptomId, instance.id, { severity: level });
    }, [symptomId, instance.id, onUpdate]);

    const handleAdjust = useCallback((direction) => {
      const newLevel = direction === 'increase' 
        ? Math.min(instance.severity + 1, 5)
        : Math.max(instance.severity - 1, 0);
      onUpdate(symptomId, instance.id, { severity: newLevel });
    }, [symptomId, instance.id, instance.severity, onUpdate]);

    const handleStartTimeBlur = useCallback(() => {
      onUpdate(symptomId, instance.id, { startTime: localStartTime });
    }, [symptomId, instance.id, localStartTime, onUpdate]);

    const handleDurationBlur = useCallback(() => {
      onUpdate(symptomId, instance.id, { duration: localDuration });
    }, [symptomId, instance.id, localDuration, onUpdate]);

    const addTrigger = useCallback((e) => {
      e.preventDefault();
      if (newTrigger.trim()) {
        const currentTriggers = instance.triggers || [];
        onUpdate(symptomId, instance.id, { 
          triggers: [...currentTriggers, newTrigger.trim()] 
        });
        setNewTrigger('');
      }
    }, [symptomId, instance.id, newTrigger, instance.triggers, onUpdate]);

    const removeTrigger = useCallback((triggerIndex) => {
      const currentTriggers = instance.triggers || [];
      const updatedTriggers = currentTriggers.filter((_, i) => i !== triggerIndex);
      onUpdate(symptomId, instance.id, { triggers: updatedTriggers });
    }, [symptomId, instance.id, instance.triggers, onUpdate]);

    return (
      <div className="symptom-instance">
        {/* Instance header */}
        <div className="instance-header">
          <div className="instance-time-info">
            <Clock size={14} />
            <span className="instance-time">
              {instance.startTime || 'No time set'}
            </span>
            {instance.duration && (
              <span className="instance-duration">
                {instance.duration}
              </span>
            )}
          </div>
          <button
            onClick={() => onRemove(symptomId, instance.id)}
            className="remove-instance-btn"
            title="Remove this instance"
          >
            <X size={16} />
          </button>
        </div>

        {/* Severity indicator */}
        <div 
          className="instance-severity-badge"
          style={{
            background: severityInfo.color,
            color: severityInfo.textColor
          }}
        >
          {severityInfo.label} ({instance.severity})
        </div>
        
        {/* Severity controls */}
        <div className="severity-controls">
          <button 
            onClick={() => handleAdjust('decrease')}
            disabled={instance.severity === 0}
            className={`severity-adjust-btn ${instance.severity === 0 ? 'disabled' : ''}`}
          >
            ➖
          </button>
          
          <div className="severity-dots">
            {[1, 2, 3, 4, 5].map(level => (
              <div
                key={level}
                onClick={() => handleLevelClick(level)}
                className={`severity-dot ${level <= instance.severity ? 'active' : ''}`}
              />
            ))}
          </div>
          
          <button 
            onClick={() => handleAdjust('increase')}
            disabled={instance.severity === 5}
            className={`severity-adjust-btn ${instance.severity === 5 ? 'disabled' : ''}`}
          >
            ➕
          </button>
        </div>

        {/* Details toggle */}
        {instance.severity > 0 && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="details-toggle-btn"
          >
            {showDetails ? '📋 Hide Details' : '📋 Add Details'}
          </button>
        )}

        {/* Details section */}
        {showDetails && instance.severity > 0 && (
          <div className="instance-details">
            <div className="detail-field">
              <label className="detail-label">
                Start Time
              </label>
              <input
                type="time"
                value={localStartTime}
                onChange={(e) => setLocalStartTime(e.target.value)}
                onBlur={handleStartTimeBlur}
                className="detail-input"
              />
            </div>

            <div className="detail-field">
              <label className="detail-label">
                Duration
              </label>
              <input
                type="text"
                value={localDuration}
                onChange={(e) => setLocalDuration(e.target.value)}
                onBlur={handleDurationBlur}
                placeholder="e.g., 2 hours, 30 minutes"
                className="detail-input"
              />
            </div>

            <div className="detail-field">
              <label className="detail-label">
                Triggers
              </label>
              
              {instance.triggers && instance.triggers.length > 0 && (
                <div className="triggers-list">
                  {instance.triggers.map((trigger, index) => (
                    <div key={index} className="trigger-item">
                      <span>{trigger}</span>
                      <button
                        onClick={() => removeTrigger(index)}
                        className="remove-trigger-btn"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={addTrigger} className="add-trigger-form">
                <input
                  type="text"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  placeholder="Add trigger"
                  className="trigger-input"
                />
                <button
                  type="submit"
                  disabled={!newTrigger.trim()}
                  className={`add-trigger-btn ${!newTrigger.trim() ? 'disabled' : ''}`}
                >
                  Add
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  });

  // Add custom symptom modal
  const AddSymptomModal = React.memo(() => {
    const handleClose = useCallback(() => {
      setShowAddSymptom(false);
      setNewSymptomName('');
      setNewSymptomDescription('');
    }, []);

    const handleSubmit = useCallback((e) => {
      e.preventDefault();
      addCustomSymptom();
    }, []);

    if (!showAddSymptom) return null;

    return (
      <div className="modal-overlay">
        
        <div className="modal-content">
   
          <div className="modal-header">
     
            <h3 className="modal-title">
              Add Custom Symptom
            </h3>
            <button
              onClick={handleClose}
              className="modal-close-btn"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label">
                Symptom Name *
              </label>
              <input
                type="text"
                value={newSymptomName}
                onChange={(e) => setNewSymptomName(e.target.value)}
                placeholder="e.g., Joint Pain, Nausea, Tinnitus"
                autoFocus
                className="form-input"
              />
            </div>

            <div className="form-field">
              <label className="form-label">
                Description (optional)
              </label>
              <textarea
                value={newSymptomDescription}
                onChange={(e) => setNewSymptomDescription(e.target.value)}
                placeholder="Describe the symptom to help with tracking..."
                className="form-textarea"
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newSymptomName.trim()}
                className={`btn-primary ${!newSymptomName.trim() ? 'disabled' : ''}`}
              >
                Add Symptom
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  });

  // Loading state
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner" />
          <p className="loading-text">Loading symptom tracker...</p>
        </div>
      </div>
    );
  }

  // Error state for missing user ID
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const userId = userData.id;
  
  if (error && !userId) { // Only show this specific error if there's an error and no user ID
    return (
      <div className="error-container">
        <div className="error-content">
          <AlertCircle size={48} className="error-icon" />
          <p className="error-message">
            {error}
          </p>
          <button
            onClick={() => navigate('/dashboard')} // Use navigate instead of window.location.href
            className="btn-primary"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Get current entry for display
  const currentEntry = getCurrentEntry();

  return (
    <div className="tracker-container">
    <div className="tracker-content">
      {/* Animated background elements - similar to SignIn card-glow */}
      <div className="bg-animation">
      <div className="card-glow"></div>  {/* Inside the styled container */}
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
        <div className="floating-shape shape-4"></div>
        <div className="floating-shape shape-5"></div>
        <div className="floating-shape shape-6"></div>
      </div>
        {/* Header */}
        <div className="header">
          <div className="header-left">
            <h1 className="main-title">
              Long COVID Symptom Tracker
            </h1>
            <div className="header-info">
              <span className="current-date">📅 {new Date(currentDate).toLocaleDateString()}</span>
              {SyncStatusIndicator}
            </div>
          </div>
          <div className="header-actions">
            <button
              onClick={() => setShowAddSymptom(true)}
              className="btn-primary header-btn"
            >
              <Plus size={16} />
              Add Symptom
            </button>
            <button
              onClick={handleBackToDashboard}
              className="btn-secondary header-btn"
            >
              🏠 Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="btn-danger header-btn"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="date-navigation">
          <button
            onClick={() => {
              const date = new Date(currentDate);
              date.setDate(date.getDate() - 1);
              setCurrentDate(getLocalDateString(date));
            }}
            className="date-nav-btn"
          >
            ← Previous Day
          </button>
          
          <input
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            max={getLocalDateString()}
            className="date-input"
          />
          
          <button
            onClick={() => {
              const date = new Date(currentDate);
              const today = new Date();
              if (date < today) {
                date.setDate(date.getDate() + 1);
                setCurrentDate(getLocalDateString(date));
              }
            }}
            disabled={currentDate === getLocalDateString()}
            className={`date-nav-btn ${currentDate === getLocalDateString() ? 'disabled' : ''}`}
          >
            Next Day →
          </button>
        </div>

        {/* Ongoing Symptoms Section */}
        {Object.keys(ongoingSymptoms).filter(key => ongoingSymptoms[key].active).length > 0 && (
          <div className="ongoing-symptoms-section">
            <h3 className="ongoing-title">
              <Clock size={20} />
              Ongoing Symptoms
            </h3>
            <div className="ongoing-symptoms-list">
              {Object.entries(ongoingSymptoms)
                .filter(([_, ongoing]) => ongoing.active)
                .map(([symptomKey, ongoing]) => {
                  const allSymptoms = Object.values(symptomCategories).reduce((acc, cat) => ({...acc, ...cat.symptoms}), {});
                  const symptom = allSymptoms[symptomKey];
                  const duration = getOngoingDuration(symptomKey);
                  
                  return (
                    <div key={symptomKey} className="ongoing-symptom-item">
                      <div className="ongoing-symptom-info">
                        <div className="ongoing-symptom-header">
                          <span className="ongoing-symptom-name">
                            {symptom?.name || symptomKey}
                          </span>
                          <span 
                            className="ongoing-severity-badge"
                            style={{
                              background: getSeverityColor(ongoing.currentSeverity).background,
                              color: getSeverityColor(ongoing.currentSeverity).text
                            }}
                          >
                            Severity {ongoing.currentSeverity}
                          </span>
                        </div>
                        <div className="ongoing-symptom-details">
                          Started {ongoing.startDate} • Day {duration} • Last updated {ongoing.lastUpdated}
                        </div>
                      </div>
                      <div className="ongoing-symptom-actions">
                        <button
                          onClick={() => {
                            setSelectedOngoingSymptom(symptomKey);
                            setShowOngoingModal(true);
                          }}
                          className="btn-update"
                        >
                          Update
                        </button>
                        <button
                          onClick={() => endOngoingSymptom(symptomKey)}
                          className="btn-resolve"
                        >
                          Mark Resolved
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Overall Wellbeing */}
        <div className="wellbeing-section">
          <h3 className="wellbeing-title">
            🌟 Overall Wellbeing Today
          </h3>
          
          <div className="wellbeing-controls">
            <span className="wellbeing-label">Very Poor</span>
            <div className="wellbeing-rating">
              {[1, 2, 3, 4, 5].map(rating => {
                const currentRating = currentEntry.overallWellbeing || 3;
                return (
                  <button
                    key={rating}
                    onClick={() => updateWellbeing(rating)}
                    className={`wellbeing-btn ${rating <= currentRating ? 'active' : ''}`}
                  >
                    {rating}
                  </button>
                );
              })}
            </div>
            <span className="wellbeing-label">Excellent</span>
          </div>
        </div>

        {/* Symptom Categories */}
        {Object.entries(symptomCategories).map(([categoryKey, category]) => {
          // Skip empty custom category
          if (categoryKey === 'custom' && Object.keys(category.symptoms).length === 0) {
            return null;
          }

          return (
            <div key={categoryKey} className="category-section">
              <h2 className="category-title">
                <span className="category-icon">{category.icon}</span>
                {category.title}
                {categoryKey === 'custom' && (
                  <span className="custom-count-badge">
                    {Object.keys(category.symptoms).length} custom
                  </span>
                )}
              </h2>
              
              <div className="symptoms-grid">
                {Object.entries(category.symptoms).map(([symptomId, symptom]) => (
                  <SymptomCard
                    key={`${symptomId}-${currentDate}`}
                    symptomId={symptomId}
                    symptom={symptom}
                    categoryKey={categoryKey}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Notes Section */}
        <div className="notes-section">
          <h3 className="notes-title">
            📝 Daily Notes
          </h3>
          
          <textarea
            value={currentEntry.notes || ''}
            onChange={(e) => updateNotes(e.target.value)}
            placeholder="How are you feeling today? Any additional observations, triggers, or patterns you've noticed..."
            className="notes-textarea"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-display">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>

      {/* Add Symptom Modal */}
      <AddSymptomModal />

      {/* Update Ongoing Symptom Modal */}
      {showOngoingModal && selectedOngoingSymptom && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                Update {Object.values(symptomCategories).reduce((acc, cat) => ({...acc, ...cat.symptoms}), {})[selectedOngoingSymptom]?.name || selectedOngoingSymptom}
              </h3>
              <button
                onClick={() => {
                  setShowOngoingModal(false);
                  setSelectedOngoingSymptom(null);
                }}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            <div className="ongoing-modal-content">
              <div className="ongoing-duration">
                Duration: Day {getOngoingDuration(selectedOngoingSymptom)} 
                {' '}(started {ongoingSymptoms[selectedOngoingSymptom]?.startDate})
              </div>

              <label className="form-label">
                Current Severity
              </label>
              <div className="ongoing-severity-controls">
                {[1, 2, 3, 4, 5].map(severity => (
                  <button
                    key={severity}
                    onClick={() => updateOngoingSymptom(selectedOngoingSymptom, { currentSeverity: severity })}
                    className={`ongoing-severity-btn ${ongoingSymptoms[selectedOngoingSymptom]?.currentSeverity === severity ? 'active' : ''}`}
                    style={ongoingSymptoms[selectedOngoingSymptom]?.currentSeverity === severity ? {
                      borderColor: getSeverityColor(severity).background,
                      background: getSeverityColor(severity).background,
                      color: getSeverityColor(severity).text
                    } : {}}
                  >
                    {severity}
                  </button>
                ))}
              </div>

              <label className="form-label">
                Notes (optional)
              </label>
              <textarea
                value={ongoingSymptoms[selectedOngoingSymptom]?.notes || ''}
                onChange={(e) => updateOngoingSymptom(selectedOngoingSymptom, { notes: e.target.value })}
                placeholder="Any changes or additional notes..."
                className="ongoing-notes-textarea"
              />
            </div>

            <div className="modal-actions">
              <button
                onClick={() => endOngoingSymptom(selectedOngoingSymptom)}
                className="btn-resolve"
              >
                Mark Resolved
              </button>
              <button
                onClick={() => {
                  setShowOngoingModal(false);
                  setSelectedOngoingSymptom(null);
                }}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LongCovidTracker;