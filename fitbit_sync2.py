

#!/usr/bin/env python3
"""
Quick Token Status Checker
Run this to immediately check if tokens are expired
"""

import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

def check_token_status():
    """Quick check of all user token status"""
    
    # Initialize Firebase
    try:
        service_account_info = json.loads(os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY', '{}'))
        cred = credentials.Certificate(service_account_info)
        
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        # Get all Fitbit users
        users_ref = db.collection('users')
        query = users_ref.where('selectedDevice', '==', 'fitbit').where('deviceConnected', '==', True)
        docs = query.stream()
        
        now = datetime.now(timezone.utc)
        
        print("🔍 TOKEN STATUS REPORT")
        print("=" * 50)
        
        for doc in docs:
            user_data = doc.to_dict()
            email = user_data.get('email', 'unknown')
            fitbit_data = user_data.get('fitbitData', {})
            
            print(f"\n👤 {email}:")
            
            # Check access token
            access_token = fitbit_data.get('accessToken')
            print(f"   Access Token: {'✅ Present' if access_token else '❌ Missing'}")
            
            # Check refresh token
            refresh_token = fitbit_data.get('refreshToken')
            print(f"   Refresh Token: {'✅ Present' if refresh_token else '❌ Missing'}")
            
            # Check expiration
            token_expires_at = fitbit_data.get('tokenExpiresAt')
            if token_expires_at:
                try:
                    expires_dt = datetime.fromisoformat(token_expires_at.replace('Z', '+00:00'))
                    time_until_expiry = expires_dt - now
                    
                    if time_until_expiry.total_seconds() > 0:
                        hours_left = time_until_expiry.total_seconds() / 3600
                        print(f"   Expires In: ✅ {hours_left:.1f} hours")
                    else:
                        hours_ago = abs(time_until_expiry.total_seconds()) / 3600
                        print(f"   Expires In: ❌ EXPIRED {hours_ago:.1f} hours ago")
                        
                except Exception as e:
                    print(f"   Expires In: ❌ Invalid format - {e}")
            else:
                print("   Expires In: ❌ Not set")
            
            # Check last successful sync
            last_sync = user_data.get('lastDataSync')
            if last_sync:
                try:
                    sync_dt = datetime.fromisoformat(last_sync.replace('Z', '+00:00'))
                    time_since = now - sync_dt
                    days_ago = time_since.days
                    hours_ago = time_since.seconds / 3600
                    
                    if days_ago > 0:
                        print(f"   Last Sync: ⚠️ {days_ago} days ago")
                    elif hours_ago > 2:
                        print(f"   Last Sync: ⚠️ {hours_ago:.1f} hours ago")
                    else:
                        print(f"   Last Sync: ✅ {hours_ago:.1f} hours ago")
                        
                except Exception as e:
                    print(f"   Last Sync: ❌ Invalid format - {e}")
            else:
                print("   Last Sync: ❌ Never")
        
        print("\n" + "=" * 50)
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_token_status()
