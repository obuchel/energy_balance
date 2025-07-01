import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase-config';
import { doc, updateDoc, getDoc, deleteDoc, collection, query, where, getDocs, writeBatch, limit } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut, deleteUser } from 'firebase/auth';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Mail, 
  Lock, 
  Calendar, 
  Scale, 
  Ruler, 
  Check,
  Eye,
  EyeOff,
  LogOut,
  Trash2,
  AlertTriangle
} from 'lucide-react';

const symptomOptions = [
  'Fatigue', 'Post-exertional malaise', 'Brain fog', 'Headaches', 
  'Shortness of breath', 'Heart palpitations', 'Dizziness', 'Joint/muscle pain',
  'Sleep disturbances', 'Temperature regulation issues', 'Digestive issues'
];

const PersonalSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userData, setUserData] = useState(null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showDeletePasswordConfirmation, setShowDeletePasswordConfirmation] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    gender: '',
    weight: '',
    height: '',
    covidDate: '',
    covidDuration: '',
    severity: '',
    symptoms: [],
    medicalConditions: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Floating label functionality
  useEffect(() => {
    const inputs = document.querySelectorAll('input, select, textarea');

    const handleFloatingLabels = (input) => {
      const formGroup = input.closest('.form-group');
      const label = formGroup?.querySelector('.form-label');
      
      if (!label || !formGroup) {
        return {
          handleFocus: () => {},
          handleBlur: () => {},
          handleInput: () => {},
          updateLabelState: () => {}
        };
      }

      const updateLabelState = () => {
        const hasValue = input.value && input.value.length > 0;
        const isFocused = document.activeElement === input;
        
        if (hasValue || isFocused) {
          label.classList.add('floating');
          formGroup.classList.add('has-content');
        } else {
          label.classList.remove('floating');
          formGroup.classList.remove('has-content');
        }
      };

      updateLabelState();

      const handleFocus = () => {
        try {
          if (input.closest('.form-group')) {
            input.closest('.form-group').style.transform = 'scale(1.02)';
          }
          label.classList.add('floating');
          formGroup.classList.add('focused');
          updateLabelState();
        } catch (error) {
          console.warn('Error in handleFocus:', error);
        }
      };
      
      const handleBlur = () => {
        try {
          if (input.closest('.form-group')) {
            input.closest('.form-group').style.transform = 'scale(1)';
          }
          formGroup.classList.remove('focused');
          updateLabelState();
        } catch (error) {
          console.warn('Error in handleBlur:', error);
        }
      };

      const handleInput = () => {
        try {
          updateLabelState();
        } catch (error) {
          console.warn('Error in handleInput:', error);
        }
      };

      return { handleFocus, handleBlur, handleInput, updateLabelState };
    };

    const inputHandlers = [];
    inputs.forEach(input => {
      try {
        const handlers = handleFloatingLabels(input);
        
        if (handlers && handlers.handleFocus) {
          input.addEventListener('focus', handlers.handleFocus);
          input.addEventListener('blur', handlers.handleBlur);
          input.addEventListener('input', handlers.handleInput);
          
          inputHandlers.push({ input, handlers });
        }
      } catch (error) {
        console.warn('Error setting up input handlers:', error);
      }
    });

    return () => {
      inputHandlers.forEach(({ input, handlers }) => {
        try {
          if (input && handlers) {
            input.removeEventListener('focus', handlers.handleFocus);
            input.removeEventListener('blur', handlers.handleBlur);
            input.removeEventListener('input', handlers.handleInput);
          }
        } catch (error) {
          console.warn('Error cleaning up input handlers:', error);
        }
      });
    };
  }, []);

  useEffect(() => {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      try {
        const formGroup = input.closest('.form-group');
        const label = formGroup?.querySelector('.form-label');
        
        if (label && formGroup) {
          const hasValue = input.value && input.value.length > 0;
          
          if (hasValue) {
            label.classList.add('floating');
            formGroup.classList.add('has-content');
          } else {
            label.classList.remove('floating');
            formGroup.classList.remove('has-content');
          }
        }
      } catch (error) {
        console.warn('Error updating floating labels:', error);
      }
    });
  }, [formData]);

  // Memoized loadUserData function to fix useEffect dependency warning
  const loadUserData = useCallback(async () => {
    try {
      const storedUserData = localStorage.getItem('userData');
      if (!storedUserData) {
        navigate('/login');
        return;
      }

      const parsedUserData = JSON.parse(storedUserData);
      
      if (parsedUserData.id) {
        const userDocRef = doc(db, "users", parsedUserData.id);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setUserData({ id: parsedUserData.id, ...data });
          
          setFormData({
            name: data.name || '',
            email: data.email || '',
            age: data.age || '',
            gender: data.gender || '',
            weight: data.weight || '',
            height: data.height || '',
            covidDate: data.covidDate || '',
            covidDuration: data.covidDuration || '',
            severity: data.severity || '',
            symptoms: data.symptoms || [],
            medicalConditions: data.medicalConditions || ''
          });
        } else {
          console.error('User document not found');
          navigate('/login');
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleLogout = async () => {
    console.log('Logout clicked - starting complete logout process');
    
    try {
      if (auth.currentUser) {
        console.log('Signing out Firebase user:', auth.currentUser.email);
        await signOut(auth);
        console.log('Firebase signOut successful');
      } else {
        console.log('No Firebase user to sign out');
      }
      
      console.log('Clearing localStorage userData');
      localStorage.removeItem('userData');
      
      sessionStorage.clear();
      console.log('Cleared sessionStorage');
      
      setUserData(null);
      setLoading(false);
      
      console.log('Complete logout finished, navigating to login...');
      
      navigate('/login', { replace: true });
      
    } catch (error) {
      console.error('Error during logout:', error);
      
      localStorage.removeItem('userData');
      sessionStorage.clear();
      setUserData(null);
      
      navigate('/login', { replace: true });
    }
  };

  // Enhanced account deletion handler with complete data removal and verification
  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      setErrors({ deletePassword: 'Password is required for account deletion' });
      return;
    }

    setDeleting(true);
    setErrors({});
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      console.log('🔐 Reauthenticating user...');
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      
      console.log('🗑️ Starting complete data deletion...');
      await deleteUserDataCompletely(userData);
      
      console.log('🧹 Clearing local storage...');
      localStorage.removeItem('userData');
      sessionStorage.clear();
      
      console.log('🔥 Deleting Firebase Auth account...');
      await deleteUser(user);
      console.log('✅ Firebase Auth user deleted successfully');
      
      navigate('/login', { 
        replace: true,
        state: { message: 'Your account has been successfully deleted.' }
      });
      
    } catch (error) {
      console.error('❌ Error deleting account:', error);
      
      if (error.code === 'auth/wrong-password') {
        setErrors({ deletePassword: 'Incorrect password' });
      } else if (error.code === 'auth/requires-recent-login') {
        setErrors({ deletePassword: 'Please log out and log back in before deleting your account' });
      } else if (error.code === 'auth/too-many-requests') {
        setErrors({ deletePassword: 'Too many failed attempts. Please try again later.' });
      } else {
        setErrors({ 
          deleteAccount: `Failed to delete account: ${error.message}. Please try again or contact support.` 
        });
      }
    } finally {
      setDeleting(false);
    }
  };

  // Complete user data deletion with batching and verification
  async function deleteUserDataCompletely(userData) {
    const userId = userData.id;
    const MAX_BATCH_SIZE = 500;
    
    const collections = [
      'timeseries',
      'energyLogs', 
      'symptoms',
      'activities',
      'devices',
      'recommendations',
      'analytics',
      'settings'
    ];

    try {
      console.log(`🚀 Starting complete deletion for user: ${userId}`);
      
      for (const collectionName of collections) {
        await deleteCollectionData(collectionName, userId, MAX_BATCH_SIZE);
      }
      
      await deleteUserDocument(userId);
      
      await verifyDeletion(userId, collections);
      
      console.log('✅ Complete user data deletion verified successfully');
      return { success: true, message: 'User data completely deleted' };
      
    } catch (error) {
      console.error('❌ Error during user deletion:', error);
      throw new Error(`Failed to delete user data: ${error.message}`);
    }
  }

  async function deleteCollectionData(collectionName, userId, maxBatchSize) {
    let hasMore = true;
    
    while (hasMore) {
      const batch = writeBatch(db);
      let batchCount = 0;
      
      const q = query(
        collection(db, collectionName),
        where("userId", "==", userId),
        limit(maxBatchSize)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        hasMore = false;
        break;
      }
      
      snapshot.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
        batchCount++;
      });
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`📦 Deleted ${batchCount} documents from ${collectionName}`);
      }
      
      hasMore = snapshot.size === maxBatchSize;
      
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ ${collectionName}: Complete deletion finished`);
  }

  async function deleteUserDocument(userId) {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      await deleteDoc(userDocRef);
      console.log('✅ User document deleted');
    } else {
      console.log('ℹ️ User document already deleted or does not exist');
    }
  }

  async function verifyDeletion(userId, collections) {
    console.log('🔍 Verifying complete deletion...');
    
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      throw new Error('User document still exists after deletion');
    }
    
    for (const collectionName of collections) {
      const q = query(
        collection(db, collectionName),
        where("userId", "==", userId),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        throw new Error(`Found remaining data in ${collectionName} collection`);
      }
    }
    
    console.log('✅ Deletion verification completed - no remaining data found');
  }

  const handleInputChange = (e) => {
    const { name, value, checked } = e.target;
    
    if (name === 'symptoms') {
      setFormData(prev => ({
        ...prev,
        symptoms: checked 
          ? [...prev.symptoms, value]
          : prev.symptoms.filter(s => s !== value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDeletePasswordChange = (e) => {
    setDeletePassword(e.target.value);
    if (errors.deletePassword) {
      setErrors(prev => ({ ...prev, deletePassword: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.age) {
      newErrors.age = 'Age is required';
    } else if (formData.age < 13) {
      newErrors.age = 'Age must be at least 13';
    }
    
    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordChange = () => {
    const newErrors = {};
    
    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    if (!passwordData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = 'New password must be at least 6 characters';
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (passwordData.currentPassword === passwordData.newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    setErrors({});
    setSuccessMessage('');
    
    try {
      const updatedData = {
        ...formData,
        age: parseInt(formData.age),
        weight: formData.weight ? parseFloat(formData.weight) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        lastUpdated: new Date().toISOString()
      };
      
      const userDocRef = doc(db, "users", userData.id);
      await updateDoc(userDocRef, updatedData);
      
      const storedUserData = JSON.parse(localStorage.getItem('userData'));
      const updatedStoredData = { ...storedUserData, ...updatedData };
      localStorage.setItem('userData', JSON.stringify(updatedStoredData));
      
      setUserData(prev => ({ ...prev, ...updatedData }));
      
      setSuccessMessage('Profile updated successfully!');
      
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrors({ submit: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (!validatePasswordChange()) {
      return;
    }
    
    setSaving(true);
    setErrors({});
    setSuccessMessage('');
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      await updatePassword(user, passwordData.newPassword);
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setSuccessMessage('Password updated successfully!');
      setShowPasswordSection(false);
      
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error('Error changing password:', error);
      
      if (error.code === 'auth/wrong-password') {
        setErrors({ currentPassword: 'Current password is incorrect' });
      } else if (error.code === 'auth/weak-password') {
        setErrors({ newPassword: 'New password is too weak' });
      } else {
        setErrors({ submit: 'Failed to change password. Please try again.' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="personal-settings-page">
        <div className="bg-animation">
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="personal-settings-page">
      <div className="bg-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>

      <div className="settings-container">
        <div className="settings-header">
          <div className="header-actions">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="btn btn-secondary btn-icon-left"
            >
            <ArrowLeft className="btn-icon" />
             🏠 Dashboard
            </button>
           

            <button className="logout-btn" onClick={handleLogout}>
  <LogOut className="btn-icon" />
  Logout
</button>
          </div>
          <div className="settings-title-section">
            <div className="title-icon">⚙️</div>
            <h1 className="settings-title">Personal Settings</h1>
            <p className="settings-subtitle">
              Update your profile information and preferences
            </p>
          </div>
        </div>

        {successMessage && (
          <div className="success-message">
            <Check className="success-icon" />
            {successMessage}
          </div>
        )}

        {/* Profile Information Section */}
        <div className="settings-card">
          <div className="card-header">
            <h2 className="card-title">Profile Information</h2>
            <p className="card-description">
              Update your personal details to help us provide better energy management recommendations.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="settings-form">
            <div className="form-grid two-cols">
              <div className="form-group">
                <User className="form-label-icon" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`form-input ${errors.name ? 'error' : ''}`}
                  placeholder="Enter your full name"
                />
                <label className="form-label">Full Name *</label>
                {errors.name && <p className="error-message">{errors.name}</p>}
              </div>

              <div className="form-group">
                <Mail className="form-label-icon" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  className="form-input disabled"
                  disabled
                  title="Email cannot be changed. Contact support if you need to update your email."
                />
                <label className="form-label">Email Address</label>
                <p className="input-hint">Email cannot be changed. Contact support if needed.</p>
              </div>

              <div className="form-group">
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className={`form-input ${errors.age ? 'error' : ''}`}
                  placeholder="Your age"
                  min="13"
                  max="100"
                />
                <label className="form-label">Age *</label>
                {errors.age && <p className="error-message">{errors.age}</p>}
              </div>

              <div className="form-group">
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className={`form-select ${errors.gender ? 'error' : ''}`}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
                <label className="form-label">Gender *</label>
                {errors.gender && <p className="error-message">{errors.gender}</p>}
              </div>

              <div className="form-group">
                <Scale className="form-label-icon" />
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Optional"
                  step="0.1"
                />
                <label className="form-label">Weight (kg)</label>
              </div>

              <div className="form-group">
                <Ruler className="form-label-icon" />
                <input
                  type="number"
                  name="height"
                  value={formData.height}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Optional"
                />
                <label className="form-label">Height (cm)</label>
              </div>

              <div className="form-group">
                <Calendar className="form-label-icon" />
                <input
                  type="date"
                  name="covidDate"
                  value={formData.covidDate}
                  onChange={handleInputChange}
                  className="form-input"
                />
                <label className="form-label">First COVID Date</label>
              </div>

              <div className="form-group">
                <select
                  name="covidDuration"
                  value={formData.covidDuration}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="">Select duration</option>
                  <option value="less-than-1-month">Less than 1 month</option>
                  <option value="1-3-months">1-3 months</option>
                  <option value="3-6-months">3-6 months</option>
                  <option value="6-12-months">6-12 months</option>
                  <option value="1-2-years">1-2 years</option>
                  <option value="more-than-2-years">More than 2 years</option>
                </select>
                <label className="form-label">Long COVID Duration</label>
              </div>

              <div className="form-group">
                <select
                  name="severity"
                  value={formData.severity}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="">Select severity</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
                <label className="form-label">COVID Severity</label>
              </div>
            </div>

            {/* Symptoms Section */}
            <div className="symptoms-section">
              <label className="form-label">
                Long COVID Symptoms (select all that apply)
              </label>
              <div className="symptoms-grid">
                {symptomOptions.map((symptom) => (
                  <label
                    key={symptom}
                    className={`symptom-checkbox ${
                      formData.symptoms.includes(symptom) ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="symptoms"
                      value={symptom}
                      checked={formData.symptoms.includes(symptom)}
                      onChange={handleInputChange}
                      className="symptom-checkbox-input"
                    />
                    <span className="symptom-checkbox-text">{symptom}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Medical Conditions */}
            <div className="form-group">
              <textarea
                name="medicalConditions"
                value={formData.medicalConditions}
                onChange={handleInputChange}
                className="form-textarea"
                rows="3"
                placeholder="List any other medical conditions or medications that might affect your energy levels..."
              />
              <label className="form-label">Other Medical Conditions</label>
            </div>

            {errors.submit && (
              <div className="error-message-box">
                {errors.submit}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary btn-icon-left"
            >
              <Save className="btn-icon" />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Password Change Section */}
        <div className="settings-card">
          <div className="card-header">
            <h2 className="card-title">Security Settings</h2>
            <p className="card-description">
              Change your password to keep your account secure.
            </p>
            <button
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="btn btn-secondary btn-icon-left"
            >
              <Lock className="btn-icon" />
              {showPasswordSection ? 'Cancel Password Change' : 'Change Password'}
            </button>
          </div>

          {showPasswordSection && (
            <form onSubmit={handleChangePassword} className="settings-form">
              <div className="form-group">
                <div className="password-input-wrapper">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    className={`form-input ${errors.currentPassword ? 'error' : ''}`}
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="password-toggle"
                  >
                    {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <label className="form-label">Current Password *</label>
                {errors.currentPassword && <p className="error-message">{errors.currentPassword}</p>}
              </div>

              <div className="form-group">
                <div className="password-input-wrapper">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className={`form-input ${errors.newPassword ? 'error' : ''}`}
                    placeholder="Enter your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="password-toggle"
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <label className="form-label">New Password *</label>
                {errors.newPassword && <p className="error-message">{errors.newPassword}</p>}
              </div>

              <div className="form-group">
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="password-toggle"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <label className="form-label">Confirm New Password *</label>
                {errors.confirmPassword && <p className="error-message">{errors.confirmPassword}</p>}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary btn-icon-left"
              >
                <Lock className="btn-icon" />
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* Account Deletion Section */}
        <div className="settings-card danger-card">
          <div className="card-header">
            <h2 className="card-title danger-title">
              <AlertTriangle className="danger-icon" />
              Danger Zone
            </h2>
            <p className="card-description">
              Once you delete your account, there is no going back. This action will permanently delete your account and all associated data.
            </p>
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              className="btn btn-danger btn-icon-left"
            >
              <Trash2 className="btn-icon" />
              Delete Account
            </button>
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirmation && (
            <div className="danger-confirmation">
              <h3 className="danger-confirmation-title">
                Are you absolutely sure?
              </h3>
              <p className="danger-confirmation-text">
                This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
              </p>
              <div className="danger-actions">
                <button
                  onClick={() => setShowDeletePasswordConfirmation(true)}
                  disabled={deleting}
                  className="btn btn-danger"
                >
                  {deleting ? 'Deleting...' : 'Yes, delete my account'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirmation(false)}
                  disabled={deleting}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Password Confirmation for Deletion */}
          {showDeletePasswordConfirmation && (
            <div className="danger-confirmation">
              <h3 className="danger-confirmation-title">
                Confirm Your Password
              </h3>
              <p className="danger-confirmation-text">
                Please enter your password to confirm account deletion.
              </p>
              
              <div className="form-group">
                <div className="password-input-wrapper">
                  <input
                    type={showDeletePassword ? 'text' : 'password'}
                    value={deletePassword}
                    onChange={handleDeletePasswordChange}
                    className={`form-input ${errors.deletePassword ? 'error' : ''}`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="password-toggle"
                  >
                    {showDeletePassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <label className="form-label">Password *</label>
                {errors.deletePassword && <p className="error-message">{errors.deletePassword}</p>}
                {errors.deleteAccount && <p className="error-message">{errors.deleteAccount}</p>}
              </div>

              <div className="danger-actions">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || !deletePassword.trim()}
                  className="btn btn-danger btn-icon-left"
                >
                  <Trash2 className="btn-icon" />
                  {deleting ? 'Deleting Account...' : 'Delete Account Permanently'}
                </button>
                <button
                  onClick={() => {
                    setShowDeletePasswordConfirmation(false);
                    setShowDeleteConfirmation(false);
                    setDeletePassword('');
                    setErrors(prev => ({ ...prev, deletePassword: '', deleteAccount: '' }));
                  }}
                  disabled={deleting}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        /* CSS Variables for consistent theming - EXACT MATCH TO REGISTRATION */
        :root {
          --primary-color: #3b82f6;
          --primary-dark: #2563eb;
          --primary-light: #dbeafe;
          --secondary-color: #6b7280;
          --success-color: #10b981;
          --success-light: #d1fae5;
          --error-color: #ef4444;
          --error-light: #fee2e2;
          --warning-color: #f59e0b;
          --warning-light: #fef3c7;
          --info-color: #06b6d4;
          --info-light: #cffafe;
          
          --gray-50: #f8fafc;
          --gray-100: #f1f5f9;
          --gray-200: #e2e8f0;
          --gray-300: #cbd5e1;
          --gray-400: #94a3b8;
          --gray-500: #64748b;
          --gray-600: #475569;
          --gray-700: #334155;
          --gray-800: #1e293b;
          --gray-900: #0f172a;
          
          --white: #ffffff;
          --black: #000000;
          
          --border-radius: 0.375rem;
          --border-radius-lg: 0.5rem;
          --border-radius-xl: 0.75rem;
          
          --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
          --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
          --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
          
          --transition: all 0.2s ease;
          --transition-fast: all 0.15s ease;
          --transition-slow: all 0.3s ease;
        }

        /* Reset and base styles */
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* Main page layout with animated background - EXACT MATCH TO REGISTRATION */
        .personal-settings-page {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--primary-color) 0%, #2563eb 100%);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 2rem 1rem;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.5;
          position: relative;
          overflow: hidden;
        }

        /* Animated background elements - EXACT SAME AS REGISTRATION */
        .bg-animation {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 0;
        }

        .floating-shape {
          position: absolute;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          animation: float 6s ease-in-out infinite;
        }

        .shape-1 {
          width: 80px;
          height: 80px;
          top: 20%;
          left: 10%;
          animation-delay: 0s;
        }

        .shape-2 {
          width: 120px;
          height: 120px;
          top: 60%;
          right: 15%;
          animation-delay: 2s;
        }

        .shape-3 {
          width: 60px;
          height: 60px;
          top: 40%;
          right: 25%;
          animation-delay: 4s;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }

        /* Loading container */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
          color: white;
          text-align: center;
          position: relative;
          z-index: 2;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top: 3px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Settings container */
        .settings-container {
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
          position: relative;
          z-index: 1;
        }

        /* Enhanced header with logo - simplified to match registration */
        .settings-header {
          position: relative;
          z-index: 2;
          margin-bottom: 3rem;
        }

        .header-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .logout-btn {
          background: rgba(255, 255, 255, 0.1) !important;
          border-color: rgba(255, 255, 255, 0.3) !important;
        }

        .settings-title-section {
          text-align: center;
        }

        .title-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          animation: pulse 2s ease-in-out infinite;
          filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.3));
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .settings-title {
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--white);
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.025em;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          animation: slideInUp 0.8s ease-out;
        }

        .settings-subtitle {
          font-size: 1.1rem;
          color: rgba(255, 255, 255, 0.9);
          margin: 0;
          font-weight: 400;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          animation: slideInUp 0.8s ease-out 0.2s both;
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Success message */
        .success-message {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid var(--success-color);
          color: var(--success-color);
          padding: 12px 20px;
          border-radius: 12px;
          margin-bottom: 2rem;
          animation: slideDown 0.3s ease;
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.2);
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .success-icon {
          width: 20px;
          height: 20px;
        }

        /* Enhanced main card with glassmorphism - EXACT MATCH TO REGISTRATION */
        .settings-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 2.5rem;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.1),
            0 1px 0 rgba(255, 255, 255, 0.8) inset;
          margin-bottom: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          position: relative;
          overflow: hidden;
          animation: slideInUp 0.8s ease-out;
        }

        /* Rotating glow effect - EXACT SAME AS REGISTRATION */
        .settings-card::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(from 0deg, transparent, rgba(59, 130, 246, 0.3), transparent);
          animation: rotate 8s linear infinite;
          opacity: 0.7;
          z-index: 0;
        }

        @keyframes rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .settings-card > * {
          position: relative;
          z-index: 2;
        }

        /* Danger card styling */
        .danger-card {
          border: 2px solid #fed7d7;
        }

        .danger-card::before {
          background: conic-gradient(from 0deg, transparent, rgba(239, 68, 68, 0.3), transparent);
        }

        /* Card header */
        .card-header {
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 2px solid #f8f9fa;
        }

        .card-title {
          font-size: 1.5rem;
          font-weight: 600;
          background: linear-gradient(135deg, var(--primary-color), #2563eb);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 0.5rem 0;
        }

        .danger-title {
          background: linear-gradient(135deg, var(--error-color), #dc2626);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .danger-icon {
          width: 24px;
          height: 24px;
          color: var(--error-color);
        }

        .card-description {
          color: #718096;
          margin: 0 0 1.5rem 0;
          line-height: 1.6;
        }

        /* Enhanced form styles with floating labels - EXACT MATCH TO REGISTRATION */
        .settings-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-grid {
          display: grid;
          gap: 1.5rem;
        }

        .form-grid.two-cols {
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        }

        .form-group {
          display: flex;
          flex-direction: column;
          position: relative;
          margin-bottom: 1.5rem;
          transition: var(--transition);
        }

        .form-group:hover {
          transform: translateY(-1px);
        }

        .form-group.focused {
          transform: scale(1.02);
        }

        .form-label {
          position: absolute;
          left: 1rem;
          top: 0.75rem;
          color: var(--gray-500);
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.3s ease;
          pointer-events: none;
          background: var(--white);
          padding: 0 0.25rem;
          transform-origin: left;
          z-index: 2;
        }

        .form-label.floating {
          top: -0.5rem;
          left: 0.75rem;
          font-size: 0.75rem;
          color: var(--primary-color);
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(59, 130, 246, 0.2);
          animation: labelFloat 0.3s ease forwards;
        }

        @keyframes labelFloat {
          from {
            top: 0.75rem;
            font-size: 0.875rem;
            color: var(--gray-500);
          }
          to {
            top: -0.5rem;
            font-size: 0.75rem;
            color: var(--primary-color);
          }
        }

        .form-group.focused .form-label {
          color: var(--primary-color);
        }

        .form-group.has-content .form-label {
          color: var(--primary-color);
        }

        .form-input,
        .form-select,
        .form-textarea {
          padding: 1rem 0.75rem 0.5rem 0.75rem;
          border: 2px solid var(--gray-300);
          border-radius: var(--border-radius-lg);
          font-size: 0.875rem;
          transition: var(--transition-slow);
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(10px);
          position: relative;
          z-index: 1;
          color: var(--gray-900);
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
          background: rgba(255, 255, 255, 0.95);
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: transparent;
        }

        .form-input.disabled {
          background: #f7fafc;
          color: #a0aec0;
          cursor: not-allowed;
        }

        .form-label-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--gray-500);
          z-index: 3;
          transition: color var(--transition);
          width: 1rem;
          height: 1rem;
        }

        .form-group:has(.form-label-icon) .form-input,
        .form-group:has(.form-label-icon) .form-select {
          padding-left: 2.75rem;
        }

        .form-group:has(.form-label-icon) .form-label {
          left: 2.75rem;
        }

        .form-group:has(.form-label-icon) .form-label.floating {
          left: 0.75rem;
        }

        .form-group.focused .form-label-icon,
        .form-group.has-content .form-label-icon {
          color: var(--primary-color);
        }

        .form-input.error,
        .form-select.error,
        .form-textarea.error {
          border-color: var(--error-color);
          box-shadow: 0 0 0 4px var(--error-light);
          animation: shake 0.5s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .form-textarea {
          resize: vertical;
          min-height: 100px;
          font-family: inherit;
        }

        .form-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 0.5rem center;
          background-repeat: no-repeat;
          background-size: 1.5em 1.5em;
          padding-right: 2.5rem;
        }

        .input-hint {
          font-size: 12px;
          color: #a0aec0;
          margin: 4px 0 0;
        }

        /* Password input wrapper */
        .password-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .password-input-wrapper .form-input {
          padding-right: 3rem;
          width: 100%;
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #a0aec0;
          padding: 4px;
          z-index: 3;
        }

        /* Enhanced symptoms grid - EXACT MATCH TO REGISTRATION */
        .symptoms-section {
          width: 100%;
          margin: 1.5rem 0;
          animation: slideInUp 0.6s ease-out;
        }

        .symptoms-section .form-label {
          position: static;
          margin-bottom: 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--gray-700);
          background: none;
          padding: 0;
        }

        .symptoms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
          padding: 0;
        }

        .symptom-checkbox {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          border: 2px solid var(--gray-300);
          border-radius: 12px;
          cursor: pointer;
          transition: var(--transition-slow);
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(10px);
          position: relative;
          min-height: 3rem;
          width: 100%;
          box-sizing: border-box;
          animation: slideInUp 0.6s ease-out;
          animation-fill-mode: both;
        }

        .symptom-checkbox:nth-child(1) { animation-delay: 0.1s; }
        .symptom-checkbox:nth-child(2) { animation-delay: 0.2s; }
        .symptom-checkbox:nth-child(3) { animation-delay: 0.3s; }
        .symptom-checkbox:nth-child(4) { animation-delay: 0.4s; }
        .symptom-checkbox:nth-child(5) { animation-delay: 0.5s; }
        .symptom-checkbox:nth-child(6) { animation-delay: 0.6s; }
        .symptom-checkbox:nth-child(7) { animation-delay: 0.7s; }
        .symptom-checkbox:nth-child(8) { animation-delay: 0.8s; }
        .symptom-checkbox:nth-child(9) { animation-delay: 0.9s; }
        .symptom-checkbox:nth-child(10) { animation-delay: 1.0s; }
        .symptom-checkbox:nth-child(11) { animation-delay: 1.1s; }

        .symptom-checkbox:hover {
          border-color: var(--primary-color);
          background: var(--primary-light);
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(59, 130, 246, 0.2);
        }

        .symptom-checkbox.selected {
          border-color: var(--primary-color);
          background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
          color: var(--white);
          box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
          transform: translateY(-2px) scale(1.02);
          animation: selectBounce 0.3s ease-out;
        }

        @keyframes selectBounce {
          0% { transform: translateY(-2px) scale(1); }
          50% { transform: translateY(-4px) scale(1.05); }
          100% { transform: translateY(-2px) scale(1.02); }
        }

        .symptom-checkbox-input {
          margin: 0 0.75rem 0 0;
          accent-color: var(--primary-color);
          width: 1.125rem;
          height: 1.125rem;
          flex-shrink: 0;
          cursor: pointer;
        }

        .symptom-checkbox.selected .symptom-checkbox-input {
          accent-color: var(--white);
        }

        .symptom-checkbox-text {
          font-size: 0.875rem;
          color: var(--gray-700);
          font-weight: 500;
          line-height: 1.3;
          flex: 1;
          cursor: pointer;
          user-select: none;
        }

        .symptom-checkbox.selected .symptom-checkbox-text {
          color: var(--white);
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* Enhanced buttons - EXACT MATCH TO REGISTRATION */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border-radius: var(--border-radius-lg);
          font-weight: 500;
          font-size: 0.875rem;
          transition: var(--transition-slow);
          cursor: pointer;
          border: 1px solid transparent;
          text-decoration: none;
          min-height: 2.5rem;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s ease;
        }

        .btn:hover:not(:disabled)::before {
          left: 100%;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
          color: var(--white);
          border-color: var(--primary-color);
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
        }

        .btn-primary:focus:not(:disabled) {
          outline: none;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.25);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.8);
          color: var(--gray-700);
          border-color: var(--gray-300);
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.95);
          border-color: var(--gray-400);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .btn-danger {
          background: linear-gradient(135deg, var(--error-color), #dc2626);
          color: var(--white);
          border-color: var(--error-color);
          box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
        }

        .btn-danger:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
        }

        .btn-icon {
          width: 1rem;
          height: 1rem;
        }

        .btn-icon-left {
          flex-direction: row;
        }

        /* Danger confirmation */
        .danger-confirmation {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1));
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 16px;
          padding: 1.5rem;
          margin-top: 1.5rem;
          backdrop-filter: blur(10px);
          animation: slideInUp 0.4s ease-out;
        }

        .danger-confirmation-title {
          color: var(--error-color);
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
          font-weight: 600;
        }

        .danger-confirmation-text {
          color: #744210;
          margin: 0 0 1.5rem 0;
          line-height: 1.6;
        }

        .danger-actions {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        /* Enhanced error messages */
        .error-message {
          color: var(--error-color);
          font-size: 0.875rem;
          margin-top: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          animation: shake 0.5s ease-in-out;
        }

        .error-message-box {
          background: #fed7d7;
          border: 1px solid #feb2b2;
          color: #c53030;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          margin-top: 1rem;
        }

        /* Enhanced responsive design */
        @media (max-width: 768px) {
          .personal-settings-page {
            padding: 1rem 0.5rem;
          }
          
          .settings-title {
            font-size: 2rem;
          }
          
          .settings-card {
            padding: 2rem 1.5rem;
            border-radius: 20px;
          }
          
          .card-title {
            font-size: 1.25rem;
          }
          
          .symptoms-grid {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
          
          .symptom-checkbox {
            padding: 0.625rem 0.875rem;
            min-height: 2.75rem;
          }
          
          .form-grid.two-cols {
            grid-template-columns: 1fr;
          }
          
          .header-actions {
            flex-direction: column;
            gap: 1rem;
          }
          
          .header-actions .btn {
            width: 100%;
          }
          
          .danger-actions {
            flex-direction: column;
          }
          
          .danger-actions .btn {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .settings-title {
            font-size: 1.75rem;
          }
          
          .settings-card {
            padding: 1.5rem 1rem;
            border-radius: 16px;
          }
          
          .card-title {
            font-size: 1.125rem;
          }
          
          .symptoms-grid {
            gap: 0.5rem;
          }
          
          .symptom-checkbox {
            padding: 0.5rem 0.75rem;
            min-height: 2.5rem;
            border-radius: 8px;
          }
          
          .symptom-checkbox-input {
            width: 1rem;
            height: 1rem;
            margin-right: 0.5rem;
          }
          
          .symptom-checkbox-text {
            font-size: 0.8125rem;
          }
        }

        /* Focus visible for better accessibility */
        .form-input:focus-visible,
        .form-select:focus-visible,
        .form-textarea:focus-visible,
        .btn:focus-visible,
        .symptom-checkbox:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          :root {
            --primary-color: #0000ff;
            --success-color: #008000;
            --error-color: #ff0000;
            --gray-600: #000000;
            --gray-700: #000000;
            --gray-900: #000000;
          }
          
          .settings-card {
            border-width: 2px;
          }
          
          .form-input,
          .form-select,
          .form-textarea {
            border-width: 2px;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
          
          .personal-settings-page::before,
          .personal-settings-page::after {
            animation: none;
          }
          
          .btn:hover,
          .symptom-checkbox:hover {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
};

export default PersonalSettings;