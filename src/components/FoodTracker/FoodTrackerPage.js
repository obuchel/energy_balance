import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  Timestamp, 
  orderBy, 
  limit, 
  doc, 
  getDoc
} from 'firebase/firestore';
import { db } from '../../firebase-config';
import './FoodTrackerPage.css';
import { AnalysisTab } from './FoodTrackerAnalysis';

const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const TABS = ['Add Food', 'Food Journal', 'Analysis'];
const ENTRIES_PER_PAGE = 20;

function FoodTrackerPage() {
  const navigate = useNavigate();
  
  // State declarations
  const [allFoodsCache, setAllFoodsCache] = useState([]);
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
  
  // Suggestion cache for performance
  const [suggestionCache, setSuggestionCache] = useState({});

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
        await fetchUserProfile(parsedUserData.id);
      } else {
        setUserProfile(prevProfile => ({
          ...prevProfile,
          ...parsedUserData
        }));
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

  // Create sample food data
  const createSampleFoodData = useCallback(async () => {
    if (!currentUser || !currentUser.id) return;
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sampleEntries = [
      {
        name: 'Greek Yogurt with Berries',
        protein: 20,
        carbs: 35,
        fat: 8,
        calories: 320,
        serving: 200,
        micronutrients: {
          vitamin_c: { value: 25, unit: 'mg' },
          calcium: { value: 200, unit: 'mg' },
          vitamin_b12: { value: 1.2, unit: 'mcg' },
        },
        mealType: 'Breakfast',
        time: '8:00 AM',
        date: today,
        longCovidAdjust: userProfile.hasLongCovid,
        longCovidBenefits: ['High protein for recovery', 'Probiotics for gut health'],
        longCovidCautions: [],
        longCovidRelevance: { antiInflammatory: 'moderate' },
        metabolicEfficiency: 85,
        createdAt: Timestamp.now()
      },
      {
        name: 'Quinoa Salad with Grilled Chicken',
        protein: 32,
        carbs: 42,
        fat: 15,
        calories: 450,
        serving: 300,
        micronutrients: {
          iron: { value: 3.5, unit: 'mg' },
          magnesium: { value: 60, unit: 'mg' },
          vitamin_b6: { value: 0.8, unit: 'mg' },
          folate: { value: 80, unit: 'mcg' }
        },
        mealType: 'Lunch',
        time: '12:30 PM',
        date: today,
        longCovidAdjust: userProfile.hasLongCovid,
        longCovidBenefits: ['Complete protein', 'Anti-inflammatory nutrients'],
        longCovidCautions: [],
        longCovidRelevance: { antiInflammatory: 'high' },
        metabolicEfficiency: 88,
        createdAt: Timestamp.now()
      },
      {
        name: 'Grilled Salmon with Sweet Potato',
        protein: 38,
        carbs: 30,
        fat: 28,
        calories: 520,
        serving: 250,
        micronutrients: {
          vitamin_d: { value: 15, unit: 'mcg' },
          vitamin_b12: { value: 3.2, unit: 'mcg' },
          selenium: { value: 45, unit: 'mcg' },
          vitamin_a: { value: 300, unit: 'mcg' }
        },
        mealType: 'Dinner',
        time: '7:00 PM',
        date: today,
        longCovidAdjust: userProfile.hasLongCovid,
        longCovidBenefits: ['Omega-3 fatty acids', 'High vitamin D', 'Anti-inflammatory'],
        longCovidCautions: [],
        longCovidRelevance: { 
          antiInflammatory: 'high',
          brainFogImpact: 'positive',
          energyImpact: 'positive'
        },
        metabolicEfficiency: 90,
        createdAt: Timestamp.now()
      }
    ];

    try {
      const promises = sampleEntries.map(entry => 
        addDoc(collection(db, 'users', currentUser.id, 'food_journal'), entry)
      );
      
      await Promise.all(promises);
      
      setFoodLog(sampleEntries.map((entry, index) => ({
        id: `sample_${index}`,
        ...entry
      })));
      
      console.log('Sample food data created successfully');
      
    } catch (error) {
      console.error('Error creating sample data:', error);
      
      setFoodLog(sampleEntries.map((entry, index) => ({
        id: `sample_${index}`,
        ...entry
      })));
    }
  }, [currentUser, userProfile.hasLongCovid]);

  // Initialize food log data
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
      
      if (entries.length > 0) {
        setFoodLog(entries);
      } else {
        await createSampleFoodData();
      }
      
    } catch (error) {
      console.error('Error initializing food log data:', error);
      await createSampleFoodData();
    }
  }, [currentUser, createSampleFoodData]);

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
      const properties = mealData.properties || {};
      
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
              <span className="level-value">{antiInflammatoryLevel.toUpperCase()}</span>
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
                    <span className={`compound-level level-${level}`}>{level}</span>
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
    
    const mealTypeFactors = {
      'Breakfast': 1.3,
      'Lunch': 1.1,
      'Dinner': 0.9,
      'Snack': 0.8
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

  // Enhanced fallback search function
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

  // Calculate search score for JavaScript fallback
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

  // Fetch suggestions function
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
    
    try {
      console.log(`🔍 Enhanced search for: "${normalizedSearch}"`);
      
      let allFoods = allFoodsCache;
      if (allFoods.length === 0) {
        console.log('📥 Fetching food database...');
        const q = query(
          collection(db, 'meals'),
          limit(500)
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

  // Monitor Pyodide status
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

  // Search input component
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
            pyodideStatus === 'ready' ? "AI-powered search ready..." :
            pyodideStatus === 'loading' ? "Loading AI search..." :
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
            <span className="status-indexing">⚡ Building Index...</span>
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
                    <span className="ai-badge">AI</span>
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
        createdAt: Timestamp.now(),
        mealId: selectedMeal?.id || null
      };
      
      entryData.metabolicEfficiency = calculateMetabolicEfficiency(entryData);
      
      await addDoc(
        collection(db, 'users', currentUser.id, 'food_journal'), 
        entryData
      );
      
      setSuccess('Food logged successfully!');
      
      setFields({});
      setSelectedMeal(null);
      setSearch('');
      
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