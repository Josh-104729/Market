/**
 * Get location information from IP address using a free geolocation API
 * Falls back gracefully if the service is unavailable
 */
export interface IPLocation {
  country?: string;
  city?: string;
  region?: string;
  location?: string; // Formatted location string
}

export async function getLocationFromIP(ipAddress?: string): Promise<IPLocation> {
  if (!ipAddress || ipAddress === 'unknown' || ipAddress === 'localhost' || ipAddress.startsWith('127.') || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.')) {
    return {};
  }

  try {
    // Using ip-api.com (free, no API key required, 45 requests/minute)
    // Alternative: ipapi.co, ipgeolocation.io, etc.
    const response = await fetch(`https://ip-api.com/json/${ipAddress}?fields=status,message,country,regionName,city`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'success') {
      const locationParts: string[] = [];
      if (data.city) locationParts.push(data.city);
      if (data.regionName) locationParts.push(data.regionName);
      if (data.country) locationParts.push(data.country);

      return {
        country: data.country,
        city: data.city,
        region: data.regionName,
        location: locationParts.length > 0 ? locationParts.join(', ') : undefined,
      };
    }

    return {};
  } catch (error) {
    // Silently fail - don't block login if geolocation fails
    console.warn('Failed to get location from IP:', error);
    return {};
  }
}

