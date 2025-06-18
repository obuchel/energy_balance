import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

// Import your existing components
import Dashboard from './components/Dashboard/Dashboard';
import RegistrationPage from './components/Registration/RegistrationPage';
import FitbitCallback from './components/Registration/FitbitCallback';
import LoginPage from './components/Auth/LoginPage';
import FoodTrackerPage from './components/FoodTracker/FoodTrackerPage';
import FitbitDashboard from './components/Fitbit/FitbitDashboard';

// Import the new PersonalSettings component
import PersonalSettings from './components/Settings/PersonalSettings';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Authentication Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/fitbit-callback" element={<FitbitCallback />} />
            
            {/* Main Application Routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/personal-settings" element={<PersonalSettings />} />
            <Route path="/food-tracker" element={<FoodTrackerPage />} />
            <Route path="/fitbit-dashboard" element={<FitbitDashboard />} />
            
            {/* Default Route */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Catch-all route for 404s */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;