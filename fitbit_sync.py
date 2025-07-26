#!/usr/bin/env python3
"""
Improved Fitbit Data Sync Script with Timezone Handling
Fetches Fitbit data for all users and stores as timeseries in Firestore
Designed to run every 15 minutes via GitHub Actions
"""

import os
import sys
import json
import logging
import asyncio
import aiohttp
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import firebase_admin
from firebase_admin import credentials, firestore
from concurrent.futures import ThreadPoolExecutor
import time
import pytz

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class ImprovedFitbitDataSync:
    def __init__(self):
        """Initialize Firebase and configuration"""
        self.db = None
        self.api_base_url = "https://6zfuwxqp01.execute-api.us-east-1.amazonaws.com/dev"
        self.session = None
        self.initialize_firebase()
    
    def initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Initialize Firebase Admin SDK
            service_account_info = json.loads(os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY', '{}'))
            
            if not service_account_info:
                cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                else:
                    raise ValueError("Firebase credentials not found")
            else:
                cred = credentials.Certificate(service_account_info)
            
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            
            self.db = firestore.client()
            logger.info("✅ Firebase initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Firebase: {e}")
            raise
    
    async def create_session(self):
        """Create aiohttp session for API calls with retry configuration"""
        connector = aiohttp.TCPConnector(
            limit=10, 
            limit_per_host=5,
            ttl_dns_cache=300,
            use_dns_cache=True
        )
        timeout = aiohttp.ClientTimeout(total=60, connect=30)
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
    
    async def refresh_fitbit_token_with_retry(self, refresh_token: str, max_retries: int = 3) -> Optional[Dict[str, Any]]:
        """Refresh Fitbit access token with exponential backoff retry"""
        for attempt in range(max_retries):
            try:
                logger.debug(f"🔄 Refreshing token (attempt {attempt + 1}/{max_retries})...")
                
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
                            'tokenExpiresAt': (datetime.now(timezone.utc) + timedelta(seconds=token_data['expires_in'])).isoformat(),
                            'tokenType': token_data.get('token_type', 'Bearer')
                        }
                    elif response.status == 429:  # Rate limited
                        retry_after = int(response.headers.get('Retry-After', 60))
                        logger.warning(f"⚠️ Rate limited, waiting {retry_after} seconds...")
                        await asyncio.sleep(retry_after)
                        continue
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Token refresh failed ({response.status}): {error_text}")
                        
                        if response.status == 401:  # Invalid refresh token
                            return None
                        
                        # Wait before retry for other errors
                        if attempt < max_retries - 1:
                            wait_time = (2 ** attempt) * 5  # Exponential backoff
                            logger.info(f"⏳ Waiting {wait_time}s before retry...")
                            await asyncio.sleep(wait_time)
                            
            except Exception as e:
                logger.error(f"❌ Error refreshing token (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 5
                    await asyncio.sleep(wait_time)
                
        return None
    
    async def fetch_fitbit_data_with_retry(self, access_token: str, max_retries: int = 3) -> Optional[Dict[str, Any]]:
        """Fetch Fitbit data with retry logic"""
        for attempt in range(max_retries):
            try:
                logger.debug(f"📡 Fetching Fitbit data (attempt {attempt + 1}/{max_retries})...")
                
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
                        
                        # Structure data with proper timezone handling
                        now_utc = datetime.now(timezone.utc)
                        
                        return {
                            'heartRate': data.get('heartRate'),
                            'steps': data.get('steps', 0),
                            'calories': data.get('calories', 0),
                            'distance': data.get('distance', 0),
                            'activeMinutes': data.get('activeMinutes', 0),
                            'sleep': data.get('sleep'),
                            'weight': data.get('weight'),
                            'date': data.get('date', now_utc.date().isoformat()),
                            'timestamp': now_utc.isoformat(),
                            'dataSource': 'fitbit_api',
                            'syncedAt': now_utc.isoformat(),
                            'timezoneOffset': 0,  # Data is in UTC
                            'syncVersion': '2.0'  # Version for tracking improvements
                        }
                        
                    elif response.status == 401:
                        logger.warning("🔑 Access token expired, needs refresh")
                        return None
                    elif response.status == 429:  # Rate limited
                        retry_after = int(response.headers.get('Retry-After', 300))
                        logger.warning(f"⚠️ Rate limited, waiting {retry_after} seconds...")
                        await asyncio.sleep(retry_after)
                        continue
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ API request failed ({response.status}): {error_text}")
                        
                        if attempt < max_retries - 1:
                            wait_time = (2 ** attempt) * 10
                            await asyncio.sleep(wait_time)
                            
            except Exception as e:
                logger.error(f"❌ Error fetching Fitbit data (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 10
                    await asyncio.sleep(wait_time)
                    
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
        """Save Fitbit data to timeseries collection with improved document ID format"""
        try:
            # Use UTC timestamp for consistent document IDs
            timestamp_utc = datetime.now(timezone.utc)
            
            # Format: userId_YYYYMMDD_HHMMSS_microseconds
            # This ensures uniqueness and proper sorting
            doc_id = f"{user_uid}_{timestamp_utc.strftime('%Y%m%d_%H%M%S')}_{timestamp_utc.microsecond:06d}"
            
            timeseries_data = {
                'userId': user_uid,
                'timestamp': timestamp_utc.isoformat(),
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
                'syncVersion': fitbit_data.get('syncVersion', '2.0'),
                'timezoneOffset': fitbit_data.get('timezoneOffset', 0),
                'createdAt': timestamp_utc.isoformat()
            }
            
            # Save to timeseries collection
            self.db.collection('fitbit_timeseries').document(doc_id).set(timeseries_data)
            
            # Also update user's latest data
            self.db.collection('users').document(user_uid).update({
                'latestFitbitData': fitbit_data,
                'lastDataSync': timestamp_utc.isoformat(),
                'lastUpdated': timestamp_utc.isoformat()
            })
            
            logger.debug(f"✅ Saved timeseries data for user {user_uid} with doc ID: {doc_id}")
            
        except Exception as e:
            logger.error(f"❌ Error saving timeseries data for user {user_uid}: {e}")
    
    async def process_user(self, user: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single user's Fitbit data with improved error handling"""
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
            
            # Check if token needs proactive refresh (refresh 1 hour before expiry)
            token_expires_at = fitbit_data.get('tokenExpiresAt')
            needs_refresh = False
            
            if token_expires_at:
                try:
                    expires_time = datetime.fromisoformat(token_expires_at.replace('Z', '+00:00'))
                    time_until_expiry = expires_time - datetime.now(timezone.utc)
                    needs_refresh = time_until_expiry.total_seconds() < 3600  # 1 hour
                    
                    if needs_refresh:
                        logger.info(f"🔑 Token expires in {time_until_expiry}, refreshing proactively for {email}")
                except Exception as date_error:
                    logger.warning(f"⚠️ Could not parse token expiry for {email}: {date_error}")
                    needs_refresh = True
            
            current_access_token = access_token
            
            # Refresh token if needed
            if needs_refresh and refresh_token:
                new_token_data = await self.refresh_fitbit_token_with_retry(refresh_token)
                
                if new_token_data:
                    self.update_user_tokens(user_uid, new_token_data)
                    current_access_token = new_token_data['accessToken']
                    logger.info(f"✅ Token refreshed for user {email}")
                else:
                    logger.error(f"❌ Failed to refresh token for user {email}")
                    return {'user': email, 'status': 'token_refresh_failed', 'error': 'Token refresh failed'}
            
            # Fetch data with current/refreshed token
            data = await self.fetch_fitbit_data_with_retry(current_access_token)
            
            # If data fetch failed due to token issues, try refresh one more time
            if data is None and refresh_token and not needs_refresh:
                logger.info(f"🔑 Data fetch failed, attempting token refresh for user {email}")
                new_token_data = await self.refresh_fitbit_token_with_retry(refresh_token)
                
                if new_token_data:
                    self.update_user_tokens(user_uid, new_token_data)
                    data = await self.fetch_fitbit_data_with_retry(new_token_data['accessToken'])
            
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
                        'heartRate': data.get('heartRate'),
                        'syncVersion': data.get('syncVersion')
                    }
                }
            else:
                logger.error(f"❌ No data retrieved for user {email}")
                return {'user': email, 'status': 'no_data', 'error': 'No data retrieved after retries'}
                
        except Exception as e:
            logger.error(f"❌ Error processing user {email}: {e}")
            return {'user': email, 'status': 'error', 'error': str(e)}
    
    async def sync_all_users(self):
        """Main method to sync all users' Fitbit data with improved concurrency control"""
        start_time = time.time()
        logger.info("🚀 Starting improved Fitbit data sync for all users...")
        
        try:
            # Get all Fitbit users
            users = self.get_all_fitbit_users()
            
            if not users:
                logger.warning("⚠️ No Fitbit users found")
                return
            
            # Create HTTP session
            await self.create_session()
            
            # Process users with controlled concurrency to avoid rate limits
            semaphore = asyncio.Semaphore(3)  # Reduced from 5 to be more conservative
            
            async def process_with_semaphore_and_delay(user, delay):
                # Add small delay between requests to avoid rate limits
                await asyncio.sleep(delay)
                async with semaphore:
                    return await self.process_user(user)
            
            # Process all users with staggered delays
            tasks = []
            for i, user in enumerate(users):
                delay = i * 2  # 2 second delay between each user
                task = process_with_semaphore_and_delay(user, delay)
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Summarize results
            successful = sum(1 for r in results if isinstance(r, dict) and r.get('status') == 'success')
            failed = len(results) - successful
            
            elapsed_time = time.time() - start_time
            
            logger.info(f"📊 Improved sync completed in {elapsed_time:.2f}s")
            logger.info(f"✅ Successful: {successful}")
            logger.info(f"❌ Failed: {failed}")
            
            # Log details of failed users
            for result in results:
                if isinstance(result, dict) and result.get('status') != 'success':
                    logger.warning(f"Failed user: {result.get('user', 'unknown')} - {result.get('error', 'unknown error')}")
            
            # Save enhanced sync summary
            sync_summary = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'totalUsers': len(users),
                'successful': successful,
                'failed': failed,
                'duration': elapsed_time,
                'syncVersion': '2.0',
                'improvementsApplied': [
                    'proactive_token_refresh',
                    'exponential_backoff_retry',
                    'rate_limit_handling',
                    'timezone_aware_timestamps',
                    'improved_document_ids'
                ],
                'results': [r for r in results if isinstance(r, dict)]
            }
            
            self.db.collection('sync_logs').add(sync_summary)
            logger.info("📝 Enhanced sync summary saved to Firestore")
            
        except Exception as e:
            logger.error(f"❌ Critical error during sync: {e}")
            raise
        finally:
            await self.close_session()

def main():
    """Main entry point"""
    logger.info("🔄 Starting Improved Fitbit Data Sync Script v2.0")
    
    # Check required environment variables
    required_env = ['FIREBASE_SERVICE_ACCOUNT_KEY']
    missing_env = [env for env in required_env if not os.environ.get(env)]
    
    if missing_env:
        logger.error(f"❌ Missing required environment variables: {missing_env}")
        sys.exit(1)
    
    try:
        # Create improved sync instance and run
        sync = ImprovedFitbitDataSync()
        asyncio.run(sync.sync_all_users())
        logger.info("✅ Improved sync completed successfully")
        
    except KeyboardInterrupt:
        logger.info("🛑 Sync interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Sync failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
