import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from "../../firebase-config";
import "../Common.css";
import "./SignInPage.css";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Add interactive effects (same as SignInPage)
  React.useEffect(() => {
    const inputs = document.querySelectorAll('input');

    // Add input animation effects
    inputs.forEach(input => {
      const handleFocus = () => {
        if (input.parentElement) {
          input.parentElement.style.transform = 'scale(1.02)';
        }
      };
      
      const handleBlur = () => {
        if (input.parentElement) {
          input.parentElement.style.transform = 'scale(1)';
        }
      };

      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);

      return () => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      };
    });
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    
    try {
      const cleanEmail = email.toLowerCase().trim();

      // Basic validation
      if (!cleanEmail) {
        throw new Error('Please enter your email address');
      }

      // Check Firebase Auth configuration
      if (!auth) {
        throw new Error('Firebase Auth not properly configured');
      }

      console.log('Attempting password reset for:', cleanEmail);
      
      // Send password reset email
      await sendPasswordResetEmail(auth, cleanEmail);
      
      console.log('Password reset email sent successfully');
      setSuccess("Password reset email sent! Please check your inbox and follow the instructions to reset your password.");
      
      // Clear the email field
      setEmail("");
      
    } catch (error) {
      console.error("Password reset error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      
      let errorMessage = "An error occurred while sending the reset email. Please try again.";
      
      // Handle specific Firebase Auth errors
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = "No account found with this email address. Please check your email or register first.";
          break;
        case 'auth/invalid-email':
          errorMessage = "Invalid email address format.";
          break;
        case 'auth/too-many-requests':
          errorMessage = "Too many reset attempts. Please wait a few minutes and try again.";
          break;
        case 'auth/network-request-failed':
          errorMessage = "Network error. Please check your internet connection and try again.";
          break;
        case 'auth/operation-not-allowed':
          errorMessage = "Password reset is not enabled. Please contact support.";
          break;
        default:
          if (error.code) {
            errorMessage = `Password reset failed: ${error.code}. Please try again or contact support.`;
          }
          break;
      }
      
      console.error("Final error message shown to user:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    navigate('/login');
  };

  return (
    <div className="signin-container animated-page-container">
      {/* Animated background elements */}
      <div className="bg-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>

      <div className="signin-card glass-card">
        <div className="glass-card-content">
          <div className="signin-header">
            {/* Enhanced logo */}
            <div className="logo-container">
              <div className="logo"></div>
            </div>
            <h1>Reset Password</h1>
            <p>Enter your email to receive a password reset link</p>
          </div>
          
          {success && (
            <div className="success-message" style={{
              backgroundColor: '#d1fae5',
              border: '1px solid #10b981',
              color: '#065f46',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              {success}
            </div>
          )}
          
          {error && <div className="error-message">{error}</div>}
          
          <form className="signin-form" onSubmit={onSubmit}>
            <div className="form-group">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoComplete="email"
                className="form-input"
              />
              <label htmlFor="email" className="form-label">Email Address</label>
            </div>
            
            <button 
              type="submit" 
              className="signin-button btn btn-primary"
              disabled={loading}
            >
              {loading && <span className="loading-spinner-small"></span>}
              <span>{loading ? "Sending..." : "Send Reset Link"}</span>
            </button>
          </form>
          
          <div className="divider"></div>
          
          <div className="signup-link">
            Remember your password? <button 
              onClick={handleBackToSignIn}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit'
              }}
            >
              Sign in here
            </button>
          </div>
          
          {/* Instructions Section */}
          <div className="about-section">
            <h3>How it works</h3>
            <p>
              Enter your email address above and we'll send you a secure link to reset your password. 
              The link will expire in 1 hour for security reasons.
            </p>
            <p>
              If you don't see the email in your inbox, please check your spam folder. 
              You can also try registering a new account if you continue to have issues.
            </p>
            
            <div className="supported-devices">
              <h4>Need Help?</h4>
              <div className="device-icons">
                <div className="device-item">
                  <span className="device-icon">📧</span>
                  <span>Check Spam Folder</span>
                </div>
                <div className="device-item">
                  <span className="device-icon">⏰</span>
                  <span>Link Expires in 1 Hour</span>
                </div>
                <div className="device-item">
                  <span className="device-icon">🔒</span>
                  <span>Secure Reset Process</span>
                </div>
                <div className="device-item">
                  <span className="device-icon">📱</span>
                  <span>Works on All Devices</span>
                </div>
                <div className="device-item">
                  <span className="device-icon">❓</span>
                  <span>Contact Support</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="debug-info">
              <strong>Debug Info:</strong><br/>
              Firebase Auth URL: {auth.config?.authDomain}<br/>
              Form Email: {email || 'None'}<br/>
              Environment: {process.env.NODE_ENV}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage; 