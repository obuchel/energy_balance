import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase-config';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut } from 'firebase/auth';
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
  LogOut
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
  const [userData, setUserData] = useState(null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
                  style={{
                    padding: '12px 16px',
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
                Symptom Severity
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
                <option value="very-severe">Very Severe</option>
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
                Current Symptoms (Select all that apply)
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '10px',
                marginTop: '10px'
              }}>
                {symptomOptions.map(symptom => (
                  <label
                    key={symptom}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 16px',
                      border: `2px solid ${formData.symptoms.includes(symptom) ? '#667eea' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: formData.symptoms.includes(symptom) ? 'rgba(102, 126, 234, 0.05)' : 'white'
                    }}
                  >
                    <input
                      type="checkbox"
                      name="symptoms"
                      value={symptom}
                      checked={formData.symptoms.includes(symptom)}
                      onChange={handleInputChange}
                      style={{ margin: '0' }}
                    />
                    <span style={{ fontSize: '14px', color: '#4a5568' }}>{symptom}</span>
                  </label>
                ))}
              </div>
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
                Medical Conditions
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
                  transition: 'all 0.2s ease',
                  resize: 'vertical',
                  minHeight: '80px'
                }}
                rows="3"
                placeholder="List any pre-existing medical conditions..."
              />
            </div>

            {errors.submit && (
              <div style={{ color: '#f56565', fontSize: '14px', textAlign: 'center' }}>
                {errors.submit}
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'flex-end',
              marginTop: '20px'
            }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  background: '#667eea',
                  color: 'white',
                  opacity: saving ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {saving ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid transparent',
                      borderTop: '2px solid currentColor',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
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
              Password & Security
            </h2>
            <p style={{ color: '#718096', margin: '0', lineHeight: '1.6' }}>
              Keep your account secure by updating your password regularly.
            </p>
          </div>

          {!showPasswordSection ? (
            <button
              onClick={() => setShowPasswordSection(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                background: '#e2e8f0',
                color: '#4a5568',
                transition: 'all 0.2s ease'
              }}
            >
              <Lock size={16} />
              Change Password
            </button>
          ) : (
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {['currentPassword', 'newPassword', 'confirmPassword'].map((field, index) => {
                const showPassword = field === 'currentPassword' ? showCurrentPassword : 
                                   field === 'newPassword' ? showNewPassword : showConfirmPassword;
                const setShowPassword = field === 'currentPassword' ? setShowCurrentPassword : 
                                       field === 'newPassword' ? setShowNewPassword : setShowConfirmPassword;
                const labels = ['Current Password *', 'New Password *', 'Confirm New Password *'];
                const placeholders = [
                  'Enter your current password',
                  'Enter your new password (min 6 characters)',
                  'Confirm your new password'
                ];

                return (
                  <div key={field} style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: '500',
                      color: '#4a5568',
                      marginBottom: '8px',
                      fontSize: '14px'
                    }}>
                      {labels[index]}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        name={field}
                        value={passwordData[field]}
                        onChange={handlePasswordChange}
                        style={{
                          padding: '12px 16px',
                          paddingRight: '45px',
                          border: `2px solid ${errors[field] ? '#f56565' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          fontSize: '16px',
                          transition: 'all 0.2s ease',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                        placeholder={placeholders[index]}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#a0aec0',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {errors[field] && (
                      <p style={{ color: '#f56565', fontSize: '14px', margin: '5px 0 0' }}>
                        {errors[field]}
                      </p>
                    )}
                  </div>
                );
              })}

              <div style={{
                display: 'flex',
                gap: '15px',
                justifyContent: 'flex-end',
                marginTop: '20px'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordSection(false);
                    setPasswordData({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                    setErrors({});
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    background: '#e2e8f0',
                    color: '#4a5568',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    background: '#667eea',
                    color: 'white',
                    opacity: saving ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {saving ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid currentColor',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Update Password
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Device Information Section (Read-only) */}
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
              Device Information
            </h2>
            <p style={{ color: '#718096', margin: '0', lineHeight: '1.6' }}>
              Your connected devices and data sources.
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '20px',
            border: '2px solid #e2e8f0',
            borderRadius: '8px',
            background: '#f7fafc'
          }}>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#2d3748',
                margin: '0 0 5px',
                textTransform: 'capitalize'
              }}>
                {userData?.selectedDevice || 'No device connected'}
              </h3>
              <p style={{ fontSize: '14px', color: '#718096', margin: '0 0 3px' }}>
                Status: {userData?.deviceConnected ? 'Connected' : 'Not connected'}
              </p>
              {userData?.lastUpdated && (
                <p style={{ fontSize: '14px', color: '#718096', margin: '0' }}>
                  Last updated: {new Date(userData.lastUpdated).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes slideDown {
            0% {
              opacity: 0;
              transform: translateY(-10px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default PersonalSettings;