export interface ParsedUserAgent {
  deviceType: string;
  browser: string;
  os: string;
  deviceName?: string;
}

export function parseUserAgent(userAgent?: string): ParsedUserAgent {
  if (!userAgent) {
    return {
      deviceType: 'unknown',
      browser: 'unknown',
      os: 'unknown',
    };
  }

  const ua = userAgent.toLowerCase();

  // Detect device type
  let deviceType = 'desktop';
  if (ua.includes('mobile') || ua.includes('android')) {
    deviceType = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }

  // Detect browser
  let browser = 'unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera';
  } else if (ua.includes('msie') || ua.includes('trident')) {
    browser = 'Internet Explorer';
  }

  // Detect OS
  let os = 'unknown';
  if (ua.includes('windows')) {
    os = 'Windows';
    if (ua.includes('windows nt 10')) {
      os = 'Windows 10/11';
    } else if (ua.includes('windows nt 6.3')) {
      os = 'Windows 8.1';
    } else if (ua.includes('windows nt 6.2')) {
      os = 'Windows 8';
    } else if (ua.includes('windows nt 6.1')) {
      os = 'Windows 7';
    }
  } else if (ua.includes('mac os x') || ua.includes('macintosh')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
    // Try to extract Android version
    const androidMatch = ua.match(/android\s([0-9\.]*)/);
    if (androidMatch) {
      os = `Android ${androidMatch[1]}`;
    }
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
    // Try to extract iOS version
    const iosMatch = ua.match(/os\s([0-9_]*)/);
    if (iosMatch) {
      os = `iOS ${iosMatch[1].replace(/_/g, '.')}`;
    }
  }

  // Detect device name (for mobile devices)
  let deviceName: string | undefined;
  if (ua.includes('iphone')) {
    deviceName = 'iPhone';
  } else if (ua.includes('ipad')) {
    deviceName = 'iPad';
  } else if (ua.includes('android')) {
    // Try to extract device model
    const modelMatch = ua.match(/android.*;\s([^)]+)\)/);
    if (modelMatch) {
      deviceName = modelMatch[1].trim();
    }
  }

  return {
    deviceType,
    browser,
    os,
    deviceName,
  };
}

