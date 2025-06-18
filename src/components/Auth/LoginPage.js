import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase-config";
import "./SignInPage.css";

function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Check for registration success message
  const registrationMessage = location.state?.message;
  const prefillEmail = location.state?.email;

  // Pre-fill email if coming from registration
  React.useEffect(() => {
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [prefillEmail]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const cleanEmail = email.toLowerCase().trim();
      const cleanPassword = password.trim();

      // Basic validation
      if (!cleanEmail || !cleanPassword) {
        throw new Error('Please enter both email and password');
      }

      if (cleanPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Check Firebase Auth configuration
      if (!auth) {
        throw new Error('Firebase Auth not properly configured');
      }

      console.log('Attempting Firebase Auth login for:', cleanEmail);
      console.log('Password length:', cleanPassword.length);
      console.log('Firebase Auth config:', {
        apiKey: auth.config?.apiKey ? 'Present' : 'Missing',
        authDomain: auth.config?.authDomain,
        projectId: auth.config?.projectId
      });
      
      // Clear any existing authentication state first
      if (auth.currentUser) {
        console.log('Clearing previous auth state for:', auth.currentUser.email);
        await signOut(auth); // Fixed: Use signOut(auth) instead of auth.signOut()
      }
      
      // Clear any existing session data
      localStorage.removeItem('userData');
      console.log('Cleared localStorage userData');
      
      // Use Firebase Authentication (SECURE)
      console.log('Calling signInWithEmailAndPassword...');
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const user = userCredential.user;
      
      console.log('Firebase Auth successful for:', user.email);
      console.log('New user UID:', user.uid);
      console.log('Email verified:', user.emailVerified);
      
      // Verify this is the correct user by checking email match
      if (user.email.toLowerCase() !== cleanEmail) {
        console.error('Email mismatch!');
        console.error('Requested:', cleanEmail);
        console.error('Authenticated:', user.email);
        throw new Error('Authentication error - email mismatch');
      }
      
      // Get user profile data from Firestore using the UID
      console.log('Looking for Firestore document with UID:', user.uid);
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        console.error('User document not found in Firestore for UID:', user.uid);
        console.error('Firebase Auth email:', user.email);
        console.error('Firebase Auth UID:', user.uid);
        setError("User profile not found. Please contact support or try registering again.");
        
        // Sign out the user since we can't find their profile
        await signOut(auth); // Fixed: Use signOut(auth) instead of auth.signOut()
        setLoading(false);
        return;
      }
      
      const userData = userDocSnap.data();
      console.log('User profile loaded from Firestore');
      console.log('Firestore email:', userData.email);
      console.log('Auth email match:', userData.email === user.email);
      
      // Double-check email consistency between Firebase Auth and Firestore
      if (userData.email && userData.email.toLowerCase() !== user.email.toLowerCase()) {
        console.warn('Email mismatch between Firebase Auth and Firestore');
        console.warn('Firebase Auth:', user.email);
        console.warn('Firestore:', userData.email);
        // This is just a warning, not necessarily an error
      }
      
      // Create session data (NO PASSWORDS - only profile data)
      const sessionUserData = {
        id: user.uid, // Using 'id' to match your auth checker expectations
        uid: user.uid, // Also keep 'uid' for Firebase compatibility
        email: user.email, // Use Firebase Auth email as source of truth
        emailVerified: user.emailVerified,
        name: userData.name,
        age: userData.age,
        gender: userData.gender,
        selectedDevice: userData.selectedDevice,
        deviceConnected: userData.deviceConnected,
        authorizationGiven: userData.authorizationGiven,
        energyProfile: userData.energyProfile,
        preferences: userData.preferences,
        createdAt: userData.createdAt,
        lastLoginAt: new Date().toISOString(),
        // Add any other fields your app expects
        device: userData.selectedDevice, // If your app expects 'device' instead of 'selectedDevice'
        devicePermission: userData.authorizationGiven, // If your app expects 'devicePermission'
        registrationComplete: true, // Mark as complete since they logged in successfully
        accountStatus: 'active'
      };
      
      console.log('Setting localStorage with secure session data');
      console.log('Session data being stored:', {
        id: sessionUserData.id,
        uid: sessionUserData.uid,
        email: sessionUserData.email,
        name: sessionUserData.name
      });
      
      // Store user session data (NO PASSWORDS)
      localStorage.setItem('userData', JSON.stringify(sessionUserData));
      
      // Verify what was actually stored
      const storedData = JSON.parse(localStorage.getItem('userData'));
      console.log('Verification - data actually stored in localStorage:', {
        id: storedData.id,
        uid: storedData.uid,
        email: storedData.email,
        name: storedData.name
      });
      
      // Update last login time in Firestore (optional)
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastLoginAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      } catch (updateError) {
        console.warn('Could not update last login time:', updateError);
        // Don't fail login if we can't update timestamp
      }
      
      console.log('Login successful, navigating to dashboard');
      
      // Navigate to dashboard
      navigate('/dashboard', { replace: true });
      
    } catch (error) {
      console.error("Firebase Auth error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Full error object:", JSON.stringify(error, null, 2));
      
      // Make sure to clear any partial auth state on error
      try {
        if (auth.currentUser) {
          await signOut(auth);
        }
        localStorage.removeItem('userData');
      } catch (cleanupError) {
        console.warn('Error during cleanup:', cleanupError);
      }
      
      let errorMessage = "An error occurred during sign in. Please try again.";
      
      // Handle specific Firebase Auth errors
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = "No account found with this email address. Please check your email or register first.";
          break;
        case 'auth/wrong-password':
          errorMessage = "Incorrect password. Please try again.";
          break;
        case 'auth/invalid-email':
          errorMessage = "Invalid email address format.";
          break;
        case 'auth/user-disabled':
          errorMessage = "This account has been disabled. Please contact support.";
          break;
        case 'auth/too-many-requests':
          errorMessage = "Too many failed login attempts. Please wait a few minutes and try again.";
          break;
        case 'auth/network-request-failed':
          errorMessage = "Network error. Please check your internet connection and try again.";
          break;
        case 'auth/invalid-credential':
          errorMessage = "Invalid login credentials. Please check your email and password.";
          break;
        case 'auth/operation-not-allowed':
          errorMessage = "Email/password authentication is not enabled. Please contact support.";
          break;
        case 'auth/weak-password':
          errorMessage = "Password is too weak. Please choose a stronger password.";
          break;
        default:
          if (error.message.includes('User profile not found')) {
            errorMessage = error.message;
          } else if (error.message.includes('email mismatch')) {
            errorMessage = "Authentication error. Please try again.";
          } else if (error.code) {
            errorMessage = `Authentication failed: ${error.code}. Please try again or contact support.`;
          }
          break;
      }
      
      console.error("Final error message shown to user:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-card">
        <div className="signin-header">
          <h1>Welcome Back</h1>
          <p>Sign in to your Energy Balance account</p>
        </div>
        
        {/* Show registration success message */}
        {registrationMessage && (
          <div className="success-message">
            {registrationMessage}
          </div>
        )}
        
        {error && <div className="error-message">{error}</div>}
        
        <form className="signin-form" onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              minLength="6"
            />
            <div className="forgot-password">
              <a href="#forgot">Forgot your password?</a>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="signin-button"
            disabled={loading}
          >
            {loading && <span className="loading-spinner"></span>}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        
        <div className="divider">or</div>
        
        <div className="signup-link">
          Don't have an account? <Link to="/register">Sign up here</Link>
        </div>
        
        {/* About Energy Balance Section */}
        <div className="about-section">
          <h3>About Energy Balance</h3>
          <p>
            Energy Balance is a comprehensive health management system designed to help individuals 
            recovering from Long COVID. Our platform helps you track and manage your energy levels, 
            physical activity, and overall well-being through seamless integration with your wearable devices.
          </p>
          <p>
            By monitoring your daily activities and energy expenditure, we help you maintain a healthy 
            balance and prevent post-exertional malaise (PEM) episodes.
          </p>
          
          <div className="supported-devices">
            <h4>Supported Devices</h4>
            <div className="device-icons">
              <div className="device-item">
                <span className="device-icon">⌚</span>
                <span>Apple Watch</span>
              </div>
              <div className="device-item">
                <span className="device-icon">📱</span>
                <span>Fitbit</span>
              </div>
              <div className="device-item">
                <span className="device-icon">⌚</span>
                <span>Garmin</span>
              </div>
              <div className="device-item">
                <span className="device-icon">📱</span>
                <span>Samsung Health</span>
              </div>
              <div className="device-item">
                <span className="device-icon">📊</span>
                <span>Manual Entry</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="debug-info" style={{marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', fontSize: '12px'}}>
            <strong>Debug Info:</strong><br/>
            Firebase Auth URL: {auth.config?.authDomain}<br/>
            Form Email: {email || 'None'}<br/>
            Current Auth User: {auth.currentUser?.email || 'None'}<br/>
            LocalStorage User: {(() => {
              try {
                const userData = JSON.parse(localStorage.getItem('userData') || '{}');
                return userData.email || 'None';
              } catch {
                return 'Invalid/None';
              }
            })()}<br/>
            Environment: {process.env.NODE_ENV}
          </div>
        )}
      </div>
    </div>
  );
}

export default SignInPage;