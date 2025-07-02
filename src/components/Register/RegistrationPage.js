import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check, AlertCircle, Heart, Activity, Smartphone, Watch, User, Mail, Lock, Calendar, Scale, Ruler } from 'lucide-react';
import "../Common.css";
import './RegistrationPage.css'; // Import CSS file

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase-config';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';

// Enhanced Progress Summary Component
const ProgressSummary = ({ step, formData }) => {
  const progressSteps = [
    {
      id: 'personal',
      label: 'Personal Information',
      completed: step > 1,
      active: step === 1
    },
    {
      id: 'device',
      label: 'Device Connection',
      completed: step > 2,
      active: step === 2
    },
    {
      id: 'authorization',
      label: 'Authorization',
      completed: formData.authorizationGiven && step >= 3,
      active: step === 3 && !formData.authorizationGiven
    }
  ];

  return (
    <div className="progress-summary fade-in-up">
      <h3 className="progress-title">Registration Progress</h3>
      <div className="progress-items">
        {progressSteps.map((progressStep, index) => (
          <div
            key={progressStep.id}
            className={`progress-item ${
              progressStep.completed ? 'completed' : progressStep.active ? 'active' : ''
            }`}
          >
            <div
              className={`progress-item-status ${
                progressStep.completed ? 'completed' : ''
              }`}
            >
              {progressStep.completed ? (
                <Check className="progress-icon completed" />
              ) : (
                <div className={`progress-circle ${progressStep.active ? 'active' : 'inactive'}`}>
                  {!progressStep.active && <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{index + 1}</span>}
                </div>
              )}
            </div>
            <span className="progress-item-label">{progressStep.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Updated InfoBox component
const InfoBox = ({ title, children, icon: Icon }) => (
  <div className="info-box">
    <div className="info-box-content">
      {Icon && <Icon className="info-box-icon" />}
      <div>
        <h3 className="info-box-title">{title}</h3>
        <p className="info-box-text">{children}</p>
      </div>
    </div>
  </div>
);

const deviceOptions = [
  { 
    id: 'apple-watch', 
    name: 'Apple Watch', 
    description: 'Connect via Apple Health',
    icon: Watch,
    color: 'bg-gray-900 text-white',
    features: ['Heart Rate', 'HRV', 'Activity', 'Sleep'],
    connectionType: 'oauth',
    setupInstructions: 'We\'ll redirect you to Apple Health to authorize data sharing.'
  },
  { 
    id: 'fitbit', 
    name: 'Fitbit', 
    description: 'Connect via Fitbit API',
    icon: Activity,
    color: 'bg-green-600 text-white',
    features: ['Heart Rate', 'Steps', 'Sleep', 'Stress'],
    connectionType: 'oauth',
    setupInstructions: 'You\'ll be redirected to Fitbit to sign in and authorize access.'
  },
  { 
    id: 'garmin', 
    name: 'Garmin', 
    description: 'Connect via Garmin Connect',
    icon: Watch,
    color: 'bg-blue-600 text-white',
    features: ['Heart Rate', 'HRV', 'Training Load', 'Recovery'],
    connectionType: 'oauth',
    setupInstructions: 'Sign in to Garmin Connect to enable data synchronization.'
  },
  { 
    id: 'samsung-health', 
    name: 'Samsung Health', 
    description: 'Connect via Samsung Health',
    icon: Smartphone,
    color: 'bg-blue-800 text-white',
    features: ['Heart Rate', 'Steps', 'Sleep', 'Stress'],
    connectionType: 'oauth',
    setupInstructions: 'Authorize Samsung Health to share your fitness data.'
  },
  { 
    id: 'google-fit', 
    name: 'Google Fit', 
    description: 'Connect via Google Fit API',
    icon: Smartphone,
    color: 'bg-red-500 text-white',
    features: ['Activity', 'Heart Rate', 'Sleep', 'Location'],
    connectionType: 'oauth',
    setupInstructions: 'Sign in with Google to connect your Fit data.'
  },
  { 
    id: 'manual', 
    name: 'Manual Entry', 
    description: 'Record data manually',
    icon: User,
    color: 'bg-purple-600 text-white',
    features: ['Custom Input', 'Flexible Tracking', 'No Device Required'],
    connectionType: 'manual',
    setupInstructions: 'No setup required. You\'ll enter data manually in the app.'
  }
];

const symptomOptions = [
  'Fatigue', 'Post-exertional malaise', 'Brain fog', 'Headaches', 
  'Shortness of breath', 'Heart palpitations', 'Dizziness', 'Joint/muscle pain',
  'Sleep disturbances', 'Temperature regulation issues', 'Digestive issues'
];

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Personal details
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    gender: '',
    weight: '',
    height: '',
    covidDate: '',
    covidDuration: '',
    severity: '',
    symptoms: [],
    medicalConditions: '',
    // Device connection
    selectedDevice: '',
    deviceConnected: false,
    authorizationGiven: false
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');

// Replace your useEffect code with this fixed version:

React.useEffect(() => {
  const inputs = document.querySelectorAll('input, select, textarea');
  const deviceItems = document.querySelectorAll('.device-card'); // Changed from .device-item

  // Floating label functionality
  const handleFloatingLabels = (input) => {
    const formGroup = input.closest('.form-group');
    const label = formGroup?.querySelector('.form-label');
    
    // Return early with null handlers if no form group or label found
    if (!label || !formGroup) {
      return {
        handleFocus: () => {},
        handleBlur: () => {},
        handleInput: () => {},
        updateLabelState: () => {}
      };
    }

    const updateLabelState = () => {
      const hasValue = input.value && input.value.length > 0;
      const isFocused = document.activeElement === input;
      
      if (hasValue || isFocused) {
        label.classList.add('floating');
        formGroup.classList.add('has-content');
      } else {
        label.classList.remove('floating');
        formGroup.classList.remove('has-content');
      }
    };

    // Initial check for pre-filled values
    updateLabelState();

    const handleFocus = () => {
      try {
        if (input.closest('.form-group')) {
          input.closest('.form-group').style.transform = 'scale(1.02)';
        }
        label.classList.add('floating');
        formGroup.classList.add('focused');
        updateLabelState();
      } catch (error) {
        console.warn('Error in handleFocus:', error);
      }
    };
    
    const handleBlur = () => {
      try {
        if (input.closest('.form-group')) {
          input.closest('.form-group').style.transform = 'scale(1)';
        }
        formGroup.classList.remove('focused');
        updateLabelState();
      } catch (error) {
        console.warn('Error in handleBlur:', error);
      }
    };

    const handleInput = () => {
      try {
        updateLabelState();
      } catch (error) {
        console.warn('Error in handleInput:', error);
      }
    };

    // Always return the handlers object
    return { handleFocus, handleBlur, handleInput, updateLabelState };
  };

  // Apply floating label functionality to all inputs
  const inputHandlers = [];
  inputs.forEach(input => {
    try {
      const handlers = handleFloatingLabels(input);
      
      // Only add event listeners if handlers exist
      if (handlers && handlers.handleFocus) {
        input.addEventListener('focus', handlers.handleFocus);
        input.addEventListener('blur', handlers.handleBlur);
        input.addEventListener('input', handlers.handleInput);
        
        inputHandlers.push({ input, handlers });
      }
    } catch (error) {
      console.warn('Error setting up input handlers:', error);
    }
  });

  // Device item hover effects
  const deviceHandlers = [];
  deviceItems.forEach(item => {
    try {
      const handleMouseEnter = () => {
        item.style.transform = 'translateY(-4px) scale(1.05)';
      };
      
      const handleMouseLeave = () => {
        item.style.transform = 'translateY(0) scale(1)';
      };

      item.addEventListener('mouseenter', handleMouseEnter);
      item.addEventListener('mouseleave', handleMouseLeave);
      
      deviceHandlers.push({ item, handleMouseEnter, handleMouseLeave });
    } catch (error) {
      console.warn('Error setting up device handlers:', error);
    }
  });

  // Cleanup function
  return () => {
    // Clean up input handlers
    inputHandlers.forEach(({ input, handlers }) => {
      try {
        if (input && handlers) {
          input.removeEventListener('focus', handlers.handleFocus);
          input.removeEventListener('blur', handlers.handleBlur);
          input.removeEventListener('input', handlers.handleInput);
        }
      } catch (error) {
        console.warn('Error cleaning up input handlers:', error);
      }
    });

    // Clean up device handlers
    deviceHandlers.forEach(({ item, handleMouseEnter, handleMouseLeave }) => {
      try {
        if (item) {
          item.removeEventListener('mouseenter', handleMouseEnter);
          item.removeEventListener('mouseleave', handleMouseLeave);
        }
      } catch (error) {
        console.warn('Error cleaning up device handlers:', error);
      }
    });
  };
}, []);

// Also update the second useEffect to handle form data changes:
React.useEffect(() => {
  // Update floating labels when formData changes
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    try {
      const formGroup = input.closest('.form-group');
      const label = formGroup?.querySelector('.form-label');
      
      if (label && formGroup) {
        const hasValue = input.value && input.value.length > 0;
        
        if (hasValue) {
          label.classList.add('floating');
          formGroup.classList.add('has-content');
        } else {
          label.classList.remove('floating');
          formGroup.classList.remove('has-content');
        }
      }
    } catch (error) {
      console.warn('Error updating floating labels:', error);
    }
  });
}, [formData]); // Re-run when formData changes


  // Form validation
  const validateStep1 = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    
    // Enhanced email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address';
      }
    }
    
    // Enhanced password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters (Firebase requirement)';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password should be at least 8 characters for better security';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.age) {
      newErrors.age = 'Age is required';
    } else if (formData.age < 13) {
      newErrors.age = 'Age must be at least 13 (Firebase requirement)';
    }
    
    if (!formData.gender) newErrors.gender = 'Gender is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    if (!formData.selectedDevice) {
      setErrors({ device: 'Please select a device or manual entry option' });
      return false;
    }
    setErrors({});
    return true;
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'symptoms') {
      setFormData(prev => ({
        ...prev,
        symptoms: checked 
          ? [...prev.symptoms, value]
          : prev.symptoms.filter(s => s !== value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
    
    // Clear related errors
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Device connection handlers
  const handleDeviceSelect = (deviceId) => {
    setFormData(prev => ({ ...prev, selectedDevice: deviceId }));
    setErrors(prev => ({ ...prev, device: '' }));
  };

  // Function to save user data to Firestore
  const saveUserToDatabase = async (user, userData = formData) => {
    try {
      const userProfile = {
        uid: user.uid,
        name: userData.name.trim(),
        email: userData.email.toLowerCase().trim(),
        age: parseInt(userData.age),
        gender: userData.gender,
        weight: userData.weight ? parseFloat(userData.weight) : null,
        height: userData.height ? parseFloat(userData.height) : null,
        covidDate: userData.covidDate || null,
        covidDuration: userData.covidDuration || null,
        severity: userData.severity || null,
        symptoms: userData.symptoms || [],
        medicalConditions: userData.medicalConditions || null,
        selectedDevice: userData.selectedDevice,
        deviceConnected: userData.deviceConnected,
        authorizationGiven: userData.authorizationGiven,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        // Additional fields for energy management
        energyProfile: {
          baselineCalculated: false,
          currentEnergyLevel: 50, // Default starting point
          energyEnvelope: null,
          dailyEnergyBudget: null
        },
        preferences: {
          notifications: true,
          reminderFrequency: 'daily',
          dataRetention: '1year'
        }
      };

      // Use setDoc with the user's UID as the document ID
      await setDoc(doc(db, 'users', user.uid), userProfile);
      
      console.log('User data saved successfully to Firestore');
      return userProfile;
    } catch (error) {
      console.error('Error saving user data to Firestore:', error);
      throw new Error('Failed to save user profile. Please try again.');
    }
  };

// Enhanced debug version of handleDeviceConnection for RegistrationPage.js
// This will help us see exactly what redirect URI is being sent

const handleDeviceConnection = async () => {
  setLoading(true);
  setConnectionStatus('Connecting...');
  
  const selectedDeviceInfo = deviceOptions.find(d => d.id === formData.selectedDevice);
  
  // Enhanced helper function to get the correct redirect URI with debugging
  const getRedirectUri = () => {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    
    console.log('=== REDIRECT URI DEBUG ===');
    console.log('Hostname:', hostname);
    console.log('Port:', port);
    console.log('Origin:', origin);
    console.log('Pathname:', pathname);
    console.log('Full location:', window.location.href);
    
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isGitHubPages = hostname.includes('github.io');
    
    console.log('Is localhost:', isLocalhost);
    console.log('Is GitHub Pages:', isGitHubPages);
    
    let redirectUri;
    
    if (isLocalhost) {
      // IMPORTANT: You need to match your actual registered localhost URL
      // Your registered URL is: http://localhost:64556/energy_balance/fitbit-dashboard
      // But you're running on a different port, so we need to detect the actual port
      
      if (port) {
        redirectUri = `http://localhost:${port}/energy_balance/fitbit-dashboard`;
      } else {
        // Fallback if port detection fails
        redirectUri = `http://localhost:64556/energy_balance/fitbit-dashboard`;
      }
    } else if (isGitHubPages) {
      // For GitHub Pages, this should match your registered URL exactly
      redirectUri = 'https://obuchel.github.io/energy_balance/fitbit-dashboard/callback';
    } else {
      // Fallback for other environments
      redirectUri = `${origin}/fitbit-dashboard/callback`;
    }
    
    console.log('Generated redirect URI:', redirectUri);
    console.log('=== END REDIRECT URI DEBUG ===');
    
    return redirectUri;
  };
  
  try {
    if (selectedDeviceInfo.connectionType === 'oauth') {
      
      if (formData.selectedDevice === 'fitbit') {
        // Store registration data in sessionStorage for FitbitCallback
        const registrationDataForStorage = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          age: formData.age,
          gender: formData.gender,
          weight: formData.weight,
          height: formData.height,
          covidDate: formData.covidDate,
          covidDuration: formData.covidDuration,
          severity: formData.severity,
          symptoms: formData.symptoms,
          medicalConditions: formData.medicalConditions,
          selectedDevice: formData.selectedDevice
        };
        
        sessionStorage.setItem('registrationData', JSON.stringify(registrationDataForStorage));
        
        // Generate state parameter for CSRF protection
        const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('fitbitOAuthState', state);
        sessionStorage.setItem('fitbitAuthStartTime', Date.now().toString());
        
        // Get environment variables
        const clientId = process.env.REACT_APP_FITBIT_CLIENT_ID;
        
        // Use the enhanced redirect URI function
        const redirectUri = getRedirectUri();
        
        // ENHANCED DEBUG LOGGING
        console.log('=== FITBIT OAUTH FULL DEBUG ===');
        console.log('Current window location:', window.location.href);
        console.log('Current hostname:', window.location.hostname);
        console.log('Current port:', window.location.port);
        console.log('Current origin:', window.location.origin);
        console.log('Current pathname:', window.location.pathname);
        console.log('Redirect URI being used:', redirectUri);
        console.log('Fitbit Client ID:', clientId ? clientId.substring(0, 6) + '...' : 'MISSING');
        
        // Show all registered URLs for comparison
        console.log('YOUR REGISTERED FITBIT URLs SHOULD BE:');
        console.log('1. For localhost:', `http://localhost:${window.location.port || '64556'}/energy_balance/fitbit-dashboard`);
        console.log('2. For GitHub Pages: https://obuchel.github.io/energy_balance/fitbit-dashboard/callback');
        
        if (!clientId) {
          throw new Error('Fitbit Client ID missing. Please check environment variables.');
        }
        
        // Build Fitbit OAuth URL with exact parameters
        const fitbitAuthUrl = new URL('https://www.fitbit.com/oauth2/authorize');
        fitbitAuthUrl.searchParams.append('response_type', 'code');
        fitbitAuthUrl.searchParams.append('client_id', clientId);
        fitbitAuthUrl.searchParams.append('redirect_uri', redirectUri);
        fitbitAuthUrl.searchParams.append('scope', 'activity heartrate location nutrition profile settings sleep social weight');
        fitbitAuthUrl.searchParams.append('state', state);
        
        console.log('Full Fitbit OAuth URL:', fitbitAuthUrl.toString());
        console.log('=== END FULL DEBUG ===');
        
        // Enhanced confirmation dialog with more info
        const confirmRedirect = window.confirm(
          `FITBIT OAUTH DEBUG INFO:\n\n` +
          `Current URL: ${window.location.href}\n` +
          `Detected Port: ${window.location.port || 'none (probably 64556)'}\n` +
          `Redirect URI: ${redirectUri}\n\n` +
          `YOUR FITBIT APP SHOULD HAVE THESE EXACT URLs REGISTERED:\n` +
          `1. http://localhost:${window.location.port || '64556'}/energy_balance/fitbit-dashboard\n` +
          `2. https://obuchel.github.io/energy_balance/fitbit-dashboard/callback\n\n` +
          `Client ID: ${clientId ? clientId.substring(0, 6) + '...' : 'MISSING'}\n\n` +
          `If the redirect URI above doesn't EXACTLY match one of your registered URLs in dev.fitbit.com, you'll get the "Invalid redirect_uri" error.\n\n` +
          `Continue to Fitbit?`
        );
        
        if (!confirmRedirect) {
          setLoading(false);
          setConnectionStatus('Connection cancelled by user.');
          return;
        }
        
        setConnectionStatus('Redirecting to Fitbit...');
        
        // Small delay to show status, then redirect
        setTimeout(() => {
          window.location.href = fitbitAuthUrl.toString();
        }, 1000);
        
        return; // Exit early since we're redirecting
      } else {
        // Handle other OAuth providers (Apple Watch, Garmin, etc.)
        // For now, these will proceed to step 3 without actual OAuth
        await new Promise(resolve => setTimeout(resolve, 2000));
        setConnectionStatus('Device ready for authorization');
      }
      
      setFormData(prev => ({ ...prev, deviceConnected: true }));
      setStep(3);
    } else {
      // Manual entry - no connection needed
      setFormData(prev => ({ ...prev, deviceConnected: true }));
      setConnectionStatus('Manual entry selected');
      setStep(3);
    }
  } catch (error) {
    console.error('Device connection error:', error);
    setConnectionStatus(`Connection failed: ${error.message}`);
  } finally {
    setLoading(false);
  }
};
  // Check if email already exists in the system
  const checkEmailExists = async (email) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking email existence:', error);
      // If we can't check, proceed with registration and let Firebase Auth handle it
      return false;
    }
  };

  // Step navigation
  const handleNext = async () => {
    if (step === 1 && validateStep1()) {
      // Check if email already exists before proceeding
      setLoading(true);
      try {
        const emailExists = await checkEmailExists(formData.email);
        if (emailExists) {
          setErrors({ email: 'This email address is already registered. Please use a different email or try signing in.' });
          setLoading(false);
          return;
        }
        setLoading(false);
        setStep(2);
      } catch (error) {
        setLoading(false);
        console.error('Error checking email:', error);
        // Proceed anyway and let Firebase handle the duplicate check
        setStep(2);
      }
    } else if (step === 2 && validateStep2()) {
      handleDeviceConnection();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.authorizationGiven) {
      setErrors({ authorization: 'Please authorize data access to continue' });
      return;
    }
    
    setLoading(true);
    setErrors({}); // Clear any previous errors
    
    try {
      // Clean and validate email format
      const cleanEmail = formData.email.trim().toLowerCase();
      const cleanPassword = formData.password.trim();
      
      console.log('Starting registration process...');
      console.log('Email:', cleanEmail);
      console.log('Password length:', cleanPassword.length);
      
      // Additional validation before Firebase call
      if (cleanPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Please enter a valid email address');
      }

      // Double-check email doesn't exist (in case user bypassed earlier check)
      console.log('Checking email availability...');
      const emailExists = await checkEmailExists(cleanEmail);
      if (emailExists) {
        throw new Error('This email address is already registered. Please use a different email or try signing in.');
      }

      // Create Firebase Auth user with cleaned data
      console.log('Creating Firebase Auth user...');
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        cleanEmail, 
        cleanPassword
      );
      
      const user = userCredential.user;
      console.log('Firebase Auth user created successfully:', user.uid);
      
      // Update formData with cleaned email for database storage
      const updatedFormData = { ...formData, email: cleanEmail };
      
      // Save user data to Firestore
      console.log('Saving user data to Firestore...');
      await saveUserToDatabase(user, updatedFormData);
      
      console.log('Registration completed successfully');
      
      // Show success message
      alert('Registration successful! Welcome to Energy Balance.');
      
      // Navigate to sign-in page using React Router
      navigate('/login', { 
        state: { 
          message: 'Registration successful! Please sign in with your new account.',
          email: cleanEmail // Pre-fill email on login page
        }
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      let errorMessage = 'Registration failed. Please try again.';
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email address is already registered. Please use a different email or try signing in.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password with at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format. Please check your email and try again.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password accounts are not enabled. Please contact support.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please wait a few minutes and try again.';
      } else if (error.message.includes('Failed to save user profile')) {
        errorMessage = 'Account created but profile setup failed. Please contact support.';
      } else if (error.message.includes('already registered')) {
        errorMessage = error.message;
      } else if (error.message.includes('Password must be')) {
        errorMessage = error.message;
      } else if (error.message.includes('valid email')) {
        errorMessage = error.message;
      }
      
      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const selectedDeviceInfo = deviceOptions.find(d => d.id === formData.selectedDevice);

  return (
    
    <div className="registration-page">
      <div className="registration-container">
        <div className="registration-header">
          <h1 className="registration-title">Join Energy Balance</h1>
          <p className="registration-subtitle">Set up your personalized energy management system</p>
        </div>

        <div className="bg-animation">
  <div className="floating-shape shape-1"></div>
  <div className="floating-shape shape-2"></div>
  <div className="floating-shape shape-3"></div>
</div>
     

        <div className="registration-card fade-in-up">
          {step === 1 && (
            <div>
              <h2 className="step-title">Tell us about yourself</h2>
              
              <InfoBox title="Why we need this information" icon={AlertCircle}>
                Your personal details help our system calculate your energy baseline, recovery capacity, 
                and create a customized energy envelope specifically for your condition. All information 
                is stored securely and processed locally on your device.
              </InfoBox>

              <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
                <div className="form-grid two-cols">
                <div className="form-group">
                   

                      <User className="form-label-icon" />
                     
                
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`form-input ${errors.name ? 'error' : ''}`}
                      placeholder="Enter your full name"
                    />
                     <label className="form-label">
                      Full Name *
                    </label>
                    {errors.name && <p className="error-message">{errors.name}</p>}
                  </div>

                  <div className="form-group">
                   
                      <Mail className="form-label-icon" />
                     
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`form-input ${errors.email ? 'error' : ''}`}
                      placeholder="Enter your email"
                    />
                     <label className="form-label">
                      Email Address *
                    </label>
                    {errors.email && <p className="error-message">{errors.email}</p>}
                  </div>

                  <div className="form-group">
                   
                      <Lock className="form-label-icon" />
                    
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`form-input ${errors.password ? 'error' : ''}`}
                      placeholder="Minimum 6 characters (Firebase requirement)"
                    />
                      <label className="form-label">
                      Create Password *
                    </label>
                    {errors.password && <p className="error-message">{errors.password}</p>}
                  </div>

                  <div className="form-group">
                   
                      <Lock className="form-label-icon" />
                     
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                      placeholder="Repeat your password"
                    />
                     <label className="form-label">
                      Confirm Password *
                    </label>
                    {errors.confirmPassword && <p className="error-message">{errors.confirmPassword}</p>}
                  </div>

                  <div className="form-group">
                   
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      onChange={handleInputChange}
                      className={`form-input ${errors.age ? 'error' : ''}`}
                      placeholder="Your age"
                      min="18"
                      max="100"
                    />
                     <label className="form-label">Age *</label>
                    {errors.age && <p className="error-message">{errors.age}</p>}
                  </div>

                  <div className="form-group">
                   
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className={`form-select ${errors.gender ? 'error' : ''}`}
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                    {errors.gender && <p className="error-message">{errors.gender}</p>}
                  </div>

                  <div className="form-group">
                   
                      <Scale className="form-label-icon" />
                     
                    <input
                      type="number"
                      name="weight"
                      value={formData.weight}
                      onChange={handleInputChange}
                      className="form-input"
                      placeholder="Optional"
                    />
                     <label className="form-label">
                      Weight (kg)
                      
                    </label>
                  </div>

                  <div className="form-group">
                   
                      <Ruler className="form-label-icon" />
                  
                    <input
                      type="number"
                      name="height"
                      value={formData.height}
                      onChange={handleInputChange}
                      className="form-input"
                      placeholder="Optional"
                    />
                        <label className="form-label">
                      Height (cm)
                    </label>
                  </div>

                  <div className="form-group">
                   
                      <Calendar className="form-label-icon" />
                      
                    <input
                      type="date"
                      name="covidDate"
                      value={formData.covidDate}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                    <label className="form-label">
                      When did you first get COVID?
                    </label>
                  </div>

                  <div className="form-group">
                
                    <select
                      name="covidDuration"
                      value={formData.covidDuration}
                      onChange={handleInputChange}
                      className="form-select"
                    >
                      <option value="">Select duration</option>
                      <option value="less-than-1-month">Less than 1 month</option>
                      <option value="1-3-months">1-3 months</option>
                      <option value="3-6-months">3-6 months</option>
                      <option value="6-12-months">6-12 months</option>
                      <option value="1-2-years">1-2 years</option>
                      <option value="more-than-2-years">More than 2 years</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
             
                  <select
                    name="severity"
                    value={formData.severity}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="">Select severity</option>
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                    <option value="very-severe">Very Severe</option>
                  </select>
                </div>

                <div className="symptoms-section">
  <label className="form-label">
    What symptoms do you experience? (Select all that apply)
  </label>
  <div className="symptoms-grid">
    {symptomOptions.map(symptom => (
      <label
        key={symptom}
        className={`symptom-checkbox ${
          formData.symptoms.includes(symptom) ? 'selected' : ''
        }`}
      >
        <input
          type="checkbox"
          name="symptoms"
          value={symptom}
          checked={formData.symptoms.includes(symptom)}
          onChange={handleInputChange}
          className="symptom-checkbox-input"
        />
        <span className="symptom-checkbox-text">{symptom}</span>
      </label>
    ))}
  </div>
</div>

                <div className="form-group">
                  <label className="form-label">
                    Pre-existing medical conditions
                  </label>
                  <textarea
                    name="medicalConditions"
                    value={formData.medicalConditions}
                    onChange={handleInputChange}
                    className="form-textarea"
                    rows="3"
                    placeholder="Please list any medical conditions you had before COVID (e.g., diabetes, hypertension, autoimmune conditions)"
                  />
                </div>

                <div className="form-navigation">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => window.history.back()}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="loading-spinner"></div>
                        Checking...
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="btn-icon" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="step-title">Connect your wearable device</h2>
              
              <InfoBox title="Why connect a wearable device?" icon={Heart}>
                Energy Balance uses data from your wearable device to monitor heart rate, heart rate 
                variability (HRV), and activity levels. This provides objective measurements of your 
                energy expenditure and physiological stress, helping to prevent overexertion and PEM.
              </InfoBox>

              <div className="device-grid">
                {deviceOptions.map(device => {
                  const Icon = device.icon;
                  return (
                    <div
                      key={device.id}
                      className={`device-card ${
                        formData.selectedDevice === device.id ? 'selected' : ''
                      }`}
                      onClick={() => handleDeviceSelect(device.id)}
                    >
                      <div className={`device-icon-wrapper ${device.color}`}>
                        <Icon className="device-icon" />
                      </div>
                      <h3 className="device-name">{device.name}</h3>
                      <p className="device-description">{device.description}</p>
                      <div className="device-features">
                        {device.features.map(feature => (
                          <div key={feature} className="device-feature">
                            <Check className="device-feature-icon" />
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {errors.device && (
                <div className="error-message text-center">{errors.device}</div>
              )}

              <div className="form-navigation">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleBack}
                >
                  <ChevronLeft className="btn-icon" />
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNext}
                  disabled={!formData.selectedDevice || loading}
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect Device
                      <ChevronRight className="btn-icon" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 3 && selectedDeviceInfo && (
            <div>
              <h2 className="step-title">Authorize Data Access</h2>
              
              <div className="auth-device-info">
                <div className={`auth-device-icon ${selectedDeviceInfo.color}`}>
                  <selectedDeviceInfo.icon className="device-icon" />
                </div>
                <h3 className="auth-device-name">{selectedDeviceInfo.name}</h3>
                <p className="auth-device-instructions">{selectedDeviceInfo.setupInstructions}</p>
                
                {connectionStatus && (
                  <div className={`connection-status ${
                    connectionStatus.includes('success') ? 'success' : 'info'
                  }`}>
                    {connectionStatus}
                  </div>
                )}
              </div>

              <InfoBox title="Data Privacy & Security" icon={AlertCircle}>
                Your health data is encrypted and stored securely. We only access the specific metrics 
                needed for energy management (heart rate, activity levels, sleep). You can revoke access 
                at any time through your device settings or our app.
              </InfoBox>

              <div className="data-permissions">
                <h4 className="permissions-title">Data Access Permissions</h4>
                <div className="permissions-list">
                  {selectedDeviceInfo.features.map(feature => (
                    <div key={feature} className="permission-item">
                      <Check className="permission-icon" />
                      {feature} data
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="auth-checkbox-wrapper">
                  <input
                    type="checkbox"
                    name="authorizationGiven"
                    checked={formData.authorizationGiven}
                    onChange={handleInputChange}
                    className="auth-checkbox"
                  />
                  <label className="auth-checkbox-label">
                    I authorize Energy Balance to access my fitness and health data from {selectedDeviceInfo.name} 
                    for the purpose of energy monitoring and management. I understand that I can revoke this 
                    authorization at any time through my device settings or the Energy Balance app.
                  </label>
                </div>

                {errors.authorization && (
                  <div className="error-message">{errors.authorization}</div>
                )}

                {errors.submit && (
                  <div className="error-message text-center">{errors.submit}</div>
                )}

                <div className="form-navigation">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleBack}
                  >
                    <ChevronLeft className="btn-icon" />
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={!formData.authorizationGiven || loading}
                  >
                    {loading ? (
                      <>
                        <div className="loading-spinner"></div>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Complete Registration
                        <Check className="btn-icon" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Connection Testing Section */}
              {formData.deviceConnected && formData.selectedDevice !== 'manual' && (
                <div className="connection-test slide-in-right">
                  <h4 className="connection-test-title">
                    <Check className="btn-icon" />
                    Connection Test
                  </h4>
                  <div className="test-results">
                    <div className="test-result-item">
                      <span className="test-result-label">Device Status:</span>
                      <span className="test-result-value">Connected</span>
                    </div>
                    <div className="test-result-item">
                      <span className="test-result-label">Last Sync:</span>
                      <span className="test-result-value">Just now</span>
                    </div>
                    <div className="test-result-item">
                      <span className="test-result-label">Data Available:</span>
                      <span className="test-result-value">
                        {selectedDeviceInfo.features.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

{/* Progress Summary */}
<ProgressSummary step={step} formData={formData} />

        {/* Help Section */}
        <div className="help-section">
          <p className="help-text">
            Need help? <button className="help-link">Contact Support</button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;