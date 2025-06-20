import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  Timestamp, 
  orderBy, 
  limit
} from 'firebase/firestore';
import { db } from '../../firebase-config';
import './FoodTrackerPage.css';
import { AnalysisTab } from './FoodTrackerAnalysis';

// UPDATED: Expanded snack categories
const mealTypes = ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Late Night Snack'];
const TABS = ['Add Food', 'Food Journal', 'Analysis'];
const ENTRIES_PER_PAGE = 20;

function FoodTrackerPage() {
  const navigate = useNavigate();
  
  // State declarations
  const [allFoodsCache, setAllFoodsCache] = useState([]);
  
  // ENABLED: Enhanced AI search functionality with Pyodide
  const [pyodideStatus, setPyodideStatus] = useState('loading');
  const [searchIndexBuilt, setSearchIndexBuilt] = useState(false);
  
  // User and authentication state
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
  
  // Edit/Delete state
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Suggestion cache for performance
  const [suggestionCache, setSuggestionCache] = useState({});

// Handle logout - Complete logout from both localStorage and Firebase Auth
const handleLogout = async () => {
  console.log('Logout clicked - starting complete logout process');
  
  try {
    // Clear localStorage
    console.log('Clearing localStorage userData');
    localStorage.removeItem('userData');
    
    // Clear any other potential session data
    sessionStorage.clear();
    console.log('Cleared sessionStorage');
    
    // Reset component state
    setCurrentUser(null);
    setAuthLoading(false);
    
    console.log('Complete logout finished, navigating to login...');
    
    // Navigate to login with replace to prevent back navigation
    navigate('/login', { replace: true });
    
  } catch (error) {
    console.error('Error during logout:', error);
    
    // Even if logout fails, still clear local data and redirect
    localStorage.removeItem('userData');
    sessionStorage.clear();
    setCurrentUser(null);
    
    navigate('/login', { replace: true });
  }
};
  // Delete Confirmation Modal Component
  const DeleteConfirmModal = ({ entryId, entryName, onConfirm, onCancel }) => (
    <div className="modal-overlay">
      <div className="delete-confirm-modal">
        <h3>🗑️ Delete Food Entry</h3>
        <p>Are you sure you want to delete this food entry?</p>
        <div className="entry-preview">
          <strong>{entryName}</strong>
        </div>
        <p className="warning-text">This action cannot be undone.</p>
        <div className="modal-actions">
          <button 
            className="cancel-button" 
            onClick={onCancel}
            disabled={deleteLoading}
          >
            Cancel
          </button>
          <button 
            className="delete-button" 
            onClick={() => onConfirm(entryId)}
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Deleting...' : 'Delete Entry'}
          </button>
        </div>
      </div>
    </div>
  );
  // Handle delete entry
  const handleDeleteEntry = async (entryId) => {
    if (!currentUser || !entryId) return;
    
    setDeleteLoading(true);
    setJournalError('');
    
    try {
      await deleteDoc(doc(db, 'users', currentUser.id, 'food_journal', entryId));
      
      // Update local state
      setFoodLog(prevLog => prevLog.filter(entry => entry.id !== entryId));
      
      setSuccess('Food entry deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      console.error('Error deleting entry:', err);
      setJournalError(`Failed to delete entry: ${err.message}`);
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmId(null);
    }
  };
  // Handle edit entry
  const handleEditEntry = (entry) => {
    // Pre-populate the form with entry data
    setFields({
      name: entry.name,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      calories: entry.calories,
      serving: entry.serving || 100,
      micronutrients: entry.micronutrients || {},
      longCovidBenefits: entry.longCovidBenefits || [],
      longCovidCautions: entry.longCovidCautions || [],
      longCovidRelevance: entry.longCovidRelevance || {},
    });
    
    setMealType(entry.mealType);
    setTime(entry.time);
    setDate(entry.date);
    setLongCovidAdjust(entry.longCovidAdjust || false);
    setSearch(entry.name);
    setEditingEntry(entry);
    
    // Switch to Add Food tab
    setTab('Add Food');
  };



  


// Update the handleLogFood function to handle both add and edit
const handleLogFood = async () => {
  if (!currentUser || !currentUser.id) {
    setError('Please log in to save your meals');
    return;
  }

  setLoading(true);
  setError('');
  setSuccess('');
  
  try {
    if (!fields.name) {
      throw new Error('Food name is required');
    }
    
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
      mealId: selectedMeal?.id || null
    };
    
    entryData.metabolicEfficiency = calculateMetabolicEfficiency(entryData);
    
    if (editingEntry) {
      // Update existing entry
      await updateDoc(
        doc(db, 'users', currentUser.id, 'food_journal', editingEntry.id), 
        {
          ...entryData,
          updatedAt: Timestamp.now()
        }
      );
      
      // Update local state
      setFoodLog(prevLog => 
        prevLog.map(entry => 
          entry.id === editingEntry.id 
            ? { ...entry, ...entryData, id: editingEntry.id }
            : entry
        )
      );
      
      setSuccess('Food entry updated successfully!');
      setEditingEntry(null);
      
    } else {
      // Add new entry
      entryData.createdAt = Timestamp.now();
      
      const docRef = await addDoc(
        collection(db, 'users', currentUser.id, 'food_journal'), 
        entryData
      );
      
      // Update local state for immediate feedback
      const newEntry = { id: docRef.id, ...entryData };
      setFoodLog(prevLog => [newEntry, ...prevLog]);
      
      setSuccess('Food logged successfully!');
    }
    
    // Reset form
    setFields({});
    setSelectedMeal(null);
    setSearch('');
    
  } catch (err) {
    console.error('Error logging food:', err);
    setError(`Failed to ${editingEntry ? 'update' : 'log'} food: ${err.message}`);
  } finally {
    setLoading(false);
  }
};

// Cancel edit mode
const handleCancelEdit = () => {
  setEditingEntry(null);
  setFields({});
  setSelectedMeal(null);
  setSearch('');
  setSuccess('');
  setError('');
};

// Fetch user profile from Firestore
const fetchUserProfile = async (uid) => {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      // Use only the data from the database, no defaults
      setUserProfile(userData);
    } else {
      console.log('No user profile found in database');
      // Set to null or empty object if no profile exists
      setUserProfile(null);
    }
  } catch (err) {
    console.error("Error fetching user profile:", err);
    setError('Failed to load user profile');
    setUserProfile(null);
  }
};

// Authentication check function
const checkUserAuthentication = useCallback(async () => {
  try {
    const storedUserData = localStorage.getItem('userData');
    
    if (!storedUserData) {
      navigate('/login');
      return;
    }
    
    const parsedUserData = JSON.parse(storedUserData);
    setCurrentUser(parsedUserData);
    
    if (parsedUserData.id) {
      // Only fetch from database if user has an ID
      await fetchUserProfile(parsedUserData.id);
    } else {
      console.log('No user ID found - user profile not loaded');
      setUserProfile(null);
    }
    
  } catch (error) {
    console.error("Error checking authentication:", error);
    navigate('/login');
  } finally {
    setAuthLoading(false);
  }
}, [navigate]);

// Authentication effect
useEffect(() => {
  checkUserAuthentication();
}, [checkUserAuthentication]);

// Initialize food log data - FIXED VERSION
const initializeFoodLogData = useCallback(async () => {
  if (!currentUser || !currentUser.id) return;
  
  try {
    const q = query(
      collection(db, 'users', currentUser.id, 'food_journal'),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const snap = await getDocs(q);
    const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Simply set the entries (empty array if no data exists)
    setFoodLog(entries);
    
    if (entries.length === 0) {
      console.log('No food log entries found - showing empty state');
    } else {
      console.log(`Loaded ${entries.length} food log entries`);
    }
    
  } catch (error) {
    console.error('Error loading food log data:', error);
    setError('Failed to load food log data');
    // Set empty array on error to avoid undefined state
    setFoodLog([]);
  }
}, [currentUser]);















  // Initialize food log when user is authenticated
  useEffect(() => {
    if (currentUser && currentUser.id && !authLoading) {
      initializeFoodLogData();
    }
  }, [currentUser, authLoading, initializeFoodLogData]);

  // Long COVID Food Information Component
  const LongCovidFoodInfo = ({ foodName, mealData }) => {
    if (mealData && (mealData.longCovidRelevance || mealData.longCovidBenefits || mealData.longCovidCautions)) {
      const covidRelevance = mealData.longCovidRelevance || {};
      const benefits = mealData.longCovidBenefits || [];
      const cautions = mealData.longCovidCautions || [];
      const functionalCompounds = mealData.functionalCompounds || {};
      
      let category = 'neutral';
      if (benefits.length > cautions.length) category = 'beneficial';
      if (cautions.length > benefits.length) category = 'caution';
      
      const antiInflammatoryLevel = covidRelevance.antiInflammatory || 'unknown';
      
      return (
        <div className={`long-covid-food-info ${category}`}>
          <div className="food-info-header">
            <span className={`category-icon ${category}`}>
              {category === 'beneficial' ? '✅' : 
               category === 'caution' ? '⚠️' : 'ℹ️'}
            </span>
            <strong>Database Analysis: {foodName}</strong>
          </div>
          
          <div className="inflammatory-level">
            <h5>🔥 Anti-Inflammatory Level</h5>
            <div className={`level-indicator level-${antiInflammatoryLevel}`}>
              <span className="level-value"> {antiInflammatoryLevel.toUpperCase()}</span>
              <span className="level-description">
                {antiInflammatoryLevel === 'high' ? 'Excellent for reducing inflammation' :
                 antiInflammatoryLevel === 'moderate' ? 'Moderately helpful for inflammation' :
                 antiInflammatoryLevel === 'low' ? 'Limited anti-inflammatory effects' :
                 antiInflammatoryLevel === 'neutral' ? 'No significant inflammatory impact' : 'Not assessed'}
              </span>
            </div>
          </div>

          {Object.keys(functionalCompounds).length > 0 && (
            <div className="functional-compounds">
              <h5>🧬 Functional Compounds</h5>
              <div className="compounds-grid">
                {Object.entries(functionalCompounds).map(([compound, level]) => (
                  <div key={compound} className="compound-item">
                    <span className="compound-name">{compound.replace(/_/g, ' ')}</span>
                    <span className={`compound-level level-${level}`}> {level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {benefits.length > 0 && (
            <div className="benefits-list">
              <h5>✨ Benefits for Long COVID Recovery</h5>
              <ul>
                {benefits.map((benefit, i) => (
                  <li key={i}>{benefit}</li>
                ))}
              </ul>
            </div>
          )}
          
          {cautions.length > 0 && (
            <div className="cautions-list">
              <h5>⚠️ Important Considerations</h5>
              <ul>
                {cautions.map((caution, i) => (
                  <li key={i}>{caution}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="no-food-info">
        <div className="no-data-icon">📊</div>
        <h4>No Long COVID Data Available</h4>
        <p>This food doesn't have specific Long COVID information in our database yet.</p>
        <p>Consider general anti-inflammatory principles:</p>
        <ul className="general-tips">
          <li>Choose whole, unprocessed versions when possible</li>
          <li>Pay attention to how it affects your symptoms</li>
          <li>Consider portion sizes and frequency</li>
          <li>Pair with known anti-inflammatory foods</li>
        </ul>
      </div>
    );
  };

  // Long COVID Side Panel Component
  const LongCovidSidePanel = ({ selectedFood, selectedMeal, foodLog = [], isSearching = false, searchTerm = '' }) => {
    if (selectedFood && selectedMeal) {
      return (
        <div className="long-covid-side-panel">
          <h3>🦠 Long COVID Nutrition Guide</h3>
          <div className="selected-food-analysis">
            <LongCovidFoodInfo foodName={selectedFood} mealData={selectedMeal} />
            
            <div className="back-to-guide">
              <p className="guide-hint">
                <em>Clear selection to see the full nutrition guide</em>
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (isSearching && searchTerm.length >= 2) {
      return (
        <div className="long-covid-side-panel">
          <h3>🦠 Long COVID Nutrition Guide</h3>
          
          <div className="search-status">
            <p className="search-hint">
              <em>Searching for "{searchTerm}"... Select a food above to see its specific analysis.</em>
            </p>
          </div>
          
          <div className="nutrition-categories">
            <div className="category-section beneficial">
              <h4>✅ Quick Anti-Inflammatory Guide</h4>
              <p>Focus on omega-3 rich fish, berries, leafy greens, and anti-inflammatory spices.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="long-covid-side-panel">
        <h3>🦠 Long COVID Nutrition Guide</h3>
        
        <div className="nutrition-categories">
          <div className="category-section beneficial">
            <h4>✅ Anti-Inflammatory Foods</h4>
            <ul>
              <li><strong>Fatty Fish:</strong> Salmon, mackerel, sardines (omega-3s)</li>
              <li><strong>Berries:</strong> Blueberries, strawberries (antioxidants)</li>
              <li><strong>Leafy Greens:</strong> Spinach, kale (vitamins, minerals)</li>
              <li><strong>Nuts:</strong> Walnuts, almonds (healthy fats)</li>
              <li><strong>Turmeric:</strong> Contains curcumin (anti-inflammatory)</li>
              <li><strong>Ginger:</strong> Natural anti-inflammatory</li>
              <li><strong>Green Tea:</strong> Polyphenols reduce inflammation</li>
            </ul>
          </div>

          <div className="category-section neutral">
            <h4>ℹ️ Recommended Foods</h4>
            <ul>
              <li><strong>Whole Grains:</strong> Oats, quinoa, brown rice</li>
              <li><strong>Lean Proteins:</strong> Chicken, turkey, legumes</li>
              <li><strong>Citrus Fruits:</strong> High in vitamin C</li>
              <li><strong>Olive Oil:</strong> Monounsaturated fats</li>
              <li><strong>Garlic & Onions:</strong> Immune support</li>
            </ul>
          </div>

          <div className="category-section caution">
            <h4>⚠️ Foods to Limit</h4>
            <ul>
              <li><strong>Processed Foods:</strong> High in inflammation-promoting ingredients</li>
              <li><strong>Refined Sugars:</strong> Can worsen inflammation</li>
              <li><strong>Red/Processed Meat:</strong> May increase inflammatory markers</li>
              <li><strong>Trans Fats:</strong> Found in margarine, processed foods</li>
              <li><strong>Refined Carbs:</strong> White bread, pastries</li>
              <li><strong>Fried Foods:</strong> High in inflammatory compounds</li>
            </ul>
          </div>
        </div>

        <div className="additional-tips">
          <h4>💡 General Tips</h4>
          <ul>
            <li>Stay well hydrated (8+ glasses water daily)</li>
            <li>Consider vitamin D supplementation</li>
            <li>Eat regular, smaller meals to maintain energy</li>
            <li>Focus on nutrient-dense, whole foods</li>
            <li>Limit alcohol and caffeine if they worsen symptoms</li>
          </ul>
        </div>
      </div>
    );
  };

  // Helper function for COVID food rating
  const getCovidFoodRating = (foodName) => {
    const foodLower = foodName.toLowerCase();
    
    const beneficial = [
      'salmon', 'mackerel', 'sardines', 'tuna', 'trout',
      'blueberries', 'strawberries', 'raspberries', 'blackberries',
      'spinach', 'kale', 'broccoli', 'brussels sprouts',
      'walnuts', 'almonds', 'chia seeds', 'flax seeds',
      'turmeric', 'ginger', 'garlic', 'onion',
      'olive oil', 'avocado', 'sweet potato',
      'green tea', 'dark chocolate'
    ];
    
    const caution = [
      'processed meat', 'bacon', 'sausage', 'hot dog',
      'french fries', 'fried chicken', 'fried',
      'white bread', 'white rice', 'pastry',
      'candy', 'soda', 'sugar', 'margarine',
      'ice cream', 'chips'
    ];
    
    if (beneficial.some(food => foodLower.includes(food))) return 'beneficial';
    if (caution.some(food => foodLower.includes(food))) return 'caution';
    return 'neutral';
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

  // Calculate metabolic efficiency
  const calculateMetabolicEfficiency = (mealData) => {
    const timeStr = mealData.time;
    const hourMatch = timeStr.match(/(\d+):/);
    const hour = hourMatch ? parseInt(hourMatch[1], 10) : 12;
    const isPM = timeStr.toLowerCase().includes('pm');
    
    let hour24 = hour;
    if (isPM && hour !== 12) hour24 += 12;
    if (!isPM && hour === 12) hour24 = 0;
    
    const proteinFactor = (parseFloat(mealData.protein) || 0) * 0.2;
    const carbFactor = (parseFloat(mealData.carbs) || 0) * 0.1;
    const fatFactor = (parseFloat(mealData.fat) || 0) * 0.15;
    
    let timeFactor = 1.0;
    if (hour24 < 6 || hour24 > 20) {
      timeFactor = 0.7;
    } else if (hour24 >= 7 && hour24 <= 10) {
      timeFactor = 1.2;
    } else if (hour24 >= 17 && hour24 <= 19) {
      timeFactor = 0.9;
    }
    
    // UPDATED: Expanded meal type factors
    const mealTypeFactors = {
      'Breakfast': 1.3,
      'Morning Snack': 0.9,
      'Lunch': 1.1,
      'Afternoon Snack': 0.8,
      'Dinner': 0.9,
      'Late Night Snack': 0.6,
      'Snack': 0.8  // Keep for backward compatibility
    };
    const mealTypeFactor = mealTypeFactors[mealData.mealType] || 1.0;
    
    const macroBalance = Math.min(100, (proteinFactor + carbFactor + fatFactor) * 10);
    let efficiency = macroBalance * timeFactor * mealTypeFactor;
    
    if (mealData.longCovidAdjust && userProfile?.hasLongCovid) {
      const severityFactors = {
        'mild': 0.95,
        'moderate': 0.85,
        'severe': 0.75,
        'very severe': 0.65
      };
      
      const severityFactor = severityFactors[userProfile.longCovidSeverity] || 0.85;
      efficiency *= severityFactor;
      
      if (mealData.longCovidBenefits && mealData.longCovidBenefits.length > 0) {
        efficiency *= 1.1;
      }
      
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
      
      updatedFields.protein = (nutrients.protein?.value * ratio).toFixed(1);
      updatedFields.carbs = (nutrients.carbs?.value * ratio).toFixed(1);
      updatedFields.fat = (nutrients.fat?.value * ratio).toFixed(1);
      updatedFields.calories = (nutrients.calories?.value * ratio).toFixed(0);
      
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

  // Enhanced AI-powered search with fallback to JavaScript
  const fetchSuggestions = useCallback(async () => {
    const normalizedSearch = search.toLowerCase().trim();
    
    if (normalizedSearch.length < 2) {
      setSuggestions([]);
      return;
    }
    
    if (suggestionCache[normalizedSearch]) {
      setSuggestions(suggestionCache[normalizedSearch]);
      return;
    }
    
    // JavaScript fallback search algorithm
    const calculateJavaScriptScore = (meal, searchTerm) => {
      const name = (meal.name || '').toLowerCase();
      const category = (meal.category || '').toLowerCase();
      const description = (meal.description || '').toLowerCase();
      
      let score = 0;
      
      if (name === searchTerm) score += 1.0;
      else if (name.startsWith(searchTerm)) score += 0.8;
      else if (name.includes(searchTerm)) score += 0.6;
      
      if (category.includes(searchTerm)) score += 0.3;
      if (description.includes(searchTerm)) score += 0.2;
      
      const nameWords = name.split(' ');
      const searchWords = searchTerm.split(' ');
      let wordMatches = 0;
      
      searchWords.forEach(searchWord => {
        nameWords.forEach(nameWord => {
          if (nameWord.startsWith(searchWord)) wordMatches++;
        });
      });
      
      score += (wordMatches / Math.max(searchWords.length, 1)) * 0.4;
      
      return score;
    };

    const performFallbackSearch = (normalizedSearch, allFoods) => {
      return allFoods
        .filter(meal => {
          if (!meal.name) return false;
          
          const mealNameLower = meal.name.toLowerCase();
          const category = (meal.category || '').toLowerCase();
          const description = (meal.description || '').toLowerCase();
          const benefits = (meal.longCovidBenefits || []).join(' ').toLowerCase();
          
          return mealNameLower.includes(normalizedSearch) ||
                 mealNameLower.startsWith(normalizedSearch) ||
                 category.includes(normalizedSearch) ||
                 description.includes(normalizedSearch) ||
                 benefits.includes(normalizedSearch) ||
                 mealNameLower.split(' ').some(word => word.startsWith(normalizedSearch));
        })
        .map(meal => ({
          ...meal,
          searchMethod: 'javascript',
          searchScore: calculateJavaScriptScore(meal, normalizedSearch)
        }))
        .sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          
          if (aName === normalizedSearch && bName !== normalizedSearch) return -1;
          if (bName === normalizedSearch && aName !== normalizedSearch) return 1;
          
          if (aName.startsWith(normalizedSearch) && !bName.startsWith(normalizedSearch)) return -1;
          if (bName.startsWith(normalizedSearch) && !aName.startsWith(normalizedSearch)) return 1;
          
          return (b.searchScore || 0) - (a.searchScore || 0);
        })
        .slice(0, 15);
    };
    
    try {
      console.log(`🔍 Enhanced search for: "${normalizedSearch}"`);
      
      let allFoods = allFoodsCache;
      if (allFoods.length === 0) {
        console.log('📥 Fetching food database...');
        const q = query(
          collection(db, 'meals'),
          limit(1000)
        );
        
        const snap = await getDocs(q);
        allFoods = snap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data()
        }));
        
        setAllFoodsCache(allFoods);
        console.log(`📊 Loaded ${allFoods.length} foods into cache`);
        
        if (window.pyodideReady && !searchIndexBuilt) {
          try {
            console.log('🏗️ Building search index...');
            const result = await window.pyodide.runPython(`
              result = search_engine.build_index('${JSON.stringify(allFoods).replace(/'/g, "\\'")}')
              result
            `);
            setSearchIndexBuilt(true);
            window.searchIndexBuilt = true;
            console.log('✅ Search index built:', result);
          } catch (error) {
            console.error('❌ Error building Python index:', error);
          }
        }
      }
      
      let results = [];
      
      if (window.pyodideReady && searchIndexBuilt) {
        try {
          console.log('🚀 Using AI-powered search');
          const pythonResults = await window.pyodide.runPython(`
            results = search_engine.search("${normalizedSearch.replace(/"/g, '\\"')}", 15)
            json.dumps(results)
          `);
          
          results = JSON.parse(pythonResults);
          console.log(`🎯 AI search returned ${results.length} results`);
          
          results = results.map(food => ({
            ...food,
            searchMethod: 'ai',
            searchScore: food.search_score || 0
          }));
          
        } catch (error) {
          console.error('❌ Python search failed, using fallback:', error);
          results = performFallbackSearch(normalizedSearch, allFoods);
        }
      } else {
        console.log('📝 Using fallback JavaScript search');
        results = performFallbackSearch(normalizedSearch, allFoods);
      }
      
      setSuggestionCache(prev => ({
        ...prev,
        [normalizedSearch]: results
      }));
      
      setSuggestions(results);
      
    } catch (err) {
      console.error('❌ Search error:', err);
      setSuggestions([]);
    }
  }, [search, suggestionCache, allFoodsCache, searchIndexBuilt]);

  // Monitor Pyodide status for AI search capabilities
  useEffect(() => {
    const checkPyodideStatus = () => {
      if (window.pyodideReady) {
        setPyodideStatus('ready');
      } else if (window.pyodide) {
        setPyodideStatus('loading');
      } else {
        setPyodideStatus('unavailable');
      }
    };
    
    checkPyodideStatus();
    
    const handlePyodideReady = () => {
      setPyodideStatus('ready');
      console.log('🎉 Pyodide ready event received');
    };
    
    const handlePyodideError = () => {
      setPyodideStatus('unavailable');
      console.log('⚠️ Pyodide error event received');
    };
    
    window.addEventListener('pyodideReady', handlePyodideReady);
    window.addEventListener('pyodideError', handlePyodideError);
    
    const interval = setInterval(checkPyodideStatus, 2000);
    
    return () => {
      window.removeEventListener('pyodideReady', handlePyodideReady);
      window.removeEventListener('pyodideError', handlePyodideError);
      clearInterval(interval);
    };
  }, []);

  // Search input component with AI capabilities
  const renderSearchInput = () => (
    <div className="form-group search-group">
      <label>Search Food</label>
      <div className="search-input-container">
        <input
          type="text"
          value={search}
          onChange={e => { 
            setSearch(e.target.value); 
            setSelectedMeal(null); 
          }}
          placeholder={
            pyodideStatus === 'ready' ? "🧠 AI-powered search ready..." :
            pyodideStatus === 'loading' ? "🔄 Loading AI search..." :
            "Search foods..."
          }
          autoComplete="off"
          className="search-input enhanced-search"
        />
        
        <div className={`search-status ${pyodideStatus}`}>
          {pyodideStatus === 'ready' && searchIndexBuilt && (
            <span className="status-ready">🚀 AI Search Active</span>
          )}
          {pyodideStatus === 'ready' && !searchIndexBuilt && (
            <span className="status-indexing">⚡ Building AI Index...</span>
          )}
          {pyodideStatus === 'loading' && (
            <span className="status-loading">🔄 Loading AI...</span>
          )}
          {pyodideStatus === 'unavailable' && (
            <span className="status-basic">📝 Basic Search</span>
          )}
          {suggestions.length > 0 && (
            <span className="result-count">({suggestions.length} results)</span>
          )}
        </div>
      </div>
      
      {suggestions.length > 0 && (
        <ul className="suggestions-list enhanced">
          {suggestions.map((s, index) => (
            <li key={s.id || index} onClick={() => handleSelectMeal(s)}>
              <div className="suggestion-main">
                <div className="suggestion-name">{s.name}</div>
                {s.category && (
                  <div className="suggestion-category">{s.category}</div>
                )}
                <div className="suggestion-meta">
                  {s.searchScore && (
                    <span className="search-score">
                      {(s.searchScore * 100).toFixed(0)}% match
                    </span>
                  )}
                  {s.searchMethod === 'ai' && (
                    <span className="ai-badge">🧠 AI</span>
                  )}
                  {s.searchMethod === 'javascript' && (
                    <span className="js-badge">JS</span>
                  )}
                  {s.match_type && (
                    <span className="match-type">{s.match_type}</span>
                  )}
                </div>
              </div>
              
              <div className="suggestion-indicators">
                {longCovidAdjust && (
                  <span className={`covid-indicator ${getCovidFoodRating(s.name)}`}>
                    {getCovidFoodRating(s.name) === 'beneficial' ? '✅' : 
                     getCovidFoodRating(s.name) === 'caution' ? '⚠️' : 'ℹ️'}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // Fetch suggestions effect
  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setSuggestions([]);
      return;
    }
    
    fetchSuggestions();
  }, [debouncedSearch, fetchSuggestions]);

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

  // Fetch food log function
  const fetchFoodLog = useCallback(async (page = 1) => {
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
  }, [currentUser]);

  // Fetch food log when tab changes
  useEffect(() => {
    if (tab === 'Food Journal' && currentUser) {
      fetchFoodLog(1);
    }
  }, [tab, currentUser, fetchFoodLog]);

  // Back navigation
  const handleBack = () => {
    navigate('/dashboard');
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="food-tracker-container">
        <div className="loading-indicator">Loading...</div>
      </div>
    );
  }

  // Authentication required state
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
      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <DeleteConfirmModal
          entryId={deleteConfirmId}
          entryName={foodLog.find(entry => entry.id === deleteConfirmId)?.name || 'Unknown'}
          onConfirm={handleDeleteEntry}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      <div className="tracker-header">
        <button onClick={handleBack} className="back-button">
          ← Back to Dashboard
        </button>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>
      
      <h2>🧠 AI-Powered Meal Tracker</h2>
      
      {/* AI Status Banner */}
      <div className={`ai-status-banner ${pyodideStatus}`}>
        {pyodideStatus === 'ready' && (
          <div className="ai-ready">
            🚀 <strong>AI Search Enabled:</strong> Advanced food matching with intelligent recommendations
          </div>
        )}
        {pyodideStatus === 'loading' && (
          <div className="ai-loading">
            🔄 <strong>Loading AI:</strong> Preparing enhanced search capabilities...
          </div>
        )}
        {pyodideStatus === 'unavailable' && (
          <div className="ai-fallback">
            📝 <strong>Basic Search:</strong> AI unavailable, using standard search
          </div>
        )}
      </div>
      
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
            {/* Edit Mode Indicator */}
            {editingEntry && (
              <div className="edit-mode-banner">
                <div className="edit-indicator">
                  <span className="edit-icon">✏️</span>
                  <span className="edit-text">
                    <strong>Editing:</strong> {editingEntry.name}
                  </span>
                </div>
                <button 
                  className="cancel-edit-btn"
                  onClick={handleCancelEdit}
                  type="button"
                >
                  Cancel Edit
                </button>
              </div>
            )}

            {/* Long COVID Checkbox */}
            <div className="form-group long-covid-checkbox-group">
              <label className="long-covid-checkbox-label">
                <input 
                  type="checkbox" 
                  checked={longCovidAdjust} 
                  onChange={e => setLongCovidAdjust(e.target.checked)} 
                  className="long-covid-checkbox"
                /> 
                <span className="checkbox-text">
                  I have Long COVID - Show food recommendations and adjustments
                </span>
              </label>
              {longCovidAdjust && (
                <div className="long-covid-info-banner">
                  <p>🔬 <strong>Long COVID Mode:</strong> Food recommendations will be adjusted to focus on anti-inflammatory options that may help manage symptoms and support recovery.</p>
                </div>
              )}
            </div>

            {renderSearchInput()}

            {/* Nutrition fields */}
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

            {/* Meal details */}
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
                className={`submit-button ${editingEntry ? 'update-mode' : ''}`}
                onClick={handleLogFood}
                disabled={loading || !fields.name}
              >
                {loading ? 
                  (editingEntry ? 'Updating...' : 'Logging...') : 
                  (editingEntry ? 'Update Food' : 'Log Food')
                }
              </button>
              {success && <div className="success-message">{success}</div>}
              {error && <div className="error-message">{error}</div>}
            </div>
          </div>

          <div className="food-form-right">
            {longCovidAdjust && (
              <LongCovidSidePanel 
                selectedFood={fields.name} 
                selectedMeal={selectedMeal}
                foodLog={foodLog}
                isSearching={search.length >= 2 && !selectedMeal}
                searchTerm={search}
              />
            )}
            {!longCovidAdjust && (
              <div className="general-nutrition-info">
                <h3>📊 Nutrition Tips</h3>
                <p>Enable Long COVID mode above to get personalized food recommendations and anti-inflammatory guidance.</p>
                {pyodideStatus === 'ready' && (
                  <div className="ai-tip">
                    <p>💡 <strong>AI Tip:</strong> The search above uses machine learning to find the most relevant foods for your queries!</p>
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
          {success && <div className="success-message">{success}</div>}
          
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
                <table className="food-log-table compact">
                  <thead>
                    <tr>
                      <th className="date-time-col">Date/Time</th>
                      <th className="meal-type-col">Meal</th>
                      <th className="food-col">Food</th>
                      <th className="serving-col">Serving</th>
                      <th className="macro-col">P</th>
                      <th className="macro-col">C</th>
                      <th className="macro-col">F</th>
                      <th className="calories-col">Cal</th>
                      <th className="efficiency-col">Eff%</th>
                      <th className="actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foodLog.map(entry => {
                      // Format date and time compactly - FIXED timezone issue
                      const formatDateTime = (date, time) => {
                        // Parse date string manually to avoid timezone issues
                        const dateParts = date.split('-');
                        const month = parseInt(dateParts[1], 10);
                        const day = parseInt(dateParts[2], 10);
                        
                        const shortTime = time.replace(':00', '').replace(' ', '');
                        return `${month}/${day} ${shortTime}`;
                      };
                      
                      // UPDATED: Handle all snack types for badge display
                      const getMealBadge = (mealType) => {
                        switch(mealType) {
                          case 'Breakfast': return 'B';
                          case 'Morning Snack': return 'MS';
                          case 'Lunch': return 'L';
                          case 'Afternoon Snack': return 'AS';
                          case 'Dinner': return 'D';
                          case 'Late Night Snack': return 'LN';
                          case 'Snack': return 'S'; // Original snack for backward compatibility
                          default: return mealType.charAt(0);
                        }
                      };
                      
                      return (
                        <tr key={entry.id}>
                          <td className="date-time-cell">
                            {formatDateTime(entry.date, entry.time)}
                          </td>
                          <td className="meal-type-cell">
                            <span className={`meal-badge ${(entry.mealType || 'unknown').trim().toLowerCase().replace(/\s+/g, '-')}`}>
                              {getMealBadge(entry.mealType || 'Unknown')}
                            </span>
                          </td>
                          <td className="food-cell" title={entry.name}>
                            {entry.name.length > 20 ? `${entry.name.substring(0, 20)}...` : entry.name}
                          </td>
                          <td className="serving-cell">{entry.serving || '0'}g</td>
                          <td className="macro-cell">{typeof entry.protein === 'number' ? entry.protein.toFixed(1) : (entry.protein || '0')}</td>
                          <td className="macro-cell">{typeof entry.carbs === 'number' ? entry.carbs.toFixed(1) : (entry.carbs || '0')}</td>
                          <td className="macro-cell">{typeof entry.fat === 'number' ? entry.fat.toFixed(1) : (entry.fat || '0')}</td>
                          <td className="calories-cell">{entry.calories || '0'}</td>
                          <td className="efficiency-cell">
                            <span className={`efficiency-badge ${
                              typeof entry.metabolicEfficiency === 'number' 
                                ? entry.metabolicEfficiency >= 80 ? 'high' : 
                                  entry.metabolicEfficiency >= 60 ? 'medium' : 'low'
                                : 'unknown'
                            }`}>
                              {typeof entry.metabolicEfficiency === 'number' ? entry.metabolicEfficiency.toFixed(0) : 'N/A'}
                            </span>
                          </td>
                          <td className="actions-cell">
                            <div className="action-buttons compact">
                              <button
                                className="edit-btn compact"
                                onClick={() => handleEditEntry(entry)}
                                title="Edit entry"
                              >
                                ✏️
                              </button>
                              <button
                                className="delete-btn compact"
                                onClick={() => setDeleteConfirmId(entry.id)}
                                title="Delete entry"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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