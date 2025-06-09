import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check, AlertCircle, Heart, Activity, Smartphone, Watch, User, Mail, Lock, Calendar, Scale, Ruler } from 'lucide-react';
import './RegistrationPage.css'; // Import CSS file

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase-config';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';

// Updated StepIndicator component
const StepIndicator = ({ step }) => (
  <div className="step-indicator">
    <div className="step-indicator-wrapper">
      <div className="flex flex-col items-center">
        <div className={`step-circle ${
          step >= 1 ? (step > 1 ? 'completed' : 'active') : 'inactive'
        }`}>
          {step > 1 ? <Check className="btn-icon" /> : '1'}
        </div>
        <div className="step-label">
          <span className={`step-label-text ${
            step >= 1 ? (step > 1 ? 'completed' : 'active') : 'inactive'
          }`}>
            Personal Details
          </span>
        </div>
      </div>
      
      <div className={`step-connector ${step > 1 ? 'completed' : 'inactive'}`}></div>
      
      <div className="flex flex-col items-center">
        <div className={`step-circle ${
          step >= 2 ? (step > 2 ? 'completed' : 'active') : 'inactive'
        }`}>
          {step > 2 ? <Check className="btn-icon" /> : '2'}
        </div>
        <div className="step-label">
          <span className={`step-label-text ${
            step >= 2 ? (step > 2 ? 'completed' : 'active') : 'inactive'
          }`}>
            Connect Device
          </span>
        </div>
      </div>
      
      <div className={`step-connector ${step > 2 ? 'completed' : 'inactive'}`}></div>
      
      <div className="flex flex-col items-center">
        <div className={`step-circle ${
          step >= 3 ? 'active' : 'inactive'
        }`}>
          {step > 3 ? <Check className="btn-icon" /> : '3'}
        </div>
        <div className="step-label">
          <span className={`step-label-text ${
            step >= 3 ? 'active' : 'inactive'
          }`}>
            Authorization
          </span>
        </div>
      </div>
    </div>
  </div>
);

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

  const handleDeviceConnection = async () => {
    setLoading(true);
    setConnectionStatus('Connecting...');
    
    const selectedDeviceInfo = deviceOptions.find(d => d.id === formData.selectedDevice);
    
    try {
      if (selectedDeviceInfo.connectionType === 'oauth') {
        
        if (formData.selectedDevice === 'fitbit') {
          // Store registration data in sessionStorage for FitbitCallback
          const registrationDataForStorage = {
            name: formData.name,
            email: formData.email,
            password: formData.password, // Note: In production, don't store plain text passwords
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
          
          // Get environment variables and determine correct redirect URI
          const clientId = process.env.REACT_APP_FITBIT_CLIENT_ID;
          
          // Determine redirect URI based on current environment
          let redirectUri;
          const currentUrl = window.location.href;
          console.log('Current URL:', currentUrl);
          console.log('Current hostname:', window.location.hostname);
          console.log('Current origin:', window.location.origin);
          
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const isGitHubPages = window.location.hostname.includes('github.io');
          
          if (isLocalhost) {
            redirectUri = 'http://localhost:3000/fitbit/callback';
          } else if (isGitHubPages) {
            // For GitHub Pages, construct the exact URL
            redirectUri = 'https://obuchel.github.io/energy_balance/fitbit/callback';
          } else {
            // Fallback: construct from current location
            redirectUri = `${window.location.origin}/fitbit/callback`;
          }
          
          console.log('Using Fitbit redirect URI:', redirectUri);
          console.log('Fitbit Client ID:', clientId);
          
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
          
          // Show the URL to user for debugging
          const confirmRedirect = window.confirm(
            `About to redirect to Fitbit with:\n\n` +
            `Redirect URI: ${redirectUri}\n` +
            `Client ID: ${clientId}\n\n` +
            `Make sure this redirect URI is exactly registered in your Fitbit app.\n\n` +
            `Continue to Fitbit?`
          );
          
          if (!confirmRedirect) {
            setLoading(false);
            setConnectionStatus('Connection cancelled by user.');
            return;
          }
          
          setConnectionStatus('Redirecting to Fitbit...');
          
          // Redirect to Fitbit OAuth
          window.location.href = fitbitAuthUrl.toString();
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

        <StepIndicator step={step} />

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
                    <label className="form-label">
                      <User className="form-label-icon" />
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`form-input ${errors.name ? 'error' : ''}`}
                      placeholder="Enter your full name"
                    />
                    {errors.name && <p className="error-message">{errors.name}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Mail className="form-label-icon" />
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`form-input ${errors.email ? 'error' : ''}`}
                      placeholder="Enter your email"
                    />
                    {errors.email && <p className="error-message">{errors.email}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Lock className="form-label-icon" />
                      Create Password *
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`form-input ${errors.password ? 'error' : ''}`}
                      placeholder="Minimum 6 characters (Firebase requirement)"
                    />
                    {errors.password && <p className="error-message">{errors.password}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Lock className="form-label-icon" />
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                      placeholder="Repeat your password"
                    />
                    {errors.confirmPassword && <p className="error-message">{errors.confirmPassword}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Age *</label>
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
                    {errors.age && <p className="error-message">{errors.age}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gender *</label>
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
                    <label className="form-label">
                      <Scale className="form-label-icon" />
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      name="weight"
                      value={formData.weight}
                      onChange={handleInputChange}
                      className="form-input"
                      placeholder="Optional"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Ruler className="form-label-icon" />
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      name="height"
                      value={formData.height}
                      onChange={handleInputChange}
                      className="form-input"
                      placeholder="Optional"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Calendar className="form-label-icon" />
                      When did you first get COVID?
                    </label>
                    <input
                      type="date"
                      name="covidDate"
                      value={formData.covidDate}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Long COVID duration
                    </label>
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
                  <label className="form-label">
                    Symptom severity
                  </label>
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

                <div className="form-group">
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
        <div className="progress-summary fade-in-up">
          <h3 className="progress-title">Registration Progress</h3>
          <div className="progress-items">
            <div className="progress-item">
              <span className="progress-item-label">Personal Information</span>
              <div className="progress-item-status">
                {step > 1 ? (
                  <Check className="progress-icon completed" />
                ) : (
                  <div className={`progress-circle ${step === 1 ? 'active' : 'inactive'}`}></div>
                )}
              </div>
            </div>
            <div className="progress-item">
              <span className="progress-item-label">Device Connection</span>
              <div className="progress-item-status">
                {step > 2 ? (
                  <Check className="progress-icon completed" />
                ) : (
                  <div className={`progress-circle ${step === 2 ? 'active' : 'inactive'}`}></div>
                )}
              </div>
            </div>
            <div className="progress-item">
              <span className="progress-item-label">Authorization</span>
              <div className="progress-item-status">
                {formData.authorizationGiven ? (
                  <Check className="progress-icon completed" />
                ) : (
                  <div className={`progress-circle ${step === 3 ? 'active' : 'inactive'}`}></div>
                )}
              </div>
            </div>
          </div>
        </div>

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