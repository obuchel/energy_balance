import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, Timestamp, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import './FoodTrackerPage.css';
import { AnalysisTab } from './FoodTrackerAnalysis';

const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const TABS = ['Add Food', 'Food Journal', 'Analysis'];
const ENTRIES_PER_PAGE = 20;

function FoodTrackerPage() {
  const navigate = useNavigate();
  
  // User and authentication state - Updated to use localStorage
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState({
    age: 30,
    gender: 'female',
    weight: 65,
    height: 165,
    activityLevel: 'moderate',
    hasLongCovid: false,
    longCovidSeverity: 'moderate'
  });
  const [authLoading, setAuthLoading] = useState(true);

  // UI state
  const [tab, setTab] = useState('Add Food');
  
  // Add Food state
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [fields, setFields] = useState({});
  const [mealType, setMealType] = useState('Breakfast');
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [longCovidAdjust, setLongCovidAdjust] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Food Journal state
  const [foodLog, setFoodLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [journalError, setJournalError] = useState('');
  const [journalPage, setJournalPage] = useState(1);
  
  // Suggestion cache for performance
  const [suggestionCache, setSuggestionCache] = useState({});

  // Updated authentication check using localStorage (matching Dashboard pattern)
  useEffect(() => {
    checkUserAuthentication();
  }, [navigate]);

  const checkUserAuthentication = async () => {
    try {
      // Get user data from localStorage (same as Dashboard.js)
      const storedUserData = localStorage.getItem('userData');
      
      if (!storedUserData) {
        // No user data found, redirect to login
        navigate('/login');
        return;
      }
      
      const parsedUserData = JSON.parse(storedUserData);
      
      // Set the current user from localStorage
      setCurrentUser(parsedUserData);
      
      // Fetch full user data from Firestore if user ID exists
      if (parsedUserData.id) {
        await fetchUserProfile(parsedUserData.id);
      } else {
        // Use localStorage data as fallback
        setUserProfile({
          ...userProfile,
          ...parsedUserData
        });
      }
      
    } catch (error) {
      console.error("Error checking authentication:", error);
      navigate('/login');
    } finally {
      setAuthLoading(false);
    }
  };

  // Fetch user profile from Firestore
  const fetchUserProfile = async (uid) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfile({
          age: userData.age || 30,
          gender: userData.gender || 'female',
          weight: userData.weight || 65,
          height: userData.height || 165,
          activityLevel: userData.activityLevel || 'moderate',
          hasLongCovid: userData.hasLongCovid || false,
          longCovidSeverity: userData.longCovidSeverity || 'moderate',
          ...userData
        });
      } else {
        console.log('No user profile found, using defaults');
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setError('Failed to load user profile');
    }
  };

  // Utility functions
  const convertTo24Hour = (time12h) => {
    if (!time12h) return '';
    
    const [time, modifier] = time12h.split(' ');
    if (!time || !modifier) return time12h;
    
    let [hours, minutes] = time.split(':');
    
    if (hours === '12') {
      hours = '00';
    }
    
    if (modifier === 'PM') {
      hours = String(parseInt(hours, 10) + 12);
    }
    
    // Ensure hours is a string before using padStart
    hours = String(hours);
    
    return `${hours.padStart(2, '0')}:${minutes}`;
  };

  const handleTimeChange = (e) => {
    const time24 = e.target.value;
    if (!time24) return;
    
    const date = new Date(`2000-01-01T${time24}`);
    const time12 = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setTime(time12);
  };

  // Calculate metabolic efficiency - Enhanced version
  const calculateMetabolicEfficiency = (mealData) => {
    const timeStr = mealData.time;
    const hourMatch = timeStr.match(/(\d+):/);
    const hour = hourMatch ? parseInt(hourMatch[1], 10) : 12;
    const isPM = timeStr.toLowerCase().includes('pm');
    
    let hour24 = hour;
    if (isPM && hour !== 12) hour24 += 12;
    if (!isPM && hour === 12) hour24 = 0;
    
    // Macronutrient factors
    const proteinFactor = (parseFloat(mealData.protein) || 0) * 0.2;
    const carbFactor = (parseFloat(mealData.carbs) || 0) * 0.1;
    const fatFactor = (parseFloat(mealData.fat) || 0) * 0.15;
    
    // Circadian rhythm factors
    let timeFactor = 1.0;
    if (hour24 < 6 || hour24 > 20) {
      timeFactor = 0.7;
    } else if (hour24 >= 7 && hour24 <= 10) {
      timeFactor = 1.2;
    } else if (hour24 >= 17 && hour24 <= 19) {
      timeFactor = 0.9;
    }
    
    // Meal type factors
    const mealTypeFactors = {
      'Breakfast': 1.3,
      'Lunch': 1.1,
      'Dinner': 0.9,
      'Snack': 0.8
    };
    const mealTypeFactor = mealTypeFactors[mealData.mealType] || 1.0;
    
    // Base efficiency calculation
    const macroBalance = Math.min(100, (proteinFactor + carbFactor + fatFactor) * 10);
    let efficiency = macroBalance * timeFactor * mealTypeFactor;
    
    // Long COVID adjustments
    if (mealData.longCovidAdjust && userProfile?.hasLongCovid) {
      const severityFactors = {
        'mild': 0.95,
        'moderate': 0.85,
        'severe': 0.75,
        'very severe': 0.65
      };
      
      const severityFactor = severityFactors[userProfile.longCovidSeverity] || 0.85;
      efficiency *= severityFactor;
      
      // Boost for beneficial foods
      if (mealData.longCovidBenefits && mealData.longCovidBenefits.length > 0) {
        efficiency *= 1.1;
      }
      
      // Reduce for problematic foods
      if (mealData.longCovidCautions && mealData.longCovidCautions.length > 0) {
        efficiency *= 0.9;
      }
    }
    
    return Math.min(100, Math.max(0, efficiency));
  };

  // Recalculate nutrients when serving size changes
  const recalculateNutrients = (newServing) => {
    if (!selectedMeal || !selectedMeal.nutrients?.per100g) return;
    
    const ratio = parseFloat(newServing) / 100;
    if (isNaN(ratio)) return;
    
    setFields(prevFields => {
      const updatedFields = { ...prevFields };
      const nutrients = selectedMeal.nutrients.per100g;
      
      // Update macronutrients
      updatedFields.protein = (nutrients.protein?.value * ratio).toFixed(1);
      updatedFields.carbs = (nutrients.carbs?.value * ratio).toFixed(1);
      updatedFields.fat = (nutrients.fat?.value * ratio).toFixed(1);
      updatedFields.calories = (nutrients.calories?.value * ratio).toFixed(0);
      
      // Update micronutrients
      updatedFields.micronutrients = {};
      Object.entries(nutrients).forEach(([key, value]) => {
        if (!['protein', 'carbs', 'fat', 'calories', 'name', 'unit'].includes(key)) {
          updatedFields.micronutrients[key] = {
            ...value,
            value: (value.value * ratio).toFixed(1)
          };
        }
      });
      
      return updatedFields;
    });
  };

  // Debounce hook for search
  const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      
      return () => clearTimeout(handler);
    }, [value, delay]);
    
    return debouncedValue;
  };

  const debouncedSearch = useDebounce(search, 300);

  // Fetch suggestions from Firestore
  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setSuggestions([]);
      return;
    }
    
    fetchSuggestions();
  }, [debouncedSearch]);

  const fetchSuggestions = async () => {
    const normalizedSearch = search.toLowerCase();
    
    if (suggestionCache[normalizedSearch]) {
      setSuggestions(suggestionCache[normalizedSearch]);
      return;
    }
    
    try {
      const q = query(
        collection(db, 'meals'), 
        where('name', ">=", search), 
        where('name', "<=", search + '\uf8ff'),
        limit(20)
      );
      
      const snap = await getDocs(q);
      const results = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => item.name.toLowerCase().includes(normalizedSearch));
      
      setSuggestionCache(prev => ({
        ...prev,
        [normalizedSearch]: results
      }));
      
      setSuggestions(results);
    } catch (err) {
      console.error('Error fetching food suggestions:', err);
      setSuggestions([]);
    }
  };

  // Handle meal selection
  const handleSelectMeal = (meal) => {
    setSelectedMeal(meal);
    setSearch(meal.name);
    setSuggestions([]);
    
    const defaultServing = 100;
    const nutrients = meal.nutrients?.per100g || {};
    
    setFields({
      name: meal.name,
      protein: nutrients.protein?.value || '',
      carbs: nutrients.carbs?.value || '',
      fat: nutrients.fat?.value || '',
      calories: nutrients.calories?.value || '',
      serving: defaultServing,
      micronutrients: nutrients,
      longCovidBenefits: meal.longCovidBenefits || [],
      longCovidCautions: meal.longCovidCautions || [],
      longCovidRelevance: meal.longCovidRelevance || {},
    });
  };

  // Handle field changes
  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'serving') {
      setFields(prev => ({ ...prev, [name]: value }));
      recalculateNutrients(value);
    } else {
      setFields(prev => ({ ...prev, [name]: value }));
    }
  };

  // Log food to Firestore
  const handleLogFood = async () => {
    if (!currentUser || !currentUser.id) {
      setError('Please log in to save your meals');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Validate required fields
      if (!fields.name) {
        throw new Error('Food name is required');
      }
      
      // Prepare entry data
      const entryData = {
        name: fields.name,
        protein: parseFloat(fields.protein) || 0,
        carbs: parseFloat(fields.carbs) || 0,
        fat: parseFloat(fields.fat) || 0,
        calories: parseFloat(fields.calories) || 0,
        serving: parseFloat(fields.serving) || 100,
        micronutrients: fields.micronutrients || {},
        mealType,
        time,
        date,
        longCovidAdjust,
        longCovidBenefits: fields.longCovidBenefits || [],
        longCovidCautions: fields.longCovidCautions || [],
        longCovidRelevance: fields.longCovidRelevance || {},
        createdAt: Timestamp.now(),
        mealId: selectedMeal?.id || null
      };
      
      // Calculate metabolic efficiency
      entryData.metabolicEfficiency = calculateMetabolicEfficiency(entryData);
      
      // Save to Firestore using currentUser.id
      await addDoc(
        collection(db, 'users', currentUser.id, 'food_journal'), 
        entryData
      );
      
      setSuccess('Food logged successfully!');
      
      // Reset form
      setFields({});
      setSelectedMeal(null);
      setSearch('');
      
      // Refresh food log if on that tab
      if (tab === 'Food Journal') {
        fetchFoodLog(1);
      }
      
    } catch (err) {
      console.error('Error logging food:', err);
      setError(`Failed to log food: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch food log
  const fetchFoodLog = async (page = 1) => {
    if (!currentUser || !currentUser.id) return;
    
    setLogLoading(true);
    if (page === 1) setFoodLog([]);
    setJournalError('');
    
    try {
      const q = query(
        collection(db, 'users', currentUser.id, 'food_journal'),
        orderBy('date', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(ENTRIES_PER_PAGE * page)
      );
      
      const snap = await getDocs(q);
      const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setFoodLog(entries);
      setJournalPage(page);
      
    } catch (err) {
      console.error('Error fetching food log:', err);
      setJournalError(`Failed to load journal: ${err.message}`);
    } finally {
      setLogLoading(false);
    }
  };

  // Fetch food log when tab changes to Food Journal
  useEffect(() => {
    if (tab === 'Food Journal' && currentUser) {
      fetchFoodLog(1);
    }
  }, [tab, currentUser]);

  // Add back navigation function
  const handleBack = () => {
    navigate('/dashboard');
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="food-tracker-container">
        <div className="loading-indicator">Loading...</div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!currentUser) {
    return (
      <div className="food-tracker-container">
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please log in to use the food tracker.</p>
          <button onClick={handleBack} className="back-button">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="food-tracker-container">
      {/* Add back button */}
      <div className="tracker-header">
        <button onClick={handleBack} className="back-button">
          ← Back to Dashboard
        </button>
      </div>
      
      <h2>Meal Tracker</h2>
      <div className="food-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`food-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Add Food' && (
        <div className="food-form-section">
          <div className="food-form-left">
            <div className="form-group search-group">
              <label>Search Food</label>
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedMeal(null); }}
                placeholder="Type to search foods..."
                autoComplete="off"
                className="search-input"
              />
              {suggestions.length > 0 && (
                <ul className="suggestions-list">
                  {suggestions.map(s => (
                    <li key={s.id} onClick={() => handleSelectMeal(s)}>
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="form-group">
              <label>Food Name</label>
              <input 
                name="name" 
                value={fields.name || ''} 
                onChange={handleFieldChange} 
                disabled 
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Protein (g)</label>
                <input 
                  name="protein" 
                  value={fields.protein || ''} 
                  onChange={handleFieldChange} 
                  type="number"
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>Carbs (g)</label>
                <input 
                  name="carbs" 
                  value={fields.carbs || ''} 
                  onChange={handleFieldChange} 
                  type="number"
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>Fat (g)</label>
                <input 
                  name="fat" 
                  value={fields.fat || ''} 
                  onChange={handleFieldChange} 
                  type="number"
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>Serving (g)</label>
                <input 
                  name="serving" 
                  value={fields.serving || ''} 
                  onChange={handleFieldChange}
                  type="number"
                  step="1"
                  className="serving-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Meal Type</label>
                <select value={mealType} onChange={e => setMealType(e.target.value)}>
                  {mealTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Time</label>
                <input 
                  type="time" 
                  value={convertTo24Hour(time)} 
                  onChange={handleTimeChange} 
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Calories</label>
              <input 
                name="calories" 
                value={fields.calories || ''} 
                onChange={handleFieldChange} 
                type="number"
                step="1"
              />
            </div>

            <div className="form-group">
              <button 
                className="submit-button"
                onClick={handleLogFood}
                disabled={loading || !fields.name}
              >
                {loading ? 'Logging...' : 'Log Food'}
              </button>
              {success && <div className="success-message">{success}</div>}
              {error && <div className="error-message">{error}</div>}
            </div>
          </div>

          <div className="food-form-right">
            {userProfile?.hasLongCovid && (
              <div className="long-covid-box">
                <label>
                  <input 
                    type="checkbox" 
                    checked={longCovidAdjust} 
                    onChange={e => setLongCovidAdjust(e.target.checked)} 
                  /> 
                  Apply Long COVID adjustments
                </label>
                
                {fields.longCovidBenefits && fields.longCovidBenefits.length > 0 && (
                  <div className="long-covid-info">
                    <div>
                      <b>Benefits:</b>
                      <ul>
                        {fields.longCovidBenefits.map((benefit, i) => (
                          <li key={i}>{benefit}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {fields.longCovidCautions && fields.longCovidCautions.length > 0 && (
                  <div className="long-covid-info">
                    <div>
                      <b>Cautions:</b>
                      <ul>
                        {fields.longCovidCautions.map((caution, i) => (
                          <li key={i}>{caution.split("_").join(" ")}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Food Journal' && (
        <div className="food-journal-section">
          <div className="journal-header">
            <h3>Your Food Journal</h3>
            <button 
              className="refresh-button"
              onClick={() => fetchFoodLog(1)}
              disabled={logLoading}
            >
              {logLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {journalError && <div className="error-message">{journalError}</div>}
          
          {logLoading && foodLog.length === 0 ? (
            <div className="loading-indicator">Loading your food journal...</div>
          ) : foodLog.length === 0 ? (
            <div className="empty-state">
              <p>No entries found in your food journal.</p>
              <p>Start by adding a meal in the "Add Food" tab!</p>
            </div>
          ) : (
            <>
              <div className="journal-summary">
                <p>Showing {foodLog.length} meal entries</p>
              </div>
              
              <div className="journal-table-container">
                <table className="food-log-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Meal Type</th>
                      <th>Food</th>
                      <th>Serving (g)</th>
                      <th>Protein (g)</th>
                      <th>Carbs (g)</th>
                      <th>Fat (g)</th>
                      <th>Calories</th>
                      <th>Efficiency (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foodLog.map(entry => (
                      <tr key={entry.id}>
                        <td>{entry.date}</td>
                        <td>{entry.time}</td>
                        <td>{entry.mealType}</td>
                        <td>{entry.name}</td>
                        <td>{entry.serving || '0'}</td>
                        <td>{typeof entry.protein === 'number' ? entry.protein.toFixed(1) : (entry.protein || '0')}</td>
                        <td>{typeof entry.carbs === 'number' ? entry.carbs.toFixed(1) : (entry.carbs || '0')}</td>
                        <td>{typeof entry.fat === 'number' ? entry.fat.toFixed(1) : (entry.fat || '0')}</td>
                        <td>{entry.calories || '0'}</td>
                        <td>{typeof entry.metabolicEfficiency === 'number' ? entry.metabolicEfficiency.toFixed(1) : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {foodLog.length >= journalPage * ENTRIES_PER_PAGE && (
                <div className="load-more-container">
                  <button 
                    className="load-more-button"
                    onClick={() => fetchFoodLog(journalPage + 1)}
                    disabled={logLoading}
                  >
                    {logLoading ? 'Loading...' : 'Load More Entries'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'Analysis' && (
        <AnalysisTab 
          foodLog={foodLog} 
          userProfile={userProfile} 
        />
      )}
    </div>
  );
}

export default FoodTrackerPage;