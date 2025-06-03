// FitbitCallback.js - Component to handle OAuth return
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase-config';

const FitbitCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    handleFitbitCallback();
  }, []);

  const handleFitbitCallback = async () => {
    try {
      // Parse URL parameters
      const urlParams = new URLSearchParams(location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      console.log('Callback URL params:', { code: !!code, state: !!state, error });

      // Handle OAuth errors
      if (error) {
        if (error === 'access_denied') {
          setError('Fitbit authorization was denied. Please try again.');
        } else {
          setError(`Fitbit authorization failed: ${error}`);
        }
        setStatus('error');
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setError('Invalid callback parameters from Fitbit.');
        setStatus('error');
        return;
      }

      // Verify state parameter (CSRF protection)
      const storedState = sessionStorage.getItem('fitbitOAuthState');
      if (state !== storedState) {
        setError('Invalid state parameter. Possible security issue.');
        setStatus('error');
        return;
      }

      // Retrieve stored registration data
      const registrationDataStr = sessionStorage.getItem('registrationData');
      if (!registrationDataStr) {
        setError('Registration data not found. Please start registration again.');
        setStatus('error');
        return;
      }

      const registrationData = JSON.parse(registrationDataStr);

      // Exchange authorization code for access token
      const tokenData = await exchangeCodeForToken(code);
      
      // Create user account with Fitbit tokens
      await createUserWithFitbitData(registrationData, tokenData);

      setStatus('success');
      
      // Redirect to dashboard after short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (error) {
      console.error('Fitbit callback error:', error);
      setError(`Failed to complete Fitbit integration: ${error.message}`);
      setStatus('error');
    }
  };

  const exchangeCodeForToken = async (code) => {
    const clientId = process.env.REACT_APP_FITBIT_CLIENT_ID;
    const clientSecret = process.env.REACT_APP_FITBIT_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Fitbit client credentials not configured');
    }
    
    // Get the exact redirect URI that was used for authorization
    const redirectUri = getRedirectUri();
    
    console.log('Token exchange - Using redirect URI:', redirectUri);

    // Create Basic Auth header
    const credentials = btoa(`${clientId}:${clientSecret}`);

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });

    console.log('Token request body:', tokenParams.toString());

    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams,
    });

    const responseData = await response.json();
    console.log('Token response status:', response.status);
    
    if (!response.ok) {
      console.error('Token exchange error:', responseData);
      throw new Error(`Token exchange failed: ${responseData.error_description || responseData.error || response.statusText}`);
    }

    return responseData;
  };

  // Helper function to get the correct redirect URI (should match registration)
  const getRedirectUri = () => {
    const currentUrl = window.location.origin;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    if (isLocalhost) {
      return process.env.REACT_APP_FITBIT_REDIRECT_URI_DEV || 'http://localhost:3000/fitbit/callback';
    } else if (isGitHubPages) {
      return process.env.REACT_APP_FITBIT_REDIRECT_URI_PROD || `${currentUrl}/fitbit/callback`;
    } else {
      return `${currentUrl}/fitbit/callback`;
    }
  };

  const createUserWithFitbitData = async (registrationData, tokenData) => {
    try {
      // Check if email already exists
      const usersRef = collection(db, 'users');
      const emailQuery = query(usersRef, where('email', '==', registrationData.email));
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        throw new Error('An account with this email already exists');
      }

      // Get Fitbit user profile
      const profileData = await getFitbitUserProfile(tokenData.access_token);

      // Calculate token expiration
      const tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Prepare complete user data
      const userData = {
        // Registration data
        name: registrationData.name,
        email: registrationData.email,
        password: registrationData.password, // Consider hashing in production
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
        device: 'fitbit',
        devicePermission: true,
        
        // Fitbit integration data
        fitbitData: {
          userId: profileData.user.encodedId,
          displayName: profileData.user.displayName,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenType: tokenData.token_type,
          scope: tokenData.scope,
          expiresIn: tokenData.expires_in,
          tokenExpiresAt: tokenExpiresAt,
          tokenCreatedAt: new Date(),
          profileData: profileData.user
        },
        
        // Metadata
        createdAt: new Date(),
        lastUpdated: new Date(),
        registrationComplete: true,
        accountStatus: 'active'
      };

      // Create user document
      const docRef = await addDoc(collection(db, 'users'), userData);
      console.log('User created with ID:', docRef.id);

      // Store user session data (without sensitive tokens)
      const sessionUserData = {
        id: docRef.id,
        name: registrationData.name,
        email: registrationData.email,
        age: parseInt(registrationData.age),
        gender: registrationData.gender,
        device: 'fitbit',
        devicePermission: true,
        fitbitUserId: profileData.user.encodedId,
        registrationComplete: true
      };

      // Use sessionStorage instead of localStorage for security
      sessionStorage.setItem('userData', JSON.stringify(sessionUserData));

      // Clean up temporary session storage
      sessionStorage.removeItem('registrationData');
      sessionStorage.removeItem('fitbitOAuthState');
      sessionStorage.removeItem('fitbitAuthStartTime');

    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  };

  const getFitbitUserProfile = async (accessToken) => {
    try {
      const response = await fetch('https://api.fitbit.com/1/user/-/profile.json', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to get Fitbit profile: ${errorData.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Profile fetch error:', error);
      throw error;
    }
  };

  return (
    <div className="fitbit-callback-container" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div className="callback-content" style={{
        textAlign: 'center',
        maxWidth: '400px',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        backgroundColor: 'white'
      }}>
        {status === 'processing' && (
          <div>
            <h2>Connecting your Fitbit account...</h2>
            <div className="spinner" style={{
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #3498db',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              animation: 'spin 2s linear infinite',
              margin: '20px auto'
            }}></div>
            <p>Please wait while we complete your registration.</p>
          </div>
        )}
        
        {status === 'success' && (
          <div>
            <h2 style={{ color: '#28a745' }}>✅ Fitbit Connected Successfully!</h2>
            <p>Your account has been created and your Fitbit is now connected.</p>
            <p>Redirecting to your dashboard...</p>
          </div>
        )}
        
        {status === 'error' && (
          <div>
            <h2 style={{ color: '#dc3545' }}>❌ Connection Failed</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>{error}</p>
            <button 
              onClick={() => navigate('/register')}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FitbitCallback;