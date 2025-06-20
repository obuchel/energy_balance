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
          
          // Populate form with current data
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

  // Load user data on component mount
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Handle logout - Complete logout from both localStorage and Firebase Auth
  const handleLogout = async () => {
    console.log('Logout clicked - starting complete logout process');
    
    try {
      // 1. Sign out from Firebase Auth
      if (auth.currentUser) {
        console.log('Signing out Firebase user:', auth.currentUser.email);
        await signOut(auth);
        console.log('Firebase signOut successful');
      } else {
        console.log('No Firebase user to sign out');
      }
      
      // 2. Clear localStorage
      console.log('Clearing localStorage userData');
      localStorage.removeItem('userData');
      
      // 3. Clear any other potential session data
      sessionStorage.clear();
      console.log('Cleared sessionStorage');
      
      // 4. Reset component state
      setUserData(null);
      setLoading(false);
      
      console.log('Complete logout finished, navigating to login...');
      
      // 5. Navigate to login with replace to prevent back navigation
      navigate('/login', { replace: true });
      
    } catch (error) {
      console.error('Error during logout:', error);
      
      // Even if Firebase signOut fails, still clear local data and redirect
      localStorage.removeItem('userData');
      sessionStorage.clear();
      setUserData(null);
      
      navigate('/login', { replace: true });
    }
  };

  // Handle account deletion
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
    
    // Step 1: Reauthenticate user with password
    console.log('🔐 Reauthenticating user...');
    const credential = EmailAuthProvider.credential(user.email, deletePassword);
    await reauthenticateWithCredential(user, credential);
    
    // Step 2: Delete all user data from Firestore with complete verification
    console.log('🗑️ Starting complete data deletion...');
    await deleteUserDataCompletely(userData);
    
    // Step 3: Clear local storage
    console.log('🧹 Clearing local storage...');
    localStorage.removeItem('userData');
    sessionStorage.clear();
    
    // Step 4: Delete the Firebase Auth user account (must be last)
    console.log('🔥 Deleting Firebase Auth account...');
    await deleteUser(user);
    console.log('✅ Firebase Auth user deleted successfully');
    
    // Step 5: Navigate to confirmation page
    navigate('/login', { 
      replace: true,
      state: { message: 'Your account has been successfully deleted.' }
    });
    
  } catch (error) {
    console.error('❌ Error deleting account:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/wrong-password') {
      setErrors({ deletePassword: 'Incorrect password' });
    } else if (error.code === 'auth/requires-recent-login') {
      setErrors({ deletePassword: 'Please log out and log back in before deleting your account' });
    } else if (error.code === 'auth/too-many-requests') {
      setErrors({ deletePassword: 'Too many failed attempts. Please try again later.' });
    } else {
      // For any other errors (including Firestore deletion failures)
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
  const MAX_BATCH_SIZE = 500; // Firestore batch limit
  
  // Collections to delete from
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
    
    // Step 1: Delete all related collection data in batches
    for (const collectionName of collections) {
      await deleteCollectionData(collectionName, userId, MAX_BATCH_SIZE);
    }
    
    // Step 2: Delete the main user document
    await deleteUserDocument(userId);
    
    // Step 3: Verify complete deletion
    await verifyDeletion(userId, collections);
    
    console.log('✅ Complete user data deletion verified successfully');
    return { success: true, message: 'User data completely deleted' };
    
  } catch (error) {
    console.error('❌ Error during user deletion:', error);
    throw new Error(`Failed to delete user data: ${error.message}`);
  }
}

// Delete data from a specific collection with batch management
async function deleteCollectionData(collectionName, userId, maxBatchSize) {
  let hasMore = true;
  
  while (hasMore) {
    const batch = writeBatch(db);
    let batchCount = 0;
    
    // Query for documents (limit to batch size)
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
    
    // Add deletions to batch
    snapshot.forEach((docSnapshot) => {
      batch.delete(docSnapshot.ref);
      batchCount++;
    });
    
    // Commit batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`📦 Deleted ${batchCount} documents from ${collectionName}`);
    }
    
    // Check if we need another batch
    hasMore = snapshot.size === maxBatchSize;
    
    // Add a small delay between batches to avoid rate limiting
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`✅ ${collectionName}: Complete deletion finished`);
}

// Delete the main user document
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

// Verify that all data has been completely deleted
async function verifyDeletion(userId, collections) {
  console.log('🔍 Verifying complete deletion...');
  
  // Check main user document
  const userDocRef = doc(db, "users", userId);
  const userDoc = await getDoc(userDocRef);
  
  if (userDoc.exists()) {
    throw new Error('User document still exists after deletion');
  }
  
  // Check each collection for remaining data
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

  // Handle form input changes
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
    
    // Clear related errors
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle password form changes
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear related errors
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle delete password change
  const handleDeletePasswordChange = (e) => {
    setDeletePassword(e.target.value);
    if (errors.deletePassword) {
      setErrors(prev => ({ ...prev, deletePassword: '' }));
    }
  };

  // Validate form data
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

  // Validate password change
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

  // Save profile changes
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
      
      // Update Firestore
      const userDocRef = doc(db, "users", userData.id);
      await updateDoc(userDocRef, updatedData);
      
      // Update localStorage
      const storedUserData = JSON.parse(localStorage.getItem('userData'));
      const updatedStoredData = { ...storedUserData, ...updatedData };
      localStorage.setItem('userData', JSON.stringify(updatedStoredData));
      
      // Update local state
      setUserData(prev => ({ ...prev, ...updatedData }));
      
      setSuccessMessage('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrors({ submit: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Change password
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
      
      // Reauthenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, passwordData.newPassword);
      
      // Clear password form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setSuccessMessage('Password updated successfully!');
      setShowPasswordSection(false);
      
      // Clear success message after 3 seconds
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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255, 255, 255, 0.3)',
            borderTop: '3px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto 30px', textAlign: 'center' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <button 
            onClick={() => navigate('/dashboard')} 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s ease'
            }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          <button 
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s ease'
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          color: 'white',
          margin: '0 0 10px',
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          Personal Settings
        </h1>
        <p style={{
          fontSize: '1.1rem',
          color: 'rgba(255, 255, 255, 0.9)',
          margin: '0'
        }}>
          Update your profile information and preferences
        </p>
      </div>

      {successMessage && (
        <div style={{
          maxWidth: '800px',
          margin: '0 auto 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: '#d4edda',
          border: '1px solid #c3e6cb',
          color: '#155724',
          padding: '12px 20px',
          borderRadius: '8px',
          animation: 'slideDown 0.3s ease'
        }}>
          <Check size={20} />
          {successMessage}
        </div>
      )}

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Profile Information Section */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '30px',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            marginBottom: '30px',
            paddingBottom: '20px',
            borderBottom: '2px solid #f8f9fa'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#2d3748',
              margin: '0 0 8px'
            }}>
              Profile Information
            </h2>
            <p style={{ color: '#718096', margin: '0', lineHeight: '1.6' }}>
              Update your personal details to help us provide better energy management recommendations.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  <User size={16} style={{ color: '#667eea' }} />
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  style={{
                    padding: '12px 16px',
                    border: `2px solid ${errors.name ? '#f56565' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                  placeholder="Enter your full name"
                />
                {errors.name && (
                  <p style={{ color: '#f56565', fontSize: '14px', margin: '5px 0 0' }}>
                    {errors.name}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  <Mail size={16} style={{ color: '#667eea' }} />
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  style={{
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    background: '#f7fafc',
                    color: '#a0aec0',
                    cursor: 'not-allowed'
                  }}
                  disabled
                  title="Email cannot be changed. Contact support if you need to update your email."
                />
                <p style={{ fontSize: '12px', color: '#a0aec0', margin: '4px 0 0' }}>
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  Age *
                </label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  style={{
                    padding: '12px 16px',
                    border: `2px solid ${errors.age ? '#f56565' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                  placeholder="Your age"
                  min="13"
                  max="100"
                />
                {errors.age && (
                  <p style={{ color: '#f56565', fontSize: '14px', margin: '5px 0 0' }}>
                    {errors.age}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  Gender *
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  style={{
                    padding: '12px 16px',
                    border: `2px solid ${errors.gender ? '#f56565' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
                {errors.gender && (
                  <p style={{ color: '#f56565', fontSize: '14px', margin: '5px 0 0' }}>
                    {errors.gender}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  <Scale size={16} style={{ color: '#667eea' }} />
                  Weight (kg)
                </label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                  style={{
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                  placeholder="Optional"
                  step="0.1"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  <Ruler size={16} style={{ color: '#667eea' }} />
                  Height (cm)
                </label>
                <input
                  type="number"
                  name="height"
                  value={formData.height}
                  onChange={handleInputChange}
                  style={{
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                  placeholder="Optional"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  <Calendar size={16} style={{ color: '#667eea' }} />
                  First COVID Date
                </label>
                <input
                  type="date"
                  name="covidDate"
                  value={formData.covidDate}
                  onChange={handleInputChange}
                  style={{padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  Long COVID Duration
                </label>
                <select
                  name="covidDuration"
                  value={formData.covidDuration}
                  onChange={handleInputChange}
                  style={{
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <option value="">Select duration</option>
                  <option value="less-than-1-month">Less than 1 month</option>
                  <option value="1-3-months">1-3 months</option>
                  <option value="3-6-months">3-6 months</option>
                  <option value="6-12-months">6-12 months</option>
                  <option value="1-2-years">1-2 years</option>
                  <option value="more-than-2-years">More than 2 years</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  COVID Severity
                </label>
                <select
                  name="severity"
                  value={formData.severity}
                  onChange={handleInputChange}
                  style={{
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <option value="">Select severity</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
            </div>

            {/* Symptoms Section */}
            <div style={{ marginTop: '30px' }}>
              <label style={{
                display: 'block',
                fontWeight: '500',
                color: '#4a5568',
                marginBottom: '16px',
                fontSize: '16px'
              }}>
                Long COVID Symptoms (select all that apply)
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '12px'
              }}>
                {symptomOptions.map((symptom) => (
                  <label key={symptom} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: formData.symptoms.includes(symptom) ? '#ebf8ff' : 'white',
                    borderColor: formData.symptoms.includes(symptom) ? '#667eea' : '#e2e8f0'
                  }}>
                    <input
                      type="checkbox"
                      name="symptoms"
                      value={symptom}
                      checked={formData.symptoms.includes(symptom)}
                      onChange={handleInputChange}
                      style={{
                        width: '18px',
                        height: '18px',
                        accentColor: '#667eea'
                      }}
                    />
                    <span style={{
                      fontSize: '14px',
                      color: '#4a5568'
                    }}>
                      {symptom}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Medical Conditions */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{
                fontWeight: '500',
                color: '#4a5568',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                Other Medical Conditions
              </label>
              <textarea
                name="medicalConditions"
                value={formData.medicalConditions}
                onChange={handleInputChange}
                style={{
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  resize: 'vertical',
                  minHeight: '100px',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease'
                }}
                placeholder="List any other medical conditions or medications that might affect your energy levels..."
              />
            </div>

            {errors.submit && (
              <div style={{
                background: '#fed7d7',
                border: '1px solid #feb2b2',
                color: '#c53030',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px'
              }}>
                {errors.submit}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: saving ? '#a0aec0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '16px 32px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                width: 'fit-content'
              }}
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Password Change Section */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '30px',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            marginBottom: '30px',
            paddingBottom: '20px',
            borderBottom: '2px solid #f8f9fa'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#2d3748',
              margin: '0 0 8px'
            }}>
              Security Settings
            </h2>
            <p style={{ color: '#718096', margin: '0 0 20px', lineHeight: '1.6' }}>
              Change your password to keep your account secure.
            </p>
            <button
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(102, 126, 234, 0.1)',
                border: '1px solid #667eea',
                color: '#667eea',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
            >
              <Lock size={16} />
              {showPasswordSection ? 'Cancel Password Change' : 'Change Password'}
            </button>
          </div>

          {showPasswordSection && (
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  Current Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    style={{
                      width: '100%',
                      padding: '12px 50px 12px 16px',
                      border: `2px solid ${errors.currentPassword ? '#f56565' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s ease'
                    }}
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#a0aec0',
                      padding: '4px'
                    }}
                  >
                    {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.currentPassword && (
                  <p style={{ color: '#f56565', fontSize: '14px', margin: '5px 0 0' }}>
                    {errors.currentPassword}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  New Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    style={{
                      width: '100%',
                      padding: '12px 50px 12px 16px',
                      border: `2px solid ${errors.newPassword ? '#f56565' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s ease'
                    }}
                    placeholder="Enter your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#a0aec0',
                      padding: '4px'
                    }}
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.newPassword && (
                  <p style={{ color: '#f56565', fontSize: '14px', margin: '5px 0 0' }}>
                    {errors.newPassword}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{
                  fontWeight: '500',
                  color: '#4a5568',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  Confirm New Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    style={{
                      width: '100%',
                      padding: '12px 50px 12px 16px',
                      border: `2px solid ${errors.confirmPassword ? '#f56565' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s ease'
                    }}
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#a0aec0',
                      padding: '4px'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p style={{ color: '#f56565', fontSize: '14px', margin: '5px 0 0' }}>
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  background: saving ? '#a0aec0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '16px 32px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  width: 'fit-content'
                }}
              >
                <Lock size={18} />
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* Account Deletion Section */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '30px',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
          border: '2px solid #fed7d7'
        }}>
          <div style={{
            marginBottom: '30px',
            paddingBottom: '20px',
            borderBottom: '2px solid #f8f9fa'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#c53030',
              margin: '0 0 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertTriangle size={24} />
              Danger Zone
            </h2>
            <p style={{ color: '#718096', margin: '0 0 20px', lineHeight: '1.6' }}>
              Once you delete your account, there is no going back. This action will permanently delete your account and all associated data.
            </p>
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#fed7d7',
                border: '1px solid #f56565',
                color: '#c53030',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
            >
              <Trash2 size={16} />
              Delete Account
            </button>
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirmation && (
            <div style={{
              background: '#fed7d7',
              border: '1px solid #f56565',
              borderRadius: '8px',
              padding: '20px',
              marginTop: '20px'
            }}>
              <h3 style={{
                color: '#c53030',
                margin: '0 0 15px',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Are you absolutely sure?
              </h3>
              <p style={{
                color: '#744210',
                margin: '0 0 20px',
                lineHeight: '1.6'
              }}>
                This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
              </p>
              <div style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => setShowDeletePasswordConfirmation(true)}
                  disabled={deleting}
                  style={{
                    background: '#c53030',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: deleting ? 0.6 : 1
                  }}
                >
                  {deleting ? 'Deleting...' : 'Yes, delete my account'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirmation(false)}
                  disabled={deleting}
                  style={{
                    background: 'white',
                    color: '#4a5568',
                    border: '1px solid #e2e8f0',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Password Confirmation for Deletion */}
          {showDeletePasswordConfirmation && (
            <div style={{
              background: '#fed7d7',
              border: '1px solid #f56565',
              borderRadius: '8px',
              padding: '20px',
              marginTop: '20px'
            }}>
              <h3 style={{
                color: '#c53030',
                margin: '0 0 15px',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Confirm Your Password
              </h3>
              <p style={{
                color: '#744210',
                margin: '0 0 20px',
                lineHeight: '1.6'
              }}>
                Please enter your password to confirm account deletion.
              </p>
              
              <div style={{ marginBottom: '20px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showDeletePassword ? 'text' : 'password'}
                    value={deletePassword}
                    onChange={handleDeletePasswordChange}
                    style={{
                      width: '100%',
                      padding: '12px 50px 12px 16px',
                      border: `2px solid ${errors.deletePassword ? '#f56565' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s ease'
                    }}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#a0aec0',
                      padding: '4px'
                    }}
                  >
                    {showDeletePassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.deletePassword && (
                  <p style={{ color: '#f56565', fontSize: '14px', margin: '5px 0 0' }}>
                    {errors.deletePassword}
                  </p>
                )}
                {errors.deleteAccount && (
                  <p style={{ color: '#f56565', fontSize: '14px', margin: '5px 0 0' }}>
                    {errors.deleteAccount}
                  </p>
                )}
              </div>

              <div style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || !deletePassword.trim()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: deleting || !deletePassword.trim() ? '#fed7d7' : '#c53030',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    cursor: deleting || !deletePassword.trim() ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: deleting || !deletePassword.trim() ? 0.6 : 1
                  }}
                >
                  <Trash2 size={16} />
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
                  style={{
                    background: 'white',
                    color: '#4a5568',
                    border: '1px solid #e2e8f0',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS Animation for success message */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
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
        
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #667eea !important;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
};

export default PersonalSettings;