

#!/usr/bin/env python3
"""
Firebase Credentials Diagnostics & Fixer
Helps diagnose and fix Firebase service account issues
"""

import os
import json
import sys

def diagnose_firebase_credentials():
    """Diagnose Firebase credentials issues"""
    
    print("🔍 FIREBASE CREDENTIALS DIAGNOSTIC")
    print("=" * 50)
    
    # Check environment variable
    firebase_key = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')
    
    print("\n1. 🔧 ENVIRONMENT VARIABLE CHECK:")
    if firebase_key:
        print("✅ FIREBASE_SERVICE_ACCOUNT_KEY is set")
        print(f"   Length: {len(firebase_key)} characters")
        
        # Check if it looks like JSON
        if firebase_key.strip().startswith('{') and firebase_key.strip().endswith('}'):
            print("✅ Looks like JSON format")
        else:
            print("❌ Does not look like JSON format")
            print("   First 50 chars:", repr(firebase_key[:50]))
    else:
        print("❌ FIREBASE_SERVICE_ACCOUNT_KEY is not set")
        return
    
    print("\n2. 📝 JSON PARSING CHECK:")
    try:
        service_account_data = json.loads(firebase_key)
        print("✅ JSON parsing successful")
        
        # Check required fields
        required_fields = [
            'type',
            'project_id', 
            'private_key_id',
            'private_key',
            'client_email',
            'client_id',
            'auth_uri',
            'token_uri'
        ]
        
        print("\n3. 🔑 REQUIRED FIELDS CHECK:")
        missing_fields = []
        for field in required_fields:
            if field in service_account_data:
                if field == 'private_key':
                    # Don't show the actual private key
                    print(f"✅ {field}: Present ({len(service_account_data[field])} chars)")
                else:
                    print(f"✅ {field}: {service_account_data[field]}")
            else:
                print(f"❌ {field}: MISSING")
                missing_fields.append(field)
        
        # Check type field specifically
        if 'type' in service_account_data:
            if service_account_data['type'] == 'service_account':
                print("✅ Type field is correct: 'service_account'")
            else:
                print(f"❌ Type field is wrong: '{service_account_data['type']}' (should be 'service_account')")
        else:
            print("❌ Type field is missing!")
        
        if missing_fields:
            print(f"\n❌ Missing fields: {missing_fields}")
        else:
            print("\n✅ All required fields present")
            
        return service_account_data
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing failed: {e}")
        print("   This might be a formatting issue")
        
        # Show problematic area
        try:
            lines = firebase_key.split('\n')
            print(f"   Total lines: {len(lines)}")
            if len(lines) > 1:
                print("   First line:", repr(lines[0]))
                print("   Last line:", repr(lines[-1]))
        except:
            pass
            
        return None
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return None

def generate_fix_instructions(service_account_data):
    """Generate instructions to fix the credentials"""
    
    print("\n4. 🔧 FIX INSTRUCTIONS:")
    
    if not service_account_data:
        print("""
To fix this issue:

1. Go to Firebase Console (https://console.firebase.google.com)
2. Select your project
3. Go to Project Settings (gear icon) > Service Accounts
4. Click "Generate new private key"
5. Download the JSON file
6. Copy the ENTIRE contents of that JSON file
7. Set it as your FIREBASE_SERVICE_ACCOUNT_KEY environment variable

The JSON should look like this:
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
        """)
    else:
        if service_account_data.get('type') != 'service_account':
            print("❌ The 'type' field is wrong or missing")
            print("   It should be: \"type\": \"service_account\"")
        
        # Check if private key format is correct
        private_key = service_account_data.get('private_key', '')
        if private_key and not private_key.startswith('-----BEGIN PRIVATE KEY-----'):
            print("❌ Private key format looks wrong")
            print("   It should start with: -----BEGIN PRIVATE KEY-----")

def test_firebase_connection():
    """Test if Firebase connection works after diagnosis"""
    
    firebase_key = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')
    if not firebase_key:
        return
    
    print("\n5. 🔥 FIREBASE CONNECTION TEST:")
    
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        service_account_info = json.loads(firebase_key)
        cred = credentials.Certificate(service_account_info)
        
        # Initialize if not already done
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        # Test query
        test_query = db.collection('users').limit(1).get()
        print("✅ Firebase connection test PASSED")
        print(f"   Successfully connected to project: {service_account_info.get('project_id', 'unknown')}")
        
    except ImportError:
        print("⚠️ Firebase Admin SDK not installed")
        print("   Run: pip install firebase-admin")
    except Exception as e:
        print(f"❌ Firebase connection test FAILED: {e}")

def main():
    """Main diagnostic function"""
    
    service_account_data = diagnose_firebase_credentials()
    generate_fix_instructions(service_account_data)
    test_firebase_connection()
    
    print("\n" + "=" * 50)
    print("🏁 DIAGNOSTIC COMPLETE")

if __name__ == "__main__":
    main()
