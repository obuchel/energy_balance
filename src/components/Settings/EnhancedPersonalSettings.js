import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase-config';
import { doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from 'firebase/auth';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Mail, 
  Lock, 
  Calendar, 
  Scale, 
  Ruler, 
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Bell,
  Shield,
  Palette,
  Trash2,
  Download,
  Upload
} from 'lucide-react';

const symptomOptions = [
  'Fatigue', 'Post-exertional malaise', 'Brain fog', 'Headaches', 
  'Shortness of breath', 'Heart palpitations', 'Dizziness', 'Joint/muscle pain',
  'Sleep disturbances', 'Temperature regulation issues', 'Digestive issues'
];

const EnhancedPersonalSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  
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

  const [preferencesData, setPreferencesData] = useState({
    notifications: true,
    reminderFrequency: 'daily',
    dataRetention: '1year',
    theme: 'light',
    energyUnits: 'percentage',
    weekStartsOn: 'monday',
    timeFormat: '12hour'
  });

  const [notificationData, setNotificationData] = useState({
    emailNotifications: true,
    pushNotifications: true,
    energyAlerts: true,
    dailyReminders: true,
    weeklyReports: false,
    dataExportReady: true
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Load user data on component mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
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
          
          // Populate forms with current data
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

          setPreferencesData({
            notifications: data.preferences?.notifications ?? true,
            reminderFrequency: data.preferences?.reminderFrequency || 'daily',
            dataRetention: data.preferences?.dataRetention || '1year',
            theme: data.preferences?.theme || 'light',
            energyUnits: data.preferences?.energyUnits || 'percentage',
            weekStartsOn: data.preferences?.weekStartsOn || 'monday',
            timeFormat: data.preferences?.timeFormat || '12hour'
          });

          setNotificationData({
            emailNotifications: data.notifications?.emailNotifications ?? true,
            pushNotifications: data.notifications?.pushNotifications ?? true,
            energyAlerts: data.notifications?.energyAlerts ?? true,
            dailyReminders: data.notifications?.dailyReminders ?? true,
            weeklyReports: data.notifications?.weeklyReports ?? false,
            dataExportReady: data.notifications?.dataExportReady ?? true
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
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
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

  // Handle preferences changes
  const handlePreferencesChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreferencesData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle notifications changes
  const handleNotificationChange = (e) => {
    const { name, checked } = e.target;
    setNotificationData(prev => ({
      ...prev,
      [name]: checked
    }));
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
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrors({ submit: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Save preferences
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    
    setSaving(true);
    setErrors({});
    setSuccessMessage('');
    
    try {
      const updatedPreferences = {
        preferences: preferencesData,
        lastUpdated: new Date().toISOString()
      };
      
      const userDocRef = doc(db, "users", userData.id);
      await updateDoc(userDocRef, updatedPreferences);
      
      setSuccessMessage('Preferences updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error('Error updating preferences:', error);
      setErrors({ submit: 'Failed to update preferences. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Save notifications
  const handleSaveNotifications = async (e) => {
    e.preventDefault();
    
    setSaving(true);
    setErrors({});
    setSuccessMessage('');
    
    try {
      const updatedNotifications = {
        notifications: notificationData,
        lastUpdated: new Date().toISOString()
      };
      
      const userDocRef = doc(db, "users", userData.id);
      await updateDoc(userDocRef, updatedNotifications);
      
      setSuccessMessage('Notification preferences updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error('Error updating notifications:', error);
      setErrors({ submit: 'Failed to update notification preferences. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Export user data
  const handleExportData = () => {
    const dataToExport = {
      profile: formData,
      preferences: preferencesData,
      notifications: notificationData,
      exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `energy-balance-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setSuccessMessage('Data exported successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you absolutely sure? This action cannot be undone.')) {
      return;
    }
    
    try {
      setSaving(true);
      
      // Delete user document from Firestore
      const userDocRef = doc(db, "users", userData.id);
      await deleteDoc(userDocRef);
      
      // Delete Firebase Auth user
      const user = auth.currentUser;
      if (user) {
        await deleteUser(user);
      }
      
      // Clear local storage
      localStorage.removeItem('userData');
      sessionStorage.clear();
      
      // Redirect to login
      navigate('/login', { replace: true });
      
    } catch (error) {
      console.error('Error deleting account:', error);
      setErrors({ submit: 'Failed to delete account. Please try again or contact support.' });
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

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'data', label: 'Data & Privacy', icon: Download }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto 30px', textAlign: 'center' }}>
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
            marginBottom: '20px',
            transition: 'all 0.2s ease'
          }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          color: 'white',
          margin: '0 0 10px',
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          Settings
        </h1>
        <p style={{
          fontSize: '1.1rem',
          color: 'rgba(255, 255, 255, 0.9)',
          margin: '0'
        }}>
          Manage your profile, preferences, and privacy settings
        </p>
      </div>

      {successMessage && (
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: '#d4edda',
          border: '1px solid #c3e6cb',
          color: '#155724',
          padding: '12px 20px',
          borderRadius: '8px'
        }}>
          <Check size={20} />
          {successMessage}
        </div>
      )}

      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '20px' }}>
        {/* Sidebar Navigation */}
        <div style={{
          width: '250px',
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
          height: 'fit-content'
        }}>
          <nav>
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    background: activeTab === tab.id ? '#667eea' : 'transparent',
                    color: activeTab === tab.id ? 'white' : '#4a5568',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '4px',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1 }}>
          {activeTab === 'profile' && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '30px',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ margin: '0 0 20px', color: '#2d3748' }}>Profile Information</h2>
              {/* Profile form content - same as before */}
              <form onSubmit={handleSaveProfile}>
                {/* Profile form fields here - condensed for brevity */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                  {/* Add other form fields similarly */}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    marginTop: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Save size={16} />
                  Save Profile
                </button>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '30px',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ margin: '0 0 20px', color: '#2d3748' }}>Notification Preferences</h2>
              <form onSubmit={handleSaveNotifications}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {Object.entries(notificationData).map(([key, value]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        name={key}
                        checked={value}
                        onChange={handleNotificationChange}
                      />
                      <span style={{ textTransform: 'capitalize' }}>
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    marginTop: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Save size={16} />
                  Save Notifications
                </button>
              </form>
            </div>
          )}

          {activeTab === 'data' && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '30px',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ margin: '0 0 20px', color: '#2d3748' }}>Data & Privacy</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <button
                  onClick={handleExportData}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    background: '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={16} />
                  Export My Data
                </button>
                
                <div style={{
                  padding: '20px',
                  border: '2px solid #fed7d7',
                  borderRadius: '8px',
                  background: '#fef5e7'
                }}>
                  <h3 style={{ color: '#c53030', margin: '0 0 10px' }}>Danger Zone</h3>
                  <p style={{ margin: '0 0 15px', color: '#744210' }}>
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <button
                    onClick={() => setShowDeleteConfirmation(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      background: '#e53e3e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={16} />
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add other tab content as needed */}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#e53e3e', marginBottom: '15px' }}>Delete Account</h3>
            <p style={{ marginBottom: '20px' }}>
              This will permanently delete your account and all data. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                style={{
                  padding: '10px 20px',
                  background: '#e2e8f0',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  background: '#e53e3e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {saving ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default EnhancedPersonalSettings;