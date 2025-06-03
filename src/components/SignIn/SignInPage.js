import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase-config";
import "./SignInPage.css";

import { signInWithEmailAndPassword } from 'firebase/auth';



function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      // Query Firestore for user with matching email
      const usersRef = collection(db, 'users');
      const emailQuery = query(usersRef, where('email', '==', email.toLowerCase().trim()));
      const querySnapshot = await getDocs(emailQuery);
      
      // Debug: Log what we're searching for
      console.log('Searching for email:', email.toLowerCase().trim());
      console.log('Query results:', querySnapshot.size, 'documents found');
      
      if (querySnapshot.empty) {
        setError("No account found with this email address. Please check your email or register first.");
        setLoading(false);
        return;
      }
      
      // Get the user document
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      // Debug: Log found user data (without sensitive info)
      console.log('Found user:', { 
        name: userData.name, 
        email: userData.email,
        hasPassword: !!userData.password,
        passwordLength: userData.password?.length 
      });
      
      // Debug: Compare passwords (remove this after debugging!)
      console.log('Entered password length:', password.length);
      console.log('Passwords match:', userData.password === password);
      
      // Simple password comparison (plain text - matching FitbitCallback storage)
      if (userData.password !== password) {
        setError("Invalid email or password. Please try again.");
        setLoading(false);
        return;
      }
      
      // Check if registration is complete (debug this)
      console.log('Registration complete:', userData.registrationComplete);
      console.log('Account status:', userData.accountStatus);
      
      // TEMPORARY: Allow login even if registration incomplete
      // if (!userData.registrationComplete) {
      //   // Temporary: Let's see what's in the user data
      //   console.log('Full user data keys:', Object.keys(userData));
      //   setError("Account registration is not complete. Please complete the registration process.");
      //   setLoading(false);
      //   return;
      // }
      
      // Create session data (excluding sensitive information)
      const sessionUserData = {
        id: userDoc.id,
        name: userData.name,
        email: userData.email,
        age: userData.age,
        gender: userData.gender,
        device: userData.device,
        devicePermission: userData.devicePermission,
        fitbitUserId: userData.fitbitData?.userId,
        registrationComplete: userData.registrationComplete || false,
        accountStatus: userData.accountStatus || 'active'
      };
      
      console.log('Setting localStorage with:', sessionUserData);
      
      // Store user session data
      localStorage.setItem('userData', JSON.stringify(sessionUserData));
      
      console.log('localStorage set, attempting navigation to dashboard...');
      
      // Try multiple navigation methods that work on both localhost and GitHub Pages
      try {
        // Method 1: React Router navigate (should work for both)
        navigate('/dashboard', { replace: true });
        console.log('React Router navigate called');
        
        // Method 2: Fallback - force page refresh after short delay
        setTimeout(() => {
          console.log('Fallback: Force refresh to dashboard');
          // This works for both localhost and GitHub Pages
          const currentOrigin = window.location.origin;
          const basePath = process.env.PUBLIC_URL || '';
          window.location.href = `${currentOrigin}${basePath}/dashboard`;
        }, 1000);
        
      } catch (error) {
        console.error('Navigation error:', error);
        // Emergency fallback that works everywhere
        const currentOrigin = window.location.origin;
        const basePath = process.env.PUBLIC_URL || '';
        window.location.href = `${currentOrigin}${basePath}/dashboard`;
      }
      
      console.log('Navigate called - should redirect now');
      
    } catch (error) {
      console.error("Error signing in:", error);
      setError("An error occurred during sign in. Please try again.");
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
      </div>
    </div>
  );
}

export default SignInPage;