// FitbitCallback.js - Fixed version with proper security and React hooks
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from './firebase-config';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Helper function to get the correct redirect URI (must match registration)
const getRedirectUri = () => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isLocalhost) {
    return process.env.REACT_APP_FITBIT_REDIRECT_URI_DEV || 'http://localhost:3000/fitbit/callback';
  } else {
    return process.env.REACT_APP_FITBIT_REDIRECT_URI_PROD || `${window.location.origin}/fitbit/callback`;
  }
};

const FitbitCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Move the entire function inside useEffect to avoid dependency issues
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

        // For security reasons, we'll create the Firebase user first and store the Fitbit code
        // In a production app, you'd exchange the code on your backend
        setStatus('Creating your account...');
        
        await createUserWithFitbitCode(registrationData, code);

        setStatus('success');
        
        // Redirect to login page with success message
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Registration successful! Your Fitbit has been connected. Please sign in.',
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

    const createUserWithFitbitCode = async (registrationData, authCode) => {
      try {
        console.log('Creating Firebase user...');
        
        // Check if email already exists
        const usersRef = collection(db, 'users');
        const emailQuery = query(usersRef, where('email', '==', registrationData.email.toLowerCase()));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty) {
          throw new Error('An account with this email already exists');
        }

        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          registrationData.email.toLowerCase().trim(), 
          registrationData.password
        );
        
        const user = userCredential.user;
        console.log('Firebase user created:', user.uid);

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
          
          // Fitbit integration data (store the code for later server-side exchange)
          fitbitData: {
            authCode: authCode, // Store code for server-side token exchange
            redirectUri: getRedirectUri(),
            scope: 'activity heartrate location nutrition profile settings sleep social weight',
            codeReceivedAt: new Date().toISOString(),
            // Note: Actual tokens should be obtained server-side for security
          },
          
          // Energy management profile
          energyProfile: {
            baselineCalculated: false,
            currentEnergyLevel: 50,
            energyEnvelope: null,
            dailyEnergyBudget: null
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
        console.log('User data saved to Firestore');

        // Clean up session storage
        sessionStorage.removeItem('registrationData');
        sessionStorage.removeItem('fitbitOAuthState');
        sessionStorage.removeItem('fitbitAuthStartTime');

        console.log('Registration completed successfully');

      } catch (error) {
        console.error('Error creating user:', error);
        
        // Handle specific Firebase errors
        if (error.code === 'auth/email-already-in-use') {
          throw new Error('This email is already registered. Please use a different email or sign in.');
        } else if (error.code === 'auth/weak-password') {
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
  }, [location.search, navigate]); // Only depend on stable values

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
        {status === 'processing' && (
          <div>
            <h2 style={{ color: '#495057', marginBottom: '20px' }}>
              🔗 Connecting your Fitbit account...
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
            <p style={{ color: '#6c757d' }}>Please wait while we complete your registration...</p>
            {debugInfo && (
              <p style={{ fontSize: '14px', color: '#6c757d', marginTop: '10px' }}>
                Debug: {debugInfo}
              </p>
            )}
          </div>
        )}
        
        {status === 'success' && (
          <div>
            <h2 style={{ color: '#28a745', marginBottom: '20px' }}>
              ✅ Fitbit Connected Successfully!
            </h2>
            <p style={{ color: '#495057', marginBottom: '10px' }}>
              Your account has been created and your Fitbit is now connected.
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
          </div>
        )}
        
        {status === 'error' && (
          <div>
            <h2 style={{ color: '#dc3545', marginBottom: '20px' }}>
              ❌ Connection Failed
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
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
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
                Try Again
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