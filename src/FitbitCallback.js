// Updated FitbitCallback.js - Complete version that avoids CORS issues
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from './firebase-config';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Helper function to get the correct redirect URI (must match registration)
// Use this EXACT getRedirectUri function in BOTH FitbitCallback.js and RegistrationPage.js
// This ensures consistency and matches your Fitbit app registration

const getRedirectUri = () => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  console.log('=== REDIRECT URI DEBUG ===');
  console.log('Hostname:', hostname);
  console.log('Port:', port);
  console.log('Full URL:', window.location.href);
  
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isGitHubPages = hostname.includes('github.io');
  
  let redirectUri;
  
  if (isLocalhost) {
    // For localhost development
    // IMPORTANT: Make sure this matches what you register in dev.fitbit.com for localhost
    const actualPort = port || '64556';
    redirectUri = `http://localhost:${actualPort}/energy_balance/fitbit-dashboard/callback`;
  } else if (isGitHubPages) {
    // For GitHub Pages deployment - THIS MUST EXACTLY MATCH your Fitbit app registration
    redirectUri = 'https://obuchel.github.io/energy_balance/fitbit-dashboard/callback';
  } else {
    // For other deployments
    redirectUri = `${window.location.origin}/energy_balance/fitbit-dashboard/callback`;
  }
  
  console.log('Generated redirect URI:', redirectUri);
  console.log('This should match your Fitbit app registration EXACTLY');
  console.log('=== END DEBUG ===');
  
  return redirectUri;
};

const FitbitCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleFitbitCallback = async () => {
      try {
        console.log('=== Fitbit Callback Started ===');
        console.log('Full URL:', window.location.href);
        console.log('Search params:', location.search);
        
        // Parse URL parameters
        const urlParams = new URLSearchParams(location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        console.log('Callback params:', { 
          code: code ? code.substring(0, 10) + '...' : null, 
          state: state ? state.substring(0, 10) + '...' : null, 
          error,
          errorDescription 
        });

        setDebugInfo(`Code: ${code ? 'Present' : 'Missing'}, State: ${state ? 'Present' : 'Missing'}`);

        // Handle OAuth errors
        if (error) {
          let errorMessage = 'Fitbit authorization failed';
          if (error === 'access_denied') {
            errorMessage = 'You denied access to Fitbit. Please try again and authorize access.';
          } else if (errorDescription) {
            errorMessage = `Fitbit error: ${errorDescription}`;
          } else {
            errorMessage = `Fitbit error: ${error}`;
          }
          setError(errorMessage);
          setStatus('error');
          return;
        }

        // Validate required parameters
        if (!code) {
          setError('No authorization code received from Fitbit. Please try the registration process again.');
          setStatus('error');
          return;
        }

        if (!state) {
          setError('No state parameter received from Fitbit. Please try the registration process again.');
          setStatus('error');
          return;
        }

        // Verify state parameter (CSRF protection)
        const storedState = sessionStorage.getItem('fitbitOAuthState');
        console.log('State verification:', { received: state.substring(0, 10) + '...', stored: storedState ? storedState.substring(0, 10) + '...' : null });
        
        if (state !== storedState) {
          setError('Security validation failed. Please start the registration process again.');
          setStatus('error');
          return;
        }

        // Check for session timeout (optional)
        const authStartTime = sessionStorage.getItem('fitbitAuthStartTime');
        if (authStartTime) {
          const elapsed = Date.now() - parseInt(authStartTime);
          if (elapsed > 600000) { // 10 minutes
            setError('Session expired. Please start the registration process again.');
            setStatus('error');
            return;
          }
        }

        // Retrieve stored registration data
        const registrationDataStr = sessionStorage.getItem('registrationData');
        if (!registrationDataStr) {
          setError('Registration data not found. Please start the registration process again.');
          setStatus('error');
          return;
        }

        const registrationData = JSON.parse(registrationDataStr);
        console.log('Registration data found for:', registrationData.email);

        // Create Firebase user with the auth code (no token exchange yet)
        setStatus('Creating your account...');
        
        await createUserWithFitbitCode(registrationData, code);

        setStatus('success');
        
        // Redirect to login page with success message
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Registration successful! Your Fitbit has been connected. Sign in to start using the app.',
              email: registrationData.email 
            }
          });
        }, 3000);

      } catch (error) {
        console.error('Fitbit callback error:', error);
        setError(`Failed to complete registration: ${error.message}`);
        setStatus('error');
      }
    };

    // Simplified user creation - no API calls, just save the auth code
    const createUserWithFitbitCode = async (registrationData, authCode) => {
      try {
        console.log('Creating Firebase user...');
        
        // Check if email already exists in Firestore
        const usersRef = collection(db, 'users');
        const emailQuery = query(usersRef, where('email', '==', registrationData.email.toLowerCase()));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty) {
          throw new Error('This email already exists in our database. Please use a different email or sign in.');
        }
    
        let user;
        
        try {
          // Try to create new Firebase Auth user
          console.log('🔐 Attempting to create new Firebase Auth user...');
          const userCredential = await createUserWithEmailAndPassword(
            auth, 
            registrationData.email.toLowerCase().trim(), 
            registrationData.password
          );
          user = userCredential.user;
          console.log('✅ New Firebase Auth user created:', user.uid);
          
        } catch (authError) {
          if (authError.code === 'auth/email-already-in-use') {
            console.log('🔄 Email exists in Firebase Auth, but not in Firestore. Completing registration...');
            
            // Sign in to get the existing user
            const { signInWithEmailAndPassword } = await import('firebase/auth');
            try {
              const signInResult = await signInWithEmailAndPassword(
                auth,
                registrationData.email.toLowerCase().trim(),
                registrationData.password
              );
              user = signInResult.user;
              console.log('✅ Signed in to existing Firebase Auth user:', user.uid);
              
              setStatus('Completing your profile setup...');
            } catch (signInError) {
              throw new Error('Email exists in Firebase Auth but password doesn\'t match. Please use the correct password or try password reset.');
            }
          } else {
            throw authError; // Re-throw other auth errors
          }
        }
    
        setStatus('Saving your profile...');
        
        // Prepare complete user data
        const userData = {
          uid: user.uid,
          name: registrationData.name.trim(),
          email: registrationData.email.toLowerCase().trim(),
          age: parseInt(registrationData.age),
          gender: registrationData.gender,
          weight: registrationData.weight ? parseFloat(registrationData.weight) : null,
          height: registrationData.height ? parseFloat(registrationData.height) : null,
          covidDate: registrationData.covidDate || null,
          covidDuration: registrationData.covidDuration || null,
          severity: registrationData.severity || null,
          symptoms: registrationData.symptoms || [],
          medicalConditions: registrationData.medicalConditions || '',
          
          // Device configuration
          selectedDevice: 'fitbit',
          deviceConnected: true,
          authorizationGiven: true,
          
          // Store auth code for later token exchange via serverless API
          fitbitData: {
            authCode: authCode,
            redirectUri: getRedirectUri(),
            authCodeReceivedAt: new Date().toISOString(),
            tokensExchanged: false,
          },
          
          // Placeholder for data that will be fetched later
          latestFitbitData: {
            date: null,
            heartRate: null,
            steps: null,
            calories: null,
            distance: null,
            activeMinutes: null,
            lastSync: null,
            needsInitialSync: true,
          },
          
          // Energy management profile
          energyProfile: {
            baselineCalculated: false,
            currentEnergyLevel: 50,
            energyEnvelope: null,
            dailyEnergyBudget: null,
          },
          
          // User preferences
          preferences: {
            notifications: true,
            reminderFrequency: 'daily',
            dataRetention: '1year'
          },
          
          // Metadata
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          registrationComplete: true,
          accountStatus: 'active'
        };
    
        // Create user document with UID as document ID
        await setDoc(doc(db, 'users', user.uid), userData);
        console.log('✅ User data saved to Firestore');
    
        // Clean up session storage
        sessionStorage.removeItem('registrationData');
        sessionStorage.removeItem('fitbitOAuthState');
        sessionStorage.removeItem('fitbitAuthStartTime');
    
        console.log('✅ Registration completed successfully');
    
      } catch (error) {
        console.error('❌ Registration error:', error);
        
        // Handle specific Firebase errors
        if (error.code === 'auth/weak-password') {
          throw new Error('Password is too weak. Please choose a stronger password.');
        } else if (error.code === 'auth/invalid-email') {
          throw new Error('Invalid email address format.');
        } else {
          throw new Error(`Registration failed: ${error.message}`);
        }
      }
    };

    // Call the function immediately
    handleFitbitCallback();
  }, [location.search, navigate]);

  const handleRetry = () => {
    // Clear any stored data and redirect to registration
    sessionStorage.removeItem('registrationData');
    sessionStorage.removeItem('fitbitOAuthState');
    sessionStorage.removeItem('fitbitAuthStartTime');
    navigate('/register');
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="fitbit-callback-container" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f8f9fa'
    }}>
      <div className="callback-content" style={{
        textAlign: 'center',
        maxWidth: '500px',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        backgroundColor: 'white'
      }}>
        {(status === 'processing' || status === 'Creating your account...' || status === 'Saving your profile...') && (
          <div>
            <h2 style={{ color: '#495057', marginBottom: '20px' }}>
              🔗 {status === 'processing' ? 'Processing your Fitbit connection...' : status}
            </h2>
            <div className="spinner" style={{
              border: '4px solid #e9ecef',
              borderTop: '4px solid #007bff',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              animation: 'spin 1s linear infinite',
              margin: '20px auto'
            }}></div>
            <p style={{ color: '#6c757d' }}>
              {status === 'processing' && 'Please wait while we complete your registration...'}
              {status === 'Creating your account...' && 'Setting up your Firebase account...'}
              {status === 'Saving your profile...' && 'Saving your profile and Fitbit connection...'}
            </p>
            {debugInfo && status === 'processing' && (
              <p style={{ fontSize: '14px', color: '#6c757d', marginTop: '10px' }}>
                Debug: {debugInfo}
              </p>
            )}
          </div>
        )}
        
        {status === 'success' && (
          <div>
            <h2 style={{ color: '#28a745', marginBottom: '20px' }}>
              ✅ Registration Completed Successfully!
            </h2>
            <p style={{ color: '#495057', marginBottom: '10px' }}>
              Your account has been created and your Fitbit has been connected.
            </p>
            <p style={{ color: '#6c757d', fontSize: '14px' }}>
              Redirecting to sign in page...
            </p>
            <div className="success-animation" style={{
              width: '60px',
              height: '60px',
              margin: '20px auto',
              borderRadius: '50%',
              backgroundColor: '#28a745',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: 'white',
              animation: 'pulse 2s infinite'
            }}>
              ✓
            </div>
            <div style={{ 
              backgroundColor: '#d4edda', 
              border: '1px solid #c3e6cb', 
              borderRadius: '8px', 
              padding: '12px', 
              marginTop: '20px',
              fontSize: '14px',
              color: '#155724'
            }}>
              <strong>Note:</strong> Your Fitbit data will be synced when you first access your dashboard.
            </div>
          </div>
        )}
        
        {status === 'error' && (
          <div>
            <h2 style={{ color: '#dc3545', marginBottom: '20px' }}>
              ❌ Registration Failed
            </h2>
            <div style={{
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '20px'
            }}>
              <p style={{ color: '#721c24', margin: '0', fontSize: '14px' }}>
                {error}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={handleRetry}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                Try Registration Again
              </button>
              <button 
                onClick={handleGoToLogin}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                Go to Login
              </button>
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default FitbitCallback;