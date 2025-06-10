import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
//import { collection, query, where, getDocs, addDoc, Timestamp, orderBy, limit, doc, getDoc } from 'firebase/firestore';
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
    // Add this for the migration function
} from 'firebase/firestore';
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

  // Memoize the authentication check function
  const checkUserAuthentication = useCallback(async () => {
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
  }, [navigate]); // Only include navigate as dependency

  // Updated authentication check using localStorage (matching Dashboard pattern)
  useEffect(() => {
    checkUserAuthentication();
  }, [checkUserAuthentication]);

  // Add this function to create sample data - moved outside useCallback to avoid dependency issues
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
      },
      {
        name: 'Oatmeal with Walnuts and Cinnamon',
        protein: 12,
        carbs: 52,
        fat: 14,
        calories: 380,
        serving: 200,
        micronutrients: {
          magnesium: { value: 45, unit: 'mg' },
          vitamin_e: { value: 8, unit: 'mg' },
          zinc: { value: 2.5, unit: 'mg' }
        },
        mealType: 'Breakfast',
        time: '8:15 AM',
        date: yesterdayStr,
        longCovidAdjust: userProfile.hasLongCovid,
        longCovidBenefits: ['Heart healthy', 'Sustained energy'],
        longCovidCautions: [],
        longCovidRelevance: { antiInflammatory: 'moderate' },
        metabolicEfficiency: 82,
        createdAt: Timestamp.now()
      }
    ];

    try {
      // Add sample entries to Firestore
      const promises = sampleEntries.map(entry => 
        addDoc(collection(db, 'users', currentUser.id, 'food_journal'), entry)
      );
      
      await Promise.all(promises);
      
      // Update local state with the sample data
      setFoodLog(sampleEntries.map((entry, index) => ({
        id: `sample_${index}`, // Temporary IDs
        ...entry
      })));
      
      console.log('Sample food data created successfully');
      
    } catch (error) {
      console.error('Error creating sample data:', error);
      
      // If we can't save to Firestore, at least set local state
      setFoodLog(sampleEntries.map((entry, index) => ({
        id: `sample_${index}`,
        ...entry
      })));
    }
  }, [currentUser, userProfile.hasLongCovid]); // Include userProfile.hasLongCovid as dependency

  // Memoize the initialization function
  const initializeFoodLogData = useCallback(async () => {
    if (!currentUser || !currentUser.id) return;
    
    try {
      // First, try to fetch existing data from Firestore
      const q = query(
        collection(db, 'users', currentUser.id, 'food_journal'),
        orderBy('date', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(20) // Load recent entries
      );
      
      const snap = await getDocs(q);
      const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (entries.length > 0) {
        // User has existing data, use it
        setFoodLog(entries);
      } else {
        // No existing data, create sample data for demonstration
        await createSampleFoodData();
      }
      
    } catch (error) {
      console.error('Error initializing food log data:', error);
      // If there's an error fetching from Firestore, create sample data
      await createSampleFoodData();
    }
  }, [currentUser, createSampleFoodData]); // Include createSampleFoodData as dependency

  // Add this useEffect RIGHT AFTER your existing useEffect for authentication
  useEffect(() => {
    // Initialize food log data when component mounts and user is authenticated
    if (currentUser && currentUser.id && !authLoading) {
      initializeFoodLogData();
    }
  }, [currentUser, authLoading, initializeFoodLogData]);

// Long COVID Food Information Component - Using Your Database Structure
const LongCovidFoodInfo = ({ foodName, mealData }) => {
  // If we have meal data from the database, use that
  if (mealData && (mealData.longCovidRelevance || mealData.longCovidBenefits || mealData.longCovidCautions)) {
    const covidRelevance = mealData.longCovidRelevance || {};
    const benefits = mealData.longCovidBenefits || [];
    const cautions = mealData.longCovidCautions || [];
    const functionalCompounds = mealData.functionalCompounds || {};
    const properties = mealData.properties || {};
    
    // Determine category based on database data
    let category = 'neutral';
    if (benefits.length > cautions.length) category = 'beneficial';
    if (cautions.length > benefits.length) category = 'caution';
    
    // Get anti-inflammatory level
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
        
        {/* Anti-inflammatory level from database */}
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

        {/* Long COVID Impact Assessment */}
        <div className="covid-impact-grid">
          <h5>🎯 Long COVID Impact Assessment</h5>
          <div className="impact-categories">
            {covidRelevance.brainFogImpact && (
              <div className="impact-item">
                <span className="impact-label">Brain Fog:</span>
                <span className={`impact-value impact-${covidRelevance.brainFogImpact}`}>
                  {covidRelevance.brainFogImpact}
                </span>
              </div>
            )}
            {covidRelevance.energyImpact && (
              <div className="impact-item">
                <span className="impact-label">Energy Levels:</span>
                <span className={`impact-value impact-${covidRelevance.energyImpact}`}>
                  {covidRelevance.energyImpact}
                </span>
              </div>
            )}
            {covidRelevance.gutHealthImpact && (
              <div className="impact-item">
                <span className="impact-label">Gut Health:</span>
                <span className={`impact-value impact-${covidRelevance.gutHealthImpact}`}>
                  {covidRelevance.gutHealthImpact}
                </span>
              </div>
            )}
            {covidRelevance.immuneModulating && (
              <div className="impact-item">
                <span className="impact-label">Immune Support:</span>
                <span className={`impact-value impact-${covidRelevance.immuneModulating}`}>
                  {covidRelevance.immuneModulating}
                </span>
              </div>
            )}
            {covidRelevance.histamineResponse && (
              <div className="impact-item">
                <span className="impact-label">Histamine Response:</span>
                <span className={`impact-value impact-${covidRelevance.histamineResponse}`}>
                  {covidRelevance.histamineResponse}
                </span>
              </div>
            )}
            {covidRelevance.mastCellActivation && (
              <div className="impact-item">
                <span className="impact-label">Mast Cell Activation:</span>
                <span className={`impact-value impact-${covidRelevance.mastCellActivation}`}>
                  {covidRelevance.mastCellActivation}
                </span>
              </div>
            )}
            {covidRelevance.mitochondrialSupport && (
              <div className="impact-item">
                <span className="impact-label">Mitochondrial Support:</span>
                <span className={`impact-value impact-${covidRelevance.mitochondrialSupport}`}>
                  {covidRelevance.mitochondrialSupport}
                </span>
              </div>
            )}
            {covidRelevance.nerveSupportive && (
              <div className="impact-item">
                <span className="impact-label">Nerve Support:</span>
                <span className={`impact-value impact-${covidRelevance.nerveSupportive}`}>
                  {covidRelevance.nerveSupportive}
                </span>
              </div>
            )}
            {covidRelevance.oxidativeStressReduction && (
              <div className="impact-item">
                <span className="impact-label">Oxidative Stress:</span>
                <span className={`impact-value impact-${covidRelevance.oxidativeStressReduction}`}>
                  {covidRelevance.oxidativeStressReduction}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Functional compounds from database */}
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
        
        {/* Benefits from database */}
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
        
        {/* Cautions from database */}
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

        {/* Safety properties for sensitive individuals */}
        {Object.keys(properties).length > 0 && (
          <div className="safety-properties">
            <h5>🛡️ Safety Profile</h5>
            <div className="properties-grid">
              {properties.dairyFree && (
                <div className="property-badge safe">Dairy Free</div>
              )}
              {properties.glutenFree && (
                <div className="property-badge safe">Gluten Free</div>
              )}
              {properties.safeForMCAS && (
                <div className="property-badge safe">MCAS Safe</div>
              )}
              {properties.fodmap && (
                <div className={`property-badge ${properties.fodmap === 'low' ? 'safe' : 'caution'}`}>
                  {properties.fodmap.toUpperCase()} FODMAP
                </div>
              )}
              {properties.oxalates && (
                <div className={`property-badge ${properties.oxalates === 'none' || properties.oxalates === 'low' ? 'safe' : 'caution'}`}>
                  {properties.oxalates.toUpperCase()} Oxalates
                </div>
              )}
            </div>
          </div>
        )}

        {/* Category information */}
        {mealData.category && (
          <div className="food-category">
            <h5>📂 Food Category</h5>
            <span className="category-tag">{mealData.category}</span>
          </div>
        )}
      </div>
    );
  }

  // Fallback when no database data is available
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

// Long COVID Side Panel Component - Enhanced with Database Integration
const LongCovidSidePanel = ({ selectedFood, selectedMeal, foodLog = [], isSearching = false, searchTerm = '' }) => {
  // If a food is selected, show custom info from database instead of general guide
  if (selectedFood && selectedMeal) {
    return (
      <div className="long-covid-side-panel">
        <h3>🦠 Long COVID Nutrition Guide</h3>
        <div className="selected-food-analysis">
          {/* Database Analysis for selected food */}
    
          <LongCovidFoodInfo foodName={selectedFood} mealData={selectedMeal} />
          
          {/* Back to guide button */}
          <div className="back-to-guide">
            <p className="guide-hint">
              <em>Clear selection to see the full nutrition guide</em>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If user is searching, show database analysis in the guide section
  if (isSearching && searchTerm.length >= 2) {
    return (
      <div className="long-covid-side-panel">
        <h3>🦠 Long COVID Nutrition Guide</h3>
        
        {/* Database Analysis during search */}
        <div className="database-analysis-section">

      
        </div>

        {/* Search status */}
        <div className="search-status">
          <p className="search-hint">
            <em>Searching for "{searchTerm}"... Select a food above to see its specific analysis.</em>
          </p>
        </div>
        
        <div className="nutrition-categories">
          {/* Abbreviated guide during search */}
          <div className="category-section beneficial">
            <h4>✅ Quick Anti-Inflammatory Guide</h4>
            <p>Focus on omega-3 rich fish, berries, leafy greens, and anti-inflammatory spices.</p>
          </div>
        </div>
      </div>
    );
  }

  // Extract database information from food log for dynamic categories
  const extractFoodsFromDatabase = () => {
    const beneficial = [];
    const neutral = [];
    const caution = [];
    
    // Get unique foods from food log with their database info
    const uniqueFoods = {};
    foodLog.forEach(entry => {
      if (!uniqueFoods[entry.name] && entry.longCovidRelevance) {
        uniqueFoods[entry.name] = entry;
      }
    });
    
    Object.values(uniqueFoods).forEach(food => {
      const benefits = food.longCovidBenefits || [];
      const cautions = food.longCovidCautions || [];
      const covidRelevance = food.longCovidRelevance || {};
      
      // Determine category based on database data
      let category = 'neutral';
      if (benefits.length > cautions.length) category = 'beneficial';
      if (cautions.length > benefits.length) category = 'caution';
      
      // Also consider anti-inflammatory level
      if (covidRelevance.antiInflammatory === 'high') category = 'beneficial';
      if (covidRelevance.antiInflammatory === 'low') category = 'caution';
      
      const foodInfo = {
        name: food.name,
        antiInflammatory: covidRelevance.antiInflammatory || 'unknown',
        benefits: benefits.slice(0, 2), // Show first 2 benefits
        cautions: cautions.slice(0, 2), // Show first 2 cautions
        category: food.category || 'General'
      };
      
      if (category === 'beneficial') beneficial.push(foodInfo);
      else if (category === 'caution') caution.push(foodInfo);
      else neutral.push(foodInfo);
    });
    
    return { beneficial, neutral, caution };
  };

  const { beneficial: dbBeneficial, neutral: dbNeutral, caution: dbCaution } = extractFoodsFromDatabase();

  // Default: Show the general Long COVID nutrition guide with database integration
  return (
    <div className="long-covid-side-panel">
      <h3>🦠 Long COVID Nutrition Guide</h3>
      
      <div className="nutrition-categories">
        {/* Database-derived beneficial foods */}
        {dbBeneficial.length > 0 && (
          <div className="category-section beneficial">
            <h4>✅ Your Anti-Inflammatory Foods (From Database)</h4>
            <div className="database-foods">
              {dbBeneficial.map((food, index) => (
                <div key={index} className="database-food-item">
                  <div className="food-header">
                    <strong>{food.name}</strong>
                    <span className={`anti-inflammatory-badge level-${food.antiInflammatory}`}>
                      {food.antiInflammatory.toUpperCase()}
                    </span>
                  </div>
                  {food.benefits.length > 0 && (
                    <ul className="food-benefits">
                      {food.benefits.map((benefit, i) => (
                        <li key={i}>{benefit}</li>
                      ))}
                    </ul>
                  )}
                  <div className="food-category-tag">{food.category}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Standard beneficial foods */}
        <div className="category-section beneficial">
          <h4>✅ Anti-Inflammatory Foods {dbBeneficial.length > 0 ? '(General Recommendations)' : ''}</h4>
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

        {/* Database-derived neutral foods */}
        {dbNeutral.length > 0 && (
          <div className="category-section neutral">
            <h4>ℹ️ Your Neutral Foods (From Database)</h4>
            <div className="database-foods">
              {dbNeutral.map((food, index) => (
                <div key={index} className="database-food-item">
                  <div className="food-header">
                    <strong>{food.name}</strong>
                    <span className={`anti-inflammatory-badge level-${food.antiInflammatory}`}>
                      {food.antiInflammatory.toUpperCase()}
                    </span>
                  </div>
                  <div className="food-category-tag">{food.category}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Standard recommended foods */}
        <div className="category-section neutral">
          <h4>ℹ️ Recommended Foods {dbNeutral.length > 0 ? '(General Recommendations)' : ''}</h4>
          <ul>
            <li><strong>Whole Grains:</strong> Oats, quinoa, brown rice</li>
            <li><strong>Lean Proteins:</strong> Chicken, turkey, legumes</li>
            <li><strong>Citrus Fruits:</strong> High in vitamin C</li>
            <li><strong>Olive Oil:</strong> Monounsaturated fats</li>
            <li><strong>Garlic & Onions:</strong> Immune support</li>
          </ul>
        </div>

        {/* Database-derived caution foods */}
        {dbCaution.length > 0 && (
          <div className="category-section caution">
            <h4>⚠️ Your Foods to Monitor (From Database)</h4>
            <div className="database-foods">
              {dbCaution.map((food, index) => (
                <div key={index} className="database-food-item">
                  <div className="food-header">
                    <strong>{food.name}</strong>
                    <span className={`anti-inflammatory-badge level-${food.antiInflammatory}`}>
                      {food.antiInflammatory.toUpperCase()}
                    </span>
                  </div>
                  {food.cautions.length > 0 && (
                    <ul className="food-cautions">
                      {food.cautions.map((caution, i) => (
                        <li key={i}>{caution}</li>
                      ))}
                    </ul>
                  )}
                  <div className="food-category-tag">{food.category}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Standard foods to limit */}
        <div className="category-section caution">
          <h4>⚠️ Foods to Limit {dbCaution.length > 0 ? '(General Guidelines)' : ''}</h4>
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

      {/* Database insights summary */}
      {(dbBeneficial.length > 0 || dbNeutral.length > 0 || dbCaution.length > 0) && (
        <div className="database-insights">
          <h4>📊 Your Personal Insights</h4>
          <div className="insights-summary">
            {dbBeneficial.length > 0 && (
              <div className="insight-item beneficial">
                <span className="insight-number">{dbBeneficial.length}</span>
                <span className="insight-label">Anti-inflammatory foods in your log</span>
              </div>
            )}
            {dbNeutral.length > 0 && (
              <div className="insight-item neutral">
                <span className="insight-number">{dbNeutral.length}</span>
                <span className="insight-label">Neutral foods tracked</span>
              </div>
            )}
            {dbCaution.length > 0 && (
              <div className="insight-item caution">
                <span className="insight-number">{dbCaution.length}</span>
                <span className="insight-label">Foods to monitor</span>
              </div>
            )}
          </div>
          <p className="insights-note">
            <em>Based on {foodLog.length} logged meals with Long COVID database information</em>
          </p>
        </div>
      )}

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

// Helper Functions
const getCovidFoodRating = (foodName) => {
  const foodLower = foodName.toLowerCase();
  
  // Beneficial foods (anti-inflammatory)
  const beneficial = [
    'salmon', 'mackerel', 'sardines', 'tuna', 'trout',
    'blueberries', 'strawberries', 'raspberries', 'blackberries',
    'spinach', 'kale', 'broccoli', 'brussels sprouts',
    'walnuts', 'almonds', 'chia seeds', 'flax seeds',
    'turmeric', 'ginger', 'garlic', 'onion',
    'olive oil', 'avocado', 'sweet potato',
    'green tea', 'dark chocolate'
  ];
  
  // Foods to be cautious with
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
 // Calculate metabolic efficiency - Enhanced version with FIXED Long COVID adjustments
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
  
  // FIXED: Long COVID adjustments using metabolic efficiency factors (< 1.0)
  if (mealData.longCovidAdjust && userProfile?.hasLongCovid) {
    // Use factors that REDUCE efficiency (< 1.0) - this is correct for metabolic efficiency
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

  // Memoize fetchSuggestions function
// WORKING SOLUTION: Replace your fetchSuggestions function with this
const fetchSuggestions = useCallback(async () => {
  const normalizedSearch = search.toLowerCase().trim();
  
  // Don't search for very short terms
  if (normalizedSearch.length < 2) {
    setSuggestions([]);
    return;
  }
  
  // Check cache first
  if (suggestionCache[normalizedSearch]) {
    setSuggestions(suggestionCache[normalizedSearch]);
    return;
  }
  
  try {
    console.log(`Searching for: "${normalizedSearch}"`);
    
    // STRATEGY: Get a reasonable number of documents and filter client-side
    // This works with any existing database structure
    const q = query(
      collection(db, 'meals'),
      limit(100) // Adjust this based on your database size
    );
    
    const snap = await getDocs(q);
    console.log(`Retrieved ${snap.docs.length} total documents from database`);
    
    // Client-side case-insensitive filtering
    const allMeals = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const filteredResults = allMeals.filter(meal => {
      if (!meal.name) return false;
      
      const mealNameLower = meal.name.toLowerCase();
      
      // Multiple matching strategies for better results
      return mealNameLower.includes(normalizedSearch) ||
             mealNameLower.startsWith(normalizedSearch) ||
             // Also check if any word in the name starts with the search term
             mealNameLower.split(' ').some(word => word.startsWith(normalizedSearch));
    });
    
    console.log(`Filtered to ${filteredResults.length} matching results`);
    
    // Sort results by relevance
    const sortedResults = filteredResults.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      
      // Exact match gets highest priority
      if (aName === normalizedSearch && bName !== normalizedSearch) return -1;
      if (bName === normalizedSearch && aName !== normalizedSearch) return 1;
      
      // Starts with gets second priority
      if (aName.startsWith(normalizedSearch) && !bName.startsWith(normalizedSearch)) return -1;
      if (bName.startsWith(normalizedSearch) && !aName.startsWith(normalizedSearch)) return 1;
      
      // Word starts with gets third priority
      const aWordStartsMatch = aName.split(' ').some(word => word.startsWith(normalizedSearch));
      const bWordStartsMatch = bName.split(' ').some(word => word.startsWith(normalizedSearch));
      
      if (aWordStartsMatch && !bWordStartsMatch) return -1;
      if (bWordStartsMatch && !aWordStartsMatch) return 1;
      
      // Alphabetical for everything else
      return aName.localeCompare(bName);
    });
    
    // Limit final results
    const finalResults = sortedResults.slice(0, 15);
    
    console.log(`Final results:`, finalResults.map(r => r.name));
    
    // Cache the results
    setSuggestionCache(prev => ({
      ...prev,
      [normalizedSearch]: finalResults
    }));
    
    setSuggestions(finalResults);
    
  } catch (err) {
    console.error('Error fetching food suggestions:', err);
    setSuggestions([]);
  }
}, [search, suggestionCache]);

// ALTERNATIVE: If your database is very large, use this paginated approach

// DEBUG FUNCTION: Check what's in your database


// TEST FUNCTION: Call this to see what's in your database


// ADD THIS TO YOUR COMPONENT TO DEBUG
// Call these functions in your browser console or add them temporarily to useEffect:

/*
// Add this temporarily to your component to debug
useEffect(() => {
  if (currentUser && !authLoading) {
    // Debug your database
    debugDatabase();
    
    // Test search
    testSearch('chicken').then(results => {
      console.log('Test search results:', results);
    });
  }
}, [currentUser, authLoading]);
*/





  // Fetch suggestions from Firestore
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

  // Memoize fetchFoodLog function
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

  // Fetch food log when tab changes to Food Journal
  useEffect(() => {
    if (tab === 'Food Journal' && currentUser) {
      fetchFoodLog(1);
    }
  }, [tab, currentUser, fetchFoodLog]);

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
      {/* Long COVID Checkbox - prominently placed at top */}
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
                {longCovidAdjust && (
                  <span className={`covid-indicator ${getCovidFoodRating(s.name)}`}>
                    {getCovidFoodRating(s.name) === 'beneficial' ? '✓' : 
                     getCovidFoodRating(s.name) === 'caution' ? '⚠' : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Rest of your existing form fields... */}
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

      {/* Rest of existing form... */}
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
      isSearching={search.length >= 2 && !selectedMeal} // Pass search state
      searchTerm={search} // Pass current search term
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