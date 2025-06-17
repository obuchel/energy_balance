import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RegistrationPage from './components/Register/RegistrationPage';
import FitbitCallback from './FitbitCallback';
import Dashboard from './components/Dashboard/Dashboard';
import SignInPage from './components/SignIn/SignInPage';
import FoodTrackerPage from './components/FoodTracker/FoodTrackerPage';
import FitbitDashboard from './components/FitbitDashboard/FitbitDashboard'; // Add this import
import './App.css';

function App() {
  // Check if user is authenticated
  const isAuthenticated = () => {
    const userData = localStorage.getItem('userData');
    console.log('Checking authentication, userData exists:', !!userData);
    if (!userData) return false;
    
    try {
      const user = JSON.parse(userData);
      console.log('Parsed user ID:', user.id);
      return user && user.id; // Just check if user has an ID
    } catch (error) {
      console.error('Error parsing user data:', error);
      return false;
    }
  };

  // Protected Route component
  const ProtectedRoute = ({ children }) => {
    const isAuth = isAuthenticated();
    console.log('ProtectedRoute - isAuthenticated:', isAuth);
    return isAuth ? children : <Navigate to="/login" replace />;
  };

  // Public Route component (redirect to dashboard if already authenticated)
  const PublicRoute = ({ children }) => {
    const isAuth = isAuthenticated();
    console.log('PublicRoute - isAuthenticated:', isAuth);
    return !isAuth ? children : <Navigate to="/dashboard" replace />;
  };

  console.log('App rendering, checking routes...');

  return (
    <Router basename={process.env.PUBLIC_URL || ''}>
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <SignInPage />
              </PublicRoute>
            } 
          />
          
          <Route 
            path="/register" 
            element={
              <PublicRoute>
                <RegistrationPage />
              </PublicRoute>
            } 
          />
          
          {/* Fitbit OAuth callback route - accessible during registration flow */}
          <Route 
            path="/fitbit/callback" 
            element={<FitbitCallback />} 
          />
          
          {/* Protected routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Add Food Tracker route */}
          <Route 
            path="/food-tracker" 
            element={
              <ProtectedRoute>
                <FoodTrackerPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Add Fitbit Dashboard route */}
          <Route 
            path="/fitbit-dashboard" 
            element={
              <ProtectedRoute>
                <FitbitDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Default route - redirect based on authentication status */}
          <Route 
            path="/" 
            element={
              isAuthenticated() ? 
                <Navigate to="/dashboard" replace /> : 
                <Navigate to="/login" replace />
            } 
          />
          
          {/* Catch all other routes */}
          <Route 
            path="*" 
            element={
              <div className="not-found">
                <h2>Page Not Found</h2>
                <p>The page you're looking for doesn't exist.</p>
                <p>Current path: {window.location.pathname}</p>
                <button onClick={() => window.location.href = '/'}>
                  Go Home
                </button>
              </div>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;