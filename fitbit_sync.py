#!/usr/bin/env python3
"""
Fitbit Data Sync Script
Fetches Fitbit data for all users and stores as timeseries in Firestore
Designed to run every 15 minutes via GitHub Actions
"""

import os
import sys
import json
import logging
import asyncio
import aiohttp
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import firebase_admin
from firebase_admin import credentials, firestore
from concurrent.futures import ThreadPoolExecutor
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class FitbitDataSync:
    def __init__(self):
        """Initialize Firebase and configuration"""
        self.db = None
        self.api_base_url = "https://6zfuwxqp01.execute-api.us-east-1.amazonaws.com/dev"
        self.session = None
        self.initialize_firebase()
    
    def initialize_firebase(self):
        """Initialize Firebase Admin SDK with multiple auth methods"""
        try:
            cred = None
            auth_method = "unknown"
            
            # Method 1: Workload Identity (GitHub Actions with organization)
            cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
            if cred_path and os.path.exists(cred_path):
                logger.info("🔑 Using Workload Identity credentials")
                cred = credentials.Certificate(cred_path)
                auth_method = "workload_identity"
            
            # Method 2: Service Account Key (Environment Variable - legacy)
            elif os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY'):
                logger.info("🔑 Using service account key from environment")
                try:
                    service_account_info = json.loads(os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY'))
                    cred = credentials.Certificate(service_account_info)
                    auth_method = "service_account_key"
                except Exception as e:
                    logger.warning(f"⚠️ Service account key invalid: {e}")
            
            # Method 3: Application Default Credentials (Local development)
            if cred is None:
                logger.info("🔑 Using Application Default Credentials")
                try:
                    # Try with explicit project first
                    project_id = os.environ.get('GOOGLE_CLOUD_PROJECT', 'long-covid-8f42d')
                    cred = credentials.ApplicationDefault()
                    auth_method = "application_default"
                except Exception as e:
                    logger.error(f"❌ Application Default Credentials failed: {e}")
                    logger.error("💡 This might be a quota project permission issue")
                    logger.error("💡 Try running without quota project or contact project admin")
                    raise ValueError("No valid Firebase credentials found")
            
            # Initialize Firebase with explicit project ID to avoid quota issues
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred, {
                    'projectId': 'long-covid-8f42d'
                })
            
            self.db = firestore.client()
            logger.info(f"✅ Firebase initialized successfully using {auth_method}")
            
            # Test the connection
            try:
                test_query = self.db.collection('users').limit(1).get()
                logger.info("✅ Firestore connection test passed")
            except Exception as e:
                logger.warning(f"⚠️ Firestore connection test failed: {e}")
                logger.warning("💡 This might still work for your specific operations")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Firebase: {e}")
            logger.error("💡 Solutions:")
            logger.error("   1. Run 'gcloud auth application-default login' for local development")
            logger.error("   2. Ask organization admin to grant you 'roles/serviceusage.serviceUsageConsumer'")
            logger.error("   3. Set up Workload Identity for GitHub Actions")
            raise
    async def create_session(self):
        """Create aiohttp session for API calls"""
        connector = aiohttp.TCPConnector(limit=20, limit_per_host=10)
        timeout = aiohttp.ClientTimeout(total=30)
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={'Content-Type': 'application/json'}
        )
    
    async def close_session(self):
        """Close aiohttp session"""
        if self.session:
            await self.session.close()
    
    def get_all_fitbit_users(self) -> List[Dict[str, Any]]:
        """Get all users who have Fitbit connected"""
        try:
            logger.info("🔍 Fetching all Fitbit users from Firestore...")
            
            users_ref = self.db.collection('users')
            
            # Query for users with Fitbit connected
            query = users_ref.where('selectedDevice', '==', 'fitbit').where('deviceConnected', '==', True)
            docs = query.stream()
            
            users = []
            for doc in docs:
                user_data = doc.to_dict()
                user_data['uid'] = doc.id
                
                # Check if user has valid Fitbit tokens
                fitbit_data = user_data.get('fitbitData', {})
                if fitbit_data.get('accessToken') or fitbit_data.get('authCode'):
                    users.append(user_data)
                    logger.debug(f"Found Fitbit user: {user_data.get('email', 'unknown')}")
            
            logger.info(f"✅ Found {len(users)} users with Fitbit connected")
            return users
            
        except Exception as e:
            logger.error(f"❌ Error fetching Fitbit users: {e}")
            return []
    
    async def refresh_fitbit_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """Refresh Fitbit access token using serverless API"""
        try:
            logger.debug("🔄 Refreshing Fitbit token...")
            
            async with self.session.post(
                f"{self.api_base_url}/refresh",
                json={"refresh_token": refresh_token}
            ) as response:
                
                if response.status == 200:
                    token_data = await response.json()
                    logger.debug("✅ Token refreshed successfully")
                    return {
                        'accessToken': token_data['access_token'],
                        'refreshToken': token_data['refresh_token'],
                        'expiresIn': token_data['expires_in'],
                        'tokenExpiresAt': datetime.now(timezone.utc).isoformat(),
                        'tokenType': token_data.get('token_type', 'Bearer')
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Token refresh failed ({response.status}): {error_text}")
                    return None
                    
        except Exception as e:
            logger.error(f"❌ Error refreshing token: {e}")
            return None
    
    async def fetch_fitbit_data(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Fetch Fitbit data using serverless API"""
        try:
            logger.debug("📡 Fetching Fitbit data from serverless API...")
            
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            async with self.session.get(
                f"{self.api_base_url}/fitbit",
                headers=headers
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    logger.debug("✅ Fitbit data fetched successfully")
                    
                    # Structure the data consistently
                    return {
                        'heartRate': data.get('heartRate'),
                        'steps': data.get('steps', 0),
                        'calories': data.get('calories', 0),
                        'distance': data.get('distance', 0),
                        'activeMinutes': data.get('activeMinutes', 0),
                        'sleep': data.get('sleep'),
                        'weight': data.get('weight'),
                        'date': data.get('date', datetime.now(timezone.utc).date().isoformat()),
                        'timestamp': datetime.now(timezone.utc).isoformat(),
                        'dataSource': 'fitbit_api',
                        'syncedAt': datetime.now(timezone.utc).isoformat()
                    }
                    
                elif response.status == 401:
                    logger.warning("🔑 Access token expired, needs refresh")
                    return None
                else:
                    error_text = await response.text()
                    logger.error(f"❌ API request failed ({response.status}): {error_text}")
                    return None
                    
        except Exception as e:
            logger.error(f"❌ Error fetching Fitbit data: {e}")
            return None
    
    def update_user_tokens(self, user_uid: str, token_data: Dict[str, Any]):
        """Update user's Fitbit tokens in Firestore"""
        try:
            user_ref = self.db.collection('users').document(user_uid)
            user_ref.update({
                'fitbitData.accessToken': token_data['accessToken'],
                'fitbitData.refreshToken': token_data['refreshToken'],
                'fitbitData.tokenExpiresAt': token_data['tokenExpiresAt'],
                'fitbitData.tokenType': token_data['tokenType'],
                'lastUpdated': datetime.now(timezone.utc).isoformat()
            })
            logger.debug(f"✅ Updated tokens for user {user_uid}")
            
        except Exception as e:
            logger.error(f"❌ Error updating user tokens: {e}")
    
    def save_timeseries_data(self, user_uid: str, fitbit_data: Dict[str, Any]):
        """Save Fitbit data to timeseries collection"""
        try:
            # Create timeseries document
            timestamp = datetime.now(timezone.utc)
            doc_id = f"{user_uid}_{timestamp.strftime('%Y%m%d_%H%M%S')}"
            
            timeseries_data = {
                'userId': user_uid,
                'timestamp': timestamp.isoformat(),
                'date': fitbit_data['date'],
                'metrics': {
                    'heartRate': fitbit_data.get('heartRate'),
                    'steps': fitbit_data.get('steps', 0),
                    'calories': fitbit_data.get('calories', 0),
                    'distance': fitbit_data.get('distance', 0),
                    'activeMinutes': fitbit_data.get('activeMinutes', 0)
                },
                'sleep': fitbit_data.get('sleep'),
                'weight': fitbit_data.get('weight'),
                'dataSource': fitbit_data.get('dataSource', 'fitbit_api'),
                'syncedAt': fitbit_data.get('syncedAt'),
                'createdAt': timestamp.isoformat()
            }
            
            # Save to timeseries collection
            self.db.collection('fitbit_timeseries').document(doc_id).set(timeseries_data)
            
            # Also update user's latest data
            self.db.collection('users').document(user_uid).update({
                'latestFitbitData': fitbit_data,
                'lastDataSync': timestamp.isoformat(),
                'lastUpdated': timestamp.isoformat()
            })
            
            logger.debug(f"✅ Saved timeseries data for user {user_uid}")
            
        except Exception as e:
            logger.error(f"❌ Error saving timeseries data for user {user_uid}: {e}")
    
    async def process_user(self, user: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single user's Fitbit data"""
        user_uid = user['uid']
        email = user.get('email', 'unknown')
        
        try:
            logger.info(f"🔄 Processing user: {email}")
            
            fitbit_data = user.get('fitbitData', {})
            access_token = fitbit_data.get('accessToken')
            refresh_token = fitbit_data.get('refreshToken')
            
            if not access_token:
                logger.warning(f"⚠️ No access token for user {email}")
                return {'user': email, 'status': 'no_token', 'error': 'No access token'}
            
            # Try to fetch data with current token
            data = await self.fetch_fitbit_data(access_token)
            
            # If token expired, try to refresh
            if data is None and refresh_token:
                logger.info(f"🔑 Refreshing token for user {email}")
                new_token_data = await self.refresh_fitbit_token(refresh_token)
                
                if new_token_data:
                    # Update tokens in database
                    self.update_user_tokens(user_uid, new_token_data)
                    
                    # Try fetching data again with new token
                    data = await self.fetch_fitbit_data(new_token_data['accessToken'])
                
                if data is None:
                    logger.error(f"❌ Failed to fetch data for user {email} even after token refresh")
                    return {'user': email, 'status': 'failed', 'error': 'Token refresh failed'}
            
            if data:
                # Save to timeseries
                self.save_timeseries_data(user_uid, data)
                logger.info(f"✅ Successfully processed user {email}")
                return {
                    'user': email, 
                    'status': 'success', 
                    'data': {
                        'steps': data.get('steps', 0),
                        'calories': data.get('calories', 0),
                        'heartRate': data.get('heartRate')
                    }
                }
            else:
                logger.error(f"❌ No data retrieved for user {email}")
                return {'user': email, 'status': 'no_data', 'error': 'No data retrieved'}
                
        except Exception as e:
            logger.error(f"❌ Error processing user {email}: {e}")
            return {'user': email, 'status': 'error', 'error': str(e)}
    
    async def sync_all_users(self):
        """Main method to sync all users' Fitbit data"""
        start_time = time.time()
        logger.info("🚀 Starting Fitbit data sync for all users...")
        
        try:
            # Get all Fitbit users
            users = self.get_all_fitbit_users()
            
            if not users:
                logger.warning("⚠️ No Fitbit users found")
                return
            
            # Create HTTP session
            await self.create_session()
            
            # Process users concurrently (but with reasonable limits)
            semaphore = asyncio.Semaphore(5)  # Limit concurrent requests
            
            async def process_with_semaphore(user):
                async with semaphore:
                    return await self.process_user(user)
            
            # Process all users
            results = await asyncio.gather(
                *[process_with_semaphore(user) for user in users],
                return_exceptions=True
            )
            
            # Summarize results
            successful = sum(1 for r in results if isinstance(r, dict) and r.get('status') == 'success')
            failed = len(results) - successful
            
            elapsed_time = time.time() - start_time
            
            logger.info(f"📊 Sync completed in {elapsed_time:.2f}s")
            logger.info(f"✅ Successful: {successful}")
            logger.info(f"❌ Failed: {failed}")
            
            # Log details of failed users
            for result in results:
                if isinstance(result, dict) and result.get('status') != 'success':
                    logger.warning(f"Failed user: {result.get('user', 'unknown')} - {result.get('error', 'unknown error')}")
            
            # Save sync summary to Firestore
            sync_summary = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'totalUsers': len(users),
                'successful': successful,
                'failed': failed,
                'duration': elapsed_time,
                'results': [r for r in results if isinstance(r, dict)]
            }
            
            self.db.collection('sync_logs').add(sync_summary)
            logger.info("📝 Sync summary saved to Firestore")
            
        except Exception as e:
            logger.error(f"❌ Critical error during sync: {e}")
            raise
        finally:
            await self.close_session()

def main():
    """Main entry point"""
    logger.info("🔄 Starting Fitbit Data Sync Script")
    
    # Check required environment variables
    required_env = ['FIREBASE_SERVICE_ACCOUNT_KEY']
    missing_env = [env for env in required_env if not os.environ.get(env)]
    
    if missing_env:
        logger.error(f"❌ Missing required environment variables: {missing_env}")
        sys.exit(1)
    
    try:
        # Create sync instance and run
        sync = FitbitDataSync()
        asyncio.run(sync.sync_all_users())
        logger.info("✅ Sync completed successfully")
        
    except KeyboardInterrupt:
        logger.info("🛑 Sync interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Sync failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
