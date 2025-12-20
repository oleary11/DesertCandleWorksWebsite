/**
 * USPS Tracking utilities using official USPS API (OAuth2)
 */

// Cache for OAuth token to avoid excessive token requests
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get OAuth2 access token for USPS API
 */
async function getAccessToken(): Promise<string | null> {
  const consumerKey = process.env.USPS_CONSUMER_KEY;
  const consumerSecret = process.env.USPS_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    console.warn('[USPS] Consumer Key/Secret not configured');
    return null;
  }

  // Return cached token if still valid
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  try {
    const response = await fetch('https://api.usps.com/oauth2/v3/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: consumerKey,
        client_secret: consumerSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[USPS OAuth] Token request failed:', errorText);
      return null;
    }

    const data = await response.json();

    // Cache token (typically expires in 3600 seconds, cache for 55 minutes to be safe)
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + 55 * 60 * 1000,
    };

    return data.access_token;
  } catch (error) {
    console.error('[USPS OAuth] Failed to get access token:', error);
    return null;
  }
}

/**
 * Check if a USPS package has been delivered using official USPS API
 * Requires USPS_CONSUMER_KEY and USPS_CONSUMER_SECRET environment variables
 */
export async function checkDeliveryStatus(trackingNumber: string): Promise<{
  delivered: boolean;
  status?: string;
  error?: string;
}> {
  // Get OAuth token
  const accessToken = await getAccessToken();

  // Fallback to web scraping if API credentials not configured
  if (!accessToken) {
    console.warn('[USPS] OAuth token not available, falling back to web scraping');
    return checkDeliveryStatusFallback(trackingNumber);
  }

  try {
    // Call USPS Tracking API
    const response = await fetch(
      `https://api.usps.com/tracking/v3/tracking/${trackingNumber}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[USPS API] Error for ${trackingNumber}:`, errorText);
      return {
        delivered: false,
        error: `API error: ${response.status}`
      };
    }

    const data = await response.json();

    // Parse tracking information
    const trackingEvents = data.trackingEvents || [];
    const latestEvent = trackingEvents[0];
    const eventType = latestEvent?.eventType || '';
    const eventDescription = latestEvent?.eventDescription || '';

    // Check if delivered
    const isDelivered =
      eventType?.toLowerCase() === 'delivered' ||
      eventDescription?.toLowerCase().includes('delivered');

    return {
      delivered: isDelivered,
      status: eventDescription || eventType || 'Unknown',
    };
  } catch (error) {
    console.error(`[USPS API] Failed to check tracking for ${trackingNumber}:`, error);
    return {
      delivered: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fallback method: Check delivery status by scraping USPS tracking page
 * Used when USPS_USER_ID is not configured
 */
async function checkDeliveryStatusFallback(trackingNumber: string): Promise<{
  delivered: boolean;
  status?: string;
  error?: string;
}> {
  try {
    const url = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return { delivered: false, error: 'Failed to fetch tracking info' };
    }

    const html = await response.text();

    // Check for delivery indicators in the HTML
    const deliveryIndicators = [
      /delivered/i,
      /your item was delivered/i,
      /your package was delivered/i,
      /status.*delivered/i,
    ];

    const isDelivered = deliveryIndicators.some(pattern => pattern.test(html));

    // Extract status text (simplified)
    let status = 'Unknown';
    const statusMatch = html.match(/<div class="[^"]*status[^"]*">([^<]+)<\/div>/i);
    if (statusMatch) {
      status = statusMatch[1].trim();
    }

    return {
      delivered: isDelivered,
      status,
    };
  } catch (error) {
    console.error(`[USPS Fallback] Failed to check tracking for ${trackingNumber}:`, error);
    return {
      delivered: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
