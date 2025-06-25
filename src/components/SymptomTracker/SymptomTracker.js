import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AlertCircle, Plus, X, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase-config';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const LongCovidTracker = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
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

  // Static data
  const severityLevels = useMemo(() => [
    { value: 0, label: 'None', color: '#f3f4f6', textColor: '#6b7280' },
    { value: 1, label: 'Mild', color: '#dcfce7', textColor: '#166534' },
    { value: 2, label: 'Mild-Moderate', color: '#fef3c7', textColor: '#92400e' },
    { value: 3, label: 'Moderate', color: '#fed7aa', textColor: '#9a3412' },
    { value: 4, label: 'Moderate-Severe', color: '#fecaca', textColor: '#991b1b' },
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
        endDate: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toLocaleDateString()
      }
    }));
    
    if (selectedOngoingSymptom === symptomId) {
      setShowOngoingModal(false);
      setSelectedOngoingSymptom(null);
    }
  }, [selectedOngoingSymptom]);

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
        const dateStr = date.toISOString().split('T')[0];
        
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
  }, [currentDate]);

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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: config.color,
        fontSize: '0.875rem'
      }}>
        <span>{config.icon}</span>
        <span>{config.text}</span>
        {lastSyncDate && syncStatus === 'synced' && (
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {new Date(lastSyncDate).toLocaleTimeString()}
          </span>
        )}
        {syncStatus === 'error' && (
          <button 
            onClick={retrySync}
            style={{
              marginLeft: '8px',
              padding: '4px 8px',
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '4px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
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
      <div style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        padding: '24px',
        position: 'relative'
      }}>
        {/* Custom symptom delete button */}
        {symptom.isCustom && (
          <button
            onClick={() => removeCustomSymptom(symptomId)}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Remove custom symptom"
          >
            <X size={12} />
          </button>
        )}

        {/* Symptom header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <h4 style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: '#1f2937',
            margin: 0
          }}>
            {symptom.name}
          </h4>
          {isSymptomOngoing(symptomId) && (
            <span style={{
              padding: '2px 6px',
              background: '#fbbf24',
              color: '#92400e',
              borderRadius: '8px',
              fontSize: '0.6rem',
              fontWeight: '500'
            }}>
              ONGOING
            </span>
          )}
        </div>
        
        <div style={{
          color: '#6b7280',
          fontSize: '0.875rem',
          lineHeight: '1.4',
          marginBottom: '16px'
        }}>
          {symptom.description}
          {symptom.isCustom && (
            <span style={{
              marginLeft: '8px',
              fontSize: '0.75rem',
              background: '#ddd6fe',
              color: '#6d28d9',
              padding: '2px 6px',
              borderRadius: '10px'
            }}>
              Custom
            </span>
          )}
        </div>
        
        {hasInstances && (
          <div style={{
            display: 'inline-block',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '500',
            marginBottom: '20px',
            background: severityInfo.color,
            color: severityInfo.textColor
          }}>
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
          style={{
            width: '100%',
            padding: '12px',
            border: '2px dashed #d1d5db',
            borderRadius: '8px',
            background: 'transparent',
            color: '#6b7280',
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: instances.length > 0 ? '16px' : '0'
          }}
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
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        position: 'relative'
      }}>
        {/* Instance header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Clock size={14} />
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {instance.startTime || 'No time set'}
            </span>
            {instance.duration && (
              <span style={{
                fontSize: '0.75rem',
                background: '#f3f4f6',
                color: '#6b7280',
                padding: '2px 6px',
                borderRadius: '10px'
              }}>
                {instance.duration}
              </span>
            )}
          </div>
          <button
            onClick={() => onRemove(symptomId, instance.id)}
            style={{
              background: 'none',
              border: 'none',
              color: '#dc2626',
              cursor: 'pointer',
              padding: '4px'
            }}
            title="Remove this instance"
          >
            <X size={16} />
          </button>
        </div>

        {/* Severity indicator */}
        <div style={{
          display: 'inline-block',
          padding: '4px 8px',
          borderRadius: '16px',
          fontSize: '0.75rem',
          fontWeight: '500',
          marginBottom: '12px',
          background: severityInfo.color,
          color: severityInfo.textColor
        }}>
          {severityInfo.label} ({instance.severity})
        </div>
        
        {/* Severity controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <button 
            onClick={() => handleAdjust('decrease')}
            disabled={instance.severity === 0}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              background: instance.severity === 0 ? '#f3f4f6' : 'white',
              cursor: instance.severity === 0 ? 'not-allowed' : 'pointer',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              opacity: instance.severity === 0 ? 0.5 : 1
            }}
          >
            ➖
          </button>
          
          <div style={{
            display: 'flex',
            gap: '3px',
            alignItems: 'center'
          }}>
            {[1, 2, 3, 4, 5].map(level => (
              <div
                key={level}
                onClick={() => handleLevelClick(level)}
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  background: level <= instance.severity ? '#8b5cf6' : 'white',
                  borderColor: level <= instance.severity ? '#8b5cf6' : '#e5e7eb',
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </div>
          
          <button 
            onClick={() => handleAdjust('increase')}
            disabled={instance.severity === 5}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              background: instance.severity === 5 ? '#f3f4f6' : 'white',
              cursor: instance.severity === 5 ? 'not-allowed' : 'pointer',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              opacity: instance.severity === 5 ? 0.5 : 1
            }}
          >
            ➕
          </button>
        </div>

        {/* Details toggle */}
        {instance.severity > 0 && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: 'white',
              color: '#6b7280',
              fontSize: '0.75rem',
              cursor: 'pointer',
              marginBottom: showDetails ? '12px' : '0'
            }}
          >
            {showDetails ? '📋 Hide Details' : '📋 Add Details'}
          </button>
        )}

        {/* Details section */}
        {showDetails && instance.severity > 0 && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Start Time
              </label>
              <input
                type="time"
                value={localStartTime}
                onChange={(e) => setLocalStartTime(e.target.value)}
                onBlur={handleStartTimeBlur}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  background: 'white'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Duration
              </label>
              <input
                type="text"
                value={localDuration}
                onChange={(e) => setLocalDuration(e.target.value)}
                onBlur={handleDurationBlur}
                placeholder="e.g., 2 hours, 30 minutes"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  background: 'white',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Triggers
              </label>
              
              {instance.triggers && instance.triggers.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  marginBottom: '6px'
                }}>
                  {instance.triggers.map((trigger, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#e5e7eb',
                        padding: '2px 6px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        color: '#374151'
                      }}
                    >
                      <span>{trigger}</span>
                      <button
                        onClick={() => removeTrigger(index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#6b7280',
                          cursor: 'pointer',
                          padding: '0',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '8px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={addTrigger} style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  placeholder="Add trigger"
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    background: 'white'
                  }}
                />
                <button
                  type="submit"
                  disabled={!newTrigger.trim()}
                  style={{
                    padding: '6px 10px',
                    background: newTrigger.trim() ? '#8b5cf6' : '#f3f4f6',
                    color: newTrigger.trim() ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: newTrigger.trim() ? 'pointer' : 'not-allowed'
                  }}
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
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          width: '400px',
          maxWidth: '90vw'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1f2937',
              margin: 0
            }}>
              Add Custom Symptom
            </h3>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Symptom Name *
              </label>
              <input
                type="text"
                value={newSymptomName}
                onChange={(e) => setNewSymptomName(e.target.value)}
                placeholder="e.g., Joint Pain, Nausea, Tinnitus"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Description (optional)
              </label>
              <textarea
                value={newSymptomDescription}
                onChange={(e) => setNewSymptomDescription(e.target.value)}
                placeholder="Describe the symptom to help with tracking..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newSymptomName.trim()}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  background: newSymptomName.trim() ? '#8b5cf6' : '#f3f4f6',
                  color: newSymptomName.trim() ? 'white' : '#9ca3af',
                  cursor: newSymptomName.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.875rem'
                }}
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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #7c3aed 100%)'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '48px',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f4f6',
            borderTop: '4px solid #8b5cf6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280', margin: 0 }}>Loading symptom tracker...</p>
        </div>
      </div>
    );
  }

  // Error state for missing user ID
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const userId = userData.id;
  
  if (error && !userId) { // Only show this specific error if there's an error and no user ID
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #7c3aed 100%)'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '48px',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
        }}>
          <AlertCircle size={48} style={{ color: '#dc2626', margin: '0 auto 16px' }} />
          <p style={{
            color: '#dc2626',
            fontSize: '1rem',
            marginBottom: '16px'
          }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/dashboard')} // Use navigate instead of window.location.href
            style={{
              padding: '12px 24px',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #7c3aed 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 8px 0'
            }}>
              Long COVID Symptom Tracker
            </h1>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              color: '#6b7280',
              fontSize: '0.875rem'
            }}>
              <span>📅 {new Date(currentDate).toLocaleDateString()}</span>
              {SyncStatusIndicator}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowAddSymptom(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              <Plus size={16} />
              Add Symptom
            </button>
            <button
              onClick={handleBackToDashboard}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              🏠 Dashboard
            </button>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Date Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <button
            onClick={() => {
              const date = new Date(currentDate);
              date.setDate(date.getDate() - 1);
              setCurrentDate(date.toISOString().split('T')[0]);
            }}
            style={{
              padding: '8px 12px',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ← Previous Day
          </button>
          
          <input
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            style={{
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              fontSize: '1rem',
              background: 'white',
              color: '#374151',
              outline: 'none'
            }}
          />
          
          <button
            onClick={() => {
              const date = new Date(currentDate);
              const today = new Date();
              if (date < today) {
                date.setDate(date.getDate() + 1);
                setCurrentDate(date.toISOString().split('T')[0]);
              }
            }}
            disabled={currentDate === new Date().toISOString().split('T')[0]}
            style={{
              padding: '8px 12px',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: currentDate === new Date().toISOString().split('T')[0] ? 'not-allowed' : 'pointer',
              color: '#6b7280',
              opacity: currentDate === new Date().toISOString().split('T')[0] ? 0.5 : 1
            }}
          >
            Next Day →
          </button>
        </div>

        {/* Ongoing Symptoms Section */}
        {Object.keys(ongoingSymptoms).filter(key => ongoingSymptoms[key].active).length > 0 && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Clock size={20} />
              Ongoing Symptoms
            </h3>
            <div style={{
              display: 'grid',
              gap: '12px'
            }}>
              {Object.entries(ongoingSymptoms)
                .filter(([_, ongoing]) => ongoing.active)
                .map(([symptomKey, ongoing]) => {
                  const allSymptoms = Object.values(symptomCategories).reduce((acc, cat) => ({...acc, ...cat.symptoms}), {});
                  const symptom = allSymptoms[symptomKey];
                  const duration = getOngoingDuration(symptomKey);
                  
                  return (
                    <div key={symptomKey} style={{
                      background: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '4px'
                        }}>
                          <span style={{
                            fontSize: '1rem',
                            fontWeight: '500',
                            color: '#1f2937'
                          }}>
                            {symptom?.name || symptomKey}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            background: getSeverityColor(ongoing.currentSeverity).background,
                            color: getSeverityColor(ongoing.currentSeverity).text,
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            Severity {ongoing.currentSeverity}
                          </span>
                        </div>
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#6b7280'
                        }}>
                          Started {ongoing.startDate} • Day {duration} • Last updated {ongoing.lastUpdated}
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '8px'
                      }}>
                        <button
                          onClick={() => {
                            setSelectedOngoingSymptom(symptomKey);
                            setShowOngoingModal(true);
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Update
                        </button>
                        <button
                          onClick={() => endOngoingSymptom(symptomKey)}
                          style={{
                            padding: '6px 12px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
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
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🌟 Overall Wellbeing Today
          </h3>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <span style={{ fontSize: '0.875rem', color: '#64748b', minWidth: '80px' }}>
              Very Poor
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map(rating => {
                const currentRating = currentEntry.overallWellbeing || 3;
                return (
                  <button
                    key={rating}
                    onClick={() => updateWellbeing(rating)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: rating <= currentRating ? '#8b5cf6' : '#e2e8f0',
                      background: rating <= currentRating ? '#8b5cf6' : 'white',
                      color: rating <= currentRating ? 'white' : '#64748b',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {rating}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: '0.875rem', color: '#64748b', minWidth: '80px' }}>
              Excellent
            </span>
          </div>
        </div>

        {/* Symptom Categories */}
        {Object.entries(symptomCategories).map(([categoryKey, category]) => {
          // Skip empty custom category
          if (categoryKey === 'custom' && Object.keys(category.symptoms).length === 0) {
            return null;
          }

          return (
            <div key={categoryKey} style={{ marginBottom: '32px' }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '1.75rem' }}>{category.icon}</span>
                {category.title}
                {categoryKey === 'custom' && (
                  <span style={{
                    fontSize: '0.875rem',
                    background: '#ddd6fe',
                    color: '#6d28d9',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontWeight: '500'
                  }}>
                    {Object.keys(category.symptoms).length} custom
                  </span>
                )}
              </h2>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '20px'
              }}>
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
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📝 Daily Notes
          </h3>
          
          <textarea
            value={currentEntry.notes || ''}
            onChange={(e) => updateNotes(e.target.value)}
            placeholder="How are you feeling today? Any additional observations, triggers, or patterns you've noticed..."
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '16px',
              border: '1px solid #d1d5db',
              borderRadius: '12px',
              fontSize: '0.875rem',
              lineHeight: '1.5',
              background: 'white',
              color: '#374151',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            marginTop: '20px',
            padding: '16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            color: '#dc2626',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>

      {/* Add Symptom Modal */}
      <AddSymptomModal />

      {/* Update Ongoing Symptom Modal */}
      {showOngoingModal && selectedOngoingSymptom && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '400px',
            maxWidth: '90vw'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1f2937',
                margin: 0
              }}>
                Update {Object.values(symptomCategories).reduce((acc, cat) => ({...acc, ...cat.symptoms}), {})[selectedOngoingSymptom]?.name || selectedOngoingSymptom}
              </h3>
              <button
                onClick={() => {
                  setShowOngoingModal(false);
                  setSelectedOngoingSymptom(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '12px'
              }}>
                Duration: Day {getOngoingDuration(selectedOngoingSymptom)} 
                {' '}(started {ongoingSymptoms[selectedOngoingSymptom]?.startDate})
              </div>

              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Current Severity
              </label>
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px'
              }}>
                {[1, 2, 3, 4, 5].map(severity => (
                  <button
                    key={severity}
                    onClick={() => updateOngoingSymptom(selectedOngoingSymptom, { currentSeverity: severity })}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: `2px solid ${ongoingSymptoms[selectedOngoingSymptom]?.currentSeverity === severity ? getSeverityColor(severity).background : '#e5e7eb'}`,
                      borderRadius: '8px',
                      background: ongoingSymptoms[selectedOngoingSymptom]?.currentSeverity === severity ? getSeverityColor(severity).background : 'white',
                      color: ongoingSymptoms[selectedOngoingSymptom]?.currentSeverity === severity ? getSeverityColor(severity).text : '#6b7280',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}
                  >
                    {severity}
                  </button>
                ))}
              </div>

              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Notes (optional)
              </label>
              <textarea
                value={ongoingSymptoms[selectedOngoingSymptom]?.notes || ''}
                onChange={(e) => updateOngoingSymptom(selectedOngoingSymptom, { notes: e.target.value })}
                placeholder="Any changes or additional notes..."
                style={{
                  width: '100%',
                  minHeight: '60px',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => endOngoingSymptom(selectedOngoingSymptom)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #10b981',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#10b981',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Mark Resolved
              </button>
              <button
                onClick={() => {
                  setShowOngoingModal(false);
                  setSelectedOngoingSymptom(null);
                }}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#3b82f6',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LongCovidTracker;