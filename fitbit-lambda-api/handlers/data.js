const https = require('https');

exports.handler = async (event) => {
    try {
        const { access_token, date } = event.queryStringParameters || {};
        
        if (!access_token) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
                },
                body: JSON.stringify({ error: 'Access token required' })
            };
        }

        const targetDate = date || new Date().toISOString().split('T')[0]; // Default to today
        
        // Fetch multiple data types in parallel
        const [caloriesData, stepsData, sleepData] = await Promise.all([
            fetchFitbitData(access_token, `activities/calories/date/${targetDate}/1d.json`),
            fetchFitbitData(access_token, `activities/steps/date/${targetDate}/1d.json`),
            fetchFitbitData(access_token, `sleep/date/${targetDate}.json`)
        ]);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
                date: targetDate,
                calories: caloriesData,
                steps: stepsData,
                sleep: sleepData
            })
        };
        
    } catch (error) {
        console.error('Data fetch error:', error);
        
        if (error.message.includes('401')) {
            return {
                statusCode: 401,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
                },
                body: JSON.stringify({ error: 'Unauthorized - token may be expired' })
            };
        }
        
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({ error: 'Failed to fetch Fitbit data' })
        };
    }
};

async function fetchFitbitData(accessToken, endpoint) {
    const options = {
        hostname: 'api.fitbit.com',
        port: 443,
        path: `/1/user/-/${endpoint}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(response);
                    } else {
                        reject(new Error(`${res.statusCode} - ${response.errors?.[0]?.message || 'API Error'}`));
                    }
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}