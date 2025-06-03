import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Clock, 
  Utensils, 
  Coffee, 
  Apple, 
  Zap,
  Calendar,
  Save,
  Trash2,
  AlertCircle
} from 'lucide-react';
import './FoodTracker.css';

const FoodTrackerPage = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [selectedMeal, setSelectedMeal] = useState('breakfast');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFoods, setSelectedFoods] = useState([]);
  const [mealTime, setMealTime] = useState('');
  const [energyBefore, setEnergyBefore] = useState(5);
  const [energyAfter, setEnergyAfter] = useState(5);
  const [symptoms, setSymptoms] = useState([]);
  const [notes, setNotes] = useState('');

  // Sample food database - in a real app, this would come from an API
  const foodDatabase = [
    { id: 1, name: 'Oatmeal with berries', calories: 320, category: 'breakfast', energyImpact: 'positive' },
    { id: 2, name: 'Greek yogurt', calories: 150, category: 'breakfast', energyImpact: 'positive' },
    { id: 3, name: 'Banana', calories: 105, category: 'snack', energyImpact: 'positive' },
    { id: 4, name: 'Coffee (black)', calories: 5, category: 'beverage', energyImpact: 'positive' },
    { id: 5, name: 'Avocado toast', calories: 280, category: 'breakfast', energyImpact: 'positive' },
    { id: 6, name: 'Chicken salad', calories: 350, category: 'lunch', energyImpact: 'neutral' },
    { id: 7, name: 'Quinoa bowl', calories: 420, category: 'lunch', energyImpact: 'positive' },
    { id: 8, name: 'Salmon with vegetables', calories: 450, category: 'dinner', energyImpact: 'positive' },
    { id: 9, name: 'Pizza slice', calories: 290, category: 'lunch', energyImpact: 'negative' },
    { id: 10, name: 'Ice cream', calories: 220, category: 'dessert', energyImpact: 'negative' },
    { id: 11, name: 'Green smoothie', calories: 180, category: 'beverage', energyImpact: 'positive' },
    { id: 12, name: 'Nuts (handful)', calories: 160, category: 'snack', energyImpact: 'positive' },
    { id: 13, name: 'White bread', calories: 80, category: 'carb', energyImpact: 'negative' },
    { id: 14, name: 'Sweet potato', calories: 112, category: 'vegetable', energyImpact: 'positive' },
    { id: 15, name: 'Energy drink', calories: 110, category: 'beverage', energyImpact: 'negative' }
  ];

  const mealTypes = [
    { id: 'breakfast', name: 'Breakfast', icon: Coffee, time: '07:00' },
    { id: 'lunch', name: 'Lunch', icon: Utensils, time: '12:00' },
    { id: 'dinner', name: 'Dinner', icon: Utensils, time: '18:00' },
    { id: 'snack', name: 'Snack', icon: Apple, time: '15:00' }
  ];

  const symptomOptions = [
    'Fatigue increase', 'Brain fog', 'Nausea', 'Bloating', 
    'Headache', 'Joint pain', 'Energy crash', 'Difficulty concentrating',
    'Digestive issues', 'Mood changes'
  ];

  useEffect(() => {
    // Get user data from localStorage
    const storedUserData = localStorage.getItem('userData');
    if (storedUserData) {
      setUserData(JSON.parse(storedUserData));
    }

    // Set default meal time based on current time
    const now = new Date();
    const currentHour = now.getHours();
    
    let defaultMeal = 'breakfast';
    let defaultTime = '07:00';
    
    if (currentHour >= 11 && currentHour < 16) {
      defaultMeal = 'lunch';
      defaultTime = '12:00';
    } else if (currentHour >= 16 && currentHour < 21) {
      defaultMeal = 'dinner';
      defaultTime = '18:00';
    } else if (currentHour >= 21 || currentHour < 7) {
      defaultMeal = 'snack';
      defaultTime = '15:00';
    }
    
    setSelectedMeal(defaultMeal);
    setMealTime(defaultTime);
  }, []);

  const filteredFoods = foodDatabase.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    food.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addFood = (food) => {
    const existingFood = selectedFoods.find(f => f.id === food.id);
    if (existingFood) {
      setSelectedFoods(selectedFoods.map(f =>
        f.id === food.id ? { ...f, quantity: f.quantity + 1 } : f
      ));
    } else {
      setSelectedFoods([...selectedFoods, { ...food, quantity: 1 }]);
    }
    setSearchQuery(''); // Clear search after adding
  };

  const removeFood = (foodId) => {
    setSelectedFoods(selectedFoods.filter(f => f.id !== foodId));
  };

  const updateQuantity = (foodId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFood(foodId);
    } else {
      setSelectedFoods(selectedFoods.map(f =>
        f.id === foodId ? { ...f, quantity: newQuantity } : f
      ));
    }
  };

  const toggleSymptom = (symptom) => {
    setSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const getTotalCalories = () => {
    return selectedFoods.reduce((total, food) => total + (food.calories * food.quantity), 0);
  };

  const getEnergyImpactColor = (impact) => {
    switch (impact) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const handleSave = async () => {
    const mealData = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      mealType: selectedMeal,
      time: mealTime,
      foods: selectedFoods,
      totalCalories: getTotalCalories(),
      energyBefore,
      energyAfter,
      symptoms,
      notes,
      userId: userData?.id
    };

    try {
      // In a real app, save to Firestore or API
      console.log('Saving meal data:', mealData);
      
      // For now, save to localStorage for demo purposes
      const existingMeals = JSON.parse(localStorage.getItem('mealHistory') || '[]');
      existingMeals.push(mealData);
      localStorage.setItem('mealHistory', JSON.stringify(existingMeals));

      // Show success message and navigate back
      alert('Meal tracked successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving meal:', error);
      alert('Failed to save meal. Please try again.');
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className="food-tracker-page">
      <div className="food-tracker-container">
        {/* Header */}
        <div className="tracker-header">
          <button className="back-button" onClick={handleBack}>
            <ArrowLeft className="icon" />
            Back to Dashboard
          </button>
          <h1 className="page-title">Track Your Meal</h1>
          <p className="page-subtitle">Monitor how food affects your energy levels</p>
        </div>

        <div className="tracker-content">
          {/* Meal Type Selection */}
          <div className="card meal-type-selection">
            <h3 className="card-title">Meal Type & Time</h3>
            <div className="meal-types">
              {mealTypes.map(meal => {
                const Icon = meal.icon;
                return (
                  <button
                    key={meal.id}
                    className={`meal-type-btn ${selectedMeal === meal.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedMeal(meal.id);
                      setMealTime(meal.time);
                    }}
                  >
                    <Icon className="meal-icon" />
                    <span>{meal.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="time-input-group">
              <label htmlFor="mealTime">Time:</label>
              <input
                type="time"
                id="mealTime"
                value={mealTime}
                onChange={(e) => setMealTime(e.target.value)}
                className="time-input"
              />
            </div>
          </div>

          {/* Food Search & Selection */}
          <div className="card food-selection">
            <h3 className="card-title">Add Foods</h3>
            <div className="search-container">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search for foods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {searchQuery && (
              <div className="search-results">
                {filteredFoods.slice(0, 8).map(food => (
                  <div key={food.id} className="food-item">
                    <div className="food-info">
                      <span className="food-name">{food.name}</span>
                      <span className="food-details">
                        {food.calories} cal
                        <span 
                          className="energy-impact"
                          style={{ color: getEnergyImpactColor(food.energyImpact) }}
                        >
                          • {food.energyImpact}
                        </span>
                      </span>
                    </div>
                    <button
                      className="add-food-btn"
                      onClick={() => addFood(food)}
                    >
                      <Plus className="icon" />
                    </button>
                  </div>
                ))}
                {filteredFoods.length === 0 && (
                  <div className="no-results">No foods found matching "{searchQuery}"</div>
                )}
              </div>
            )}
          </div>

          {/* Selected Foods */}
          {selectedFoods.length > 0 && (
            <div className="card selected-foods">
              <h3 className="card-title">
                Your Meal
                <span className="total-calories">{getTotalCalories()} calories</span>
              </h3>
              <div className="food-list">
                {selectedFoods.map(food => (
                  <div key={food.id} className="selected-food-item">
                    <div className="food-info">
                      <span className="food-name">{food.name}</span>
                      <span className="food-calories">
                        {food.calories * food.quantity} cal
                      </span>
                    </div>
                    <div className="quantity-controls">
                      <button
                        onClick={() => updateQuantity(food.id, food.quantity - 1)}
                        className="quantity-btn"
                      >
                        -
                      </button>
                      <span className="quantity">{food.quantity}</span>
                      <button
                        onClick={() => updateQuantity(food.id, food.quantity + 1)}
                        className="quantity-btn"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFood(food.id)}
                        className="remove-btn"
                      >
                        <Trash2 className="icon" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Energy Levels */}
          <div className="card energy-tracking">
            <h3 className="card-title">
              <Zap className="icon" />
              Energy Levels
            </h3>
            <div className="energy-inputs">
              <div className="energy-input-group">
                <label>Energy Before Eating:</label>
                <div className="energy-slider">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={energyBefore}
                    onChange={(e) => setEnergyBefore(parseInt(e.target.value))}
                    className="slider"
                  />
                  <span className="energy-value">{energyBefore}/10</span>
                </div>
              </div>
              <div className="energy-input-group">
                <label>Energy After Eating (if applicable):</label>
                <div className="energy-slider">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={energyAfter}
                    onChange={(e) => setEnergyAfter(parseInt(e.target.value))}
                    className="slider"
                  />
                  <span className="energy-value">{energyAfter}/10</span>
                </div>
              </div>
            </div>
          </div>

          {/* Symptoms */}
          <div className="card symptoms-tracking">
            <h3 className="card-title">
              <AlertCircle className="icon" />
              Any Symptoms?
            </h3>
            <div className="symptoms-grid">
              {symptomOptions.map(symptom => (
                <button
                  key={symptom}
                  className={`symptom-btn ${symptoms.includes(symptom) ? 'active' : ''}`}
                  onClick={() => toggleSymptom(symptom)}
                >
                  {symptom}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="card notes-section">
            <h3 className="card-title">Additional Notes</h3>
            <textarea
              placeholder="How did this meal make you feel? Any observations about energy, mood, or symptoms..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="notes-textarea"
              rows="4"
            />
          </div>

          {/* Save Button */}
          <div className="save-section">
            <button
              onClick={handleSave}
              className="save-btn"
              disabled={selectedFoods.length === 0}
            >
              <Save className="icon" />
              Save Meal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodTrackerPage;