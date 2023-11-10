export default {
  async fetch(request, env, ctx) {
		// Set CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*', // Allows all origins
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Adapts to your needs
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json', // Assuming the response will be JSON
    };

    // Handle OPTIONS request
    if (request.method === 'OPTIONS') {
      // Return a 200 response for preflight requests
      return new Response(null, {
        headers: headers,
        status: 200,
      });
    }
    // Get the values for username and password from environment variables
    const loginData = {
      username: env.UMAMI_API_CLIENT_USER_ID,
      password: env.UMAMI_API_CLIENT_PASSWORD,
    };

    try {
      // Send a POST request to the login API
      const loginResponse = await fetch(`${env.UMAMI_API_CLIENT_ENDPOINT}api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      // Check if the login request was successful
      if (!loginResponse.ok) {
        throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
      }

      // Save the response to apiAccess variable
      const apiAccess = await loginResponse.json();

      // Define the websiteId and base URL
      const websiteId = env.UMAMI_WEBSITE_ID;
      const baseUrl = env.UMAMI_API_CLIENT_ENDPOINT + 'api/websites';

			const startAt =  Date.now() - (7* 24 * 60 * 60 * 1000);
			const endAt = Date.now()
      // An array of endpoint paths to iterate over
      const endpoints = [
        '/active',
        `/events`,
        '/pageviews',
        // `/metrics`, // requires extra parameter, type: Metrics type (url | referrer | browser | os | device | country | event). Disabled for now.
        `/stats`
      ];
      // Function to fetch data from a given endpoint
      const fetchDataFromEndpoint = async (endpoint) => {
        try {
          const response = await fetch(`${baseUrl}/${websiteId}${endpoint}?startAt=${startAt}&endAt=${endAt}&unit=hour&timezone=Europe%2FLisbon`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiAccess.token}`, // Replace 'token' with the actual property name that holds the token
            },
          });

          if (!response.ok) {
            throw new Error(`Request for ${endpoint} failed: ${response.status} ${response.statusText}`);
          }

          return await response.json();
        } catch (error) {
          // Return an error message for this endpoint
          return { error: error.message };
        }
      };

      // Use Promise.all to fetch all endpoints data concurrently
      const results = await Promise.all(endpoints.map(fetchDataFromEndpoint));

      // Combine all results into a single object
      const combinedResults = endpoints.reduce((acc, endpoint, index) => {
        // Remove the leading slash and replace subsequent slashes for key naming
        const key = endpoint.substring(1).replace(/\//g, '_');
        acc[key] = results[index];
        return acc;
      }, {});

      // Return the combined results to the client
      return new Response(JSON.stringify(combinedResults), {
        headers: { ...headers,'Content-Type': 'application/json' },
        status: 200,
      });

    } catch (error) {
      // Handle any errors that occurred during the fetch
      console.error('Request failed:', error);

      // Return an error response to the client
      return new Response("Request failed", { status: 500 });
    }
  },
};