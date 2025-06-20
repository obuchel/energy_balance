import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RegistrationPage from './components/Register/RegistrationPage';
import FitbitCallback from './FitbitCallback';
import Dashboard from './components/Dashboard/Dashboard';
import SignInPage from './components/SignIn/SignInPage';
import FitbitDashboard from './components/FitbitDashboard/FitbitDashboard';
import PersonalSettings from './components/Settings/PersonalSettings';
import './App.css';

// Lazy load components that need Pyodide
const FoodTrackerPage = lazy(() => import('./components/FoodTracker/FoodTrackerPage'));

// Loading component for Pyodide-dependent routes
const PyodideLoadingFallback = () => (
  <div className="pyodide-loading">
    <div className="loading-spinner"></div>
    <p>Loading Python environment...</p>
    <p>This may take a few seconds on first load.</p>
  </div>
);

// Pyodide initialization hook
const usePyodide = () => {
  const [pyodideStatus, setPyodideStatus] = useState('loading');
  
  useEffect(() => {
    let isMounted = true;
    
    const initializePyodide = async () => {
      try {
        console.log("🔄 Loading Pyodide for enhanced food search...");
        
        // Check if loadPyodide is available
        if (typeof window.loadPyodide === 'undefined') {
          console.error("❌ loadPyodide is not available. Make sure Pyodide script is loaded.");
          if (isMounted) {
            setPyodideStatus('error');
          }
          return;
        }
        
        // Load Pyodide with error handling
        console.log("📥 Downloading Pyodide...");
        const pyodide = await window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
          stdout: (text) => console.log("Pyodide stdout:", text),
          stderr: (text) => console.error("Pyodide stderr:", text)
        });
        
        console.log("✅ Pyodide loaded successfully");
        
        // Store globally for access from other components
        window.pyodide = pyodide;
        
        console.log("📦 Installing Python packages...");
        try {
          // Install required packages with timeout
          await Promise.race([
            pyodide.loadPackage(['numpy', 'scikit-learn']),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Package installation timeout')), 30000)
            )
          ]);
          console.log("✅ Python packages installed successfully");
        } catch (packageError) {
          console.error("❌ Failed to install packages:", packageError);
          throw new Error(`Package installation failed: ${packageError.message}`);
        }
        
        console.log("🧠 Setting up AI search engine...");
        // Setup the search engine
        await pyodide.runPython(`
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import json
import re

class ClientSideSearch:
    def __init__(self):
        # Advanced TF-IDF configuration for food search
        self.vectorizer = TfidfVectorizer(
            stop_words='english',
            ngram_range=(1, 3),  # Include trigrams for better matching
            max_features=5000,
            lowercase=True,
            token_pattern=r'\\b\\w+\\b',
            min_df=1,  # Include rare terms
            max_df=0.95  # Exclude very common terms
        )
        self.food_vectors = None
        self.foods = []
        self.search_texts = []
    
    def build_index(self, foods_json):
        """Build the search index from food data"""
        try:
            self.foods = json.loads(foods_json)
            self.search_texts = []
            
            for food in self.foods:
                text_parts = []
                
                # Primary name (weighted heavily by duplication)
                name = food.get('name', '')
                if name:
                    text_parts.extend([name, name, name])  # Triple weight for name
                
                # Category
                category = food.get('category', '')
                if category:
                    text_parts.append(category)
                
                # Description
                description = food.get('description', '')
                if description:
                    text_parts.append(description)
                
                # Add Long COVID benefits for relevant searches
                benefits = food.get('longCovidBenefits', [])
                if benefits:
                    text_parts.extend(benefits)
                
                # Add individual words for partial matching
                name_words = re.findall(r'\\b\\w+\\b', name.lower())
                for word in name_words:
                    if len(word) > 2:  # Skip very short words
                        text_parts.append(word)
                        # Add common food variations
                        if word.endswith('s'):
                            text_parts.append(word[:-1])  # Singular form
                
                # Combine all text parts
                search_text = ' '.join(text_parts)
                self.search_texts.append(search_text)
            
            # Build TF-IDF vectors
            if self.search_texts:
                self.food_vectors = self.vectorizer.fit_transform(self.search_texts)
                return f"✅ Search index built for {len(self.foods)} foods"
            else:
                return "❌ No valid food data provided"
                
        except Exception as e:
            return f"❌ Error building index: {str(e)}"
    
    def search(self, query, limit=20):
        """Perform intelligent multi-strategy search"""
        if self.food_vectors is None or not query.strip():
            return []
        
        try:
            # Clean and prepare query
            clean_query = query.lower().strip()
            
            # Strategy 1: TF-IDF semantic similarity search
            query_vector = self.vectorizer.transform([clean_query])
            similarities = cosine_similarity(query_vector, self.food_vectors)[0]
            
            results = []
            
            # Collect semantic matches
            for i, score in enumerate(similarities):
                if score > 0.05:  # Lower threshold for more inclusive results
                    food = self.foods[i].copy()
                    food['search_score'] = float(score)
                    food['match_type'] = 'semantic'
                    results.append(food)
            
            # Strategy 2: Exact substring matching (boost scores)
            for i, food in enumerate(self.foods):
                name_lower = food.get('name', '').lower()
                if clean_query in name_lower:
                    # Check if already in results
                    existing = next((r for r in results if r.get('id') == food.get('id')), None)
                    if existing:
                        # Boost existing semantic score
                        existing['search_score'] += 0.6
                        existing['match_type'] = 'exact_substring'
                    else:
                        # Add new exact match
                        food_copy = food.copy()
                        food_copy['search_score'] = 0.8
                        food_copy['match_type'] = 'exact_substring'
                        results.append(food_copy)
            
            # Strategy 3: Word prefix matching
            query_words = clean_query.split()
            for i, food in enumerate(self.foods):
                name_lower = food.get('name', '').lower()
                name_words = name_lower.split()
                
                word_matches = 0
                for q_word in query_words:
                    if len(q_word) > 1:  # Skip single letters
                        for n_word in name_words:
                            if n_word.startswith(q_word):
                                word_matches += 1
                                break
                
                if word_matches > 0:
                    match_ratio = word_matches / len(query_words)
                    existing = next((r for r in results if r.get('id') == food.get('id')), None)
                    if existing:
                        existing['search_score'] += match_ratio * 0.4
                    else:
                        food_copy = food.copy()
                        food_copy['search_score'] = match_ratio * 0.6
                        food_copy['match_type'] = 'word_prefix'
                        results.append(food_copy)
            
            # Strategy 4: Category matching
            for i, food in enumerate(self.foods):
                category_lower = food.get('category', '').lower()
                if category_lower and clean_query in category_lower:
                    existing = next((r for r in results if r.get('id') == food.get('id')), None)
                    if existing:
                        existing['search_score'] += 0.3
                    else:
                        food_copy = food.copy()
                        food_copy['search_score'] = 0.5
                        food_copy['match_type'] = 'category'
                        results.append(food_copy)
            
            # Sort by relevance score and return top results
            results.sort(key=lambda x: x['search_score'], reverse=True)
            return results[:limit]
            
        except Exception as e:
            print(f"Search error: {str(e)}")
            return []

# Create global search engine instance
search_engine = ClientSideSearch()
print("🚀 Python search engine initialized")
        `);
        
        // Mark as ready only if component is still mounted
        if (isMounted) {
          window.pyodideReady = true;
          window.searchIndexBuilt = false;
          
          console.log("✅ Enhanced AI food search is ready!");
          setPyodideStatus('ready');
          
          // Dispatch custom event to notify React components
          window.dispatchEvent(new CustomEvent('pyodideReady', {
            detail: { ready: true }
          }));
        }
        
      } catch (error) {
        console.error("❌ Failed to load Pyodide:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
        if (isMounted) {
          window.pyodideReady = false;
          setPyodideStatus('error');
          
          // Dispatch error event with more details
          window.dispatchEvent(new CustomEvent('pyodideError', {
            detail: { 
              error: error.message,
              type: error.name,
              phase: error.message.includes('Package') ? 'package_install' : 
                     error.message.includes('loadPyodide') ? 'pyodide_load' : 'unknown'
            }
          }));
        }
      }
    };

    // Only load Pyodide once and if not already loaded
    if (!window.pyodide && !window.pyodideReady && pyodideStatus === 'loading') {
      console.log("🚀 Starting Pyodide initialization...");
      initializePyodide();
    } else if (window.pyodideReady) {
      console.log("✅ Pyodide already ready");
      if (isMounted) {
        setPyodideStatus('ready');
      }
    }

    // Cleanup function to prevent setting state on unmounted component
    return () => {
      isMounted = false;
    };
  }, [pyodideStatus]);

  return pyodideStatus;
};

function App() {
  const pyodideStatus = usePyodide();

  // Utility functions available globally
  React.useEffect(() => {
    // Utility function for React components to check readiness
    window.isPyodideReady = function() {
      return window.pyodideReady === true;
    };

    // Utility function to get search engine status
    window.getSearchStatus = function() {
      if (window.pyodideReady && window.searchIndexBuilt) {
        return 'ready';
      } else if (window.pyodideReady) {
        return 'indexing';
      } else if (window.pyodide) {
        return 'loading';
      } else {
        return 'unavailable';
      }
    };
  }, []);

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
  console.log('Pyodide status:', pyodideStatus);

  return (
    <Router basename="/energy_balance">
      <div className="App">
        {/* Enhanced status display with more details */}
        {pyodideStatus === 'loading' && (
          <div className="pyodide-status-bar">
            <small>🔄 Loading enhanced search capabilities... (This may take 30-60 seconds)</small>
          </div>
        )}
        {pyodideStatus === 'error' && (
          <div className="pyodide-status-bar error">
            <small>⚠️ Enhanced search unavailable - using basic search. Check console for details.</small>
          </div>
        )}
        {pyodideStatus === 'ready' && (
          <div className="pyodide-status-bar success">
            <small>✅ Enhanced AI search is active!</small>
          </div>
        )}
        
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
          
          {/* CRITICAL: Fitbit OAuth callback route - MUST match your Fitbit app registration */}
          {/* Your Fitbit app is registered with: https://obuchel.github.io/energy_balance/fitbit-dashboard/callback */}
          <Route 
            path="/fitbit-dashboard/callback" 
            element={<FitbitCallback />} 
          />
          
          {/* Alternative route in case Fitbit uses different path */}
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
          
          {/* Food Tracker route with Pyodide lazy loading */}
          <Route 
            path="/food-tracker" 
            element={
              <ProtectedRoute>
                <Suspense fallback={<PyodideLoadingFallback />}>
                  <FoodTrackerPage />
                </Suspense>
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
          
          {/* Add Personal Settings route */}
          <Route 
            path="/personal-settings" 
            element={
              <ProtectedRoute>
                <PersonalSettings />
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
                <p>Expected Fitbit callback: /fitbit-dashboard/callback</p>
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