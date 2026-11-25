import { UAParser } from "ua-parser-js";
import geoip from 'geoip-lite';
import { User } from "../model/User.js";


type SearchCriteria = {
  email?: string;
  id?: string;
  username?: string;
};

const safeUserProjection = {
  _id: 1,
  name: 1,
  username: 1,
  email: 1,
  phoneNumber: 1,
  phoneVisibility: 1,
  avatar: 1,
  lastSeen: 1,
  timezone: 1,
  createdAt: 1,
  updatedAt: 1,
  isVerified: 1,
};

// Fetch safe user data
export const getSafeUserData = async (criteria: SearchCriteria) => {
  try {
    const { email, id, username } = criteria;

    if (email) {
      return await User.findOne({ email }).select(safeUserProjection);
    }

    if (id) {
      return await User.findById(id).select(safeUserProjection);
    }

    if (username) {
      return await User.findOne({ username }).select(safeUserProjection);
    }

    return null;
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
};

export const returnSafeUserData = (user: any) => {
  return {
    _id: user?._id,
    name: user?.name,
    username: user?.username,
    email: user?.email,
    phoneNumber: user?.phoneNumber,
    phoneVisibility: user?.phoneVisibility,
    avatar: user?.avatar,
    lastSeen: user?.lastSeen,
    timezone: user?.timezone,
    createdAt: user?.createdAt,
    updatedAt: user?.updatedAt,
  };
};


export const parseDeviceInfo = (userAgent: string) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    userAgent,
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown',
    deviceType: result.device.type || 'desktop',
    ip: '' // Will be set from request
  };
};

// Helper function to get location from IP
export const getLocationFromIP = (ip: string) => {
  try {
    const geo = geoip.lookup(ip);
    if (geo) {
      return {
        country: geo.country || null,
        city: geo.city || null,
        region: geo.region || null
      };
    }
  } catch (error) {
    console.error('Error getting location from IP:', error);
  }
  return {
    country: null,
    city: null,
    region: null
  };
};



export const setCookies = (res: any, token: string, time = 7 * 24 * 60 * 60 * 1000) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';

    const cookieOptions: any = {
      httpOnly: true,
      maxAge: time,
      path: "/", // important for all services
    };

    if (isProduction) {
      cookieOptions.secure = true;          // HTTPS only
      cookieOptions.sameSite = "none";      // REQUIRED for cross-site
      cookieOptions.domain = ".merrygit.tech"; // SHARE across services
    } else {
      cookieOptions.secure = false;
      cookieOptions.sameSite = "lax";
    }

    res.cookie('token', token, cookieOptions);
    console.log("Cookies set successfully", cookieOptions);
  } catch (error) {
    console.error("Error setting cookies:", error);
  }
}

export const clearCookies = (res: any) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';

    const cookieOptions: any = {
      httpOnly: true,
      expires: new Date(0), // Set to past date to clear
      path: "/", // Must match the path from setCookies
    };

    if (isProduction) {
      cookieOptions.secure = true;          // HTTPS only
      cookieOptions.sameSite = "none";      // REQUIRED for cross-site
      cookieOptions.domain = ".merrygit.tech"; // SHARE across services
    } else {
      cookieOptions.secure = false;
      cookieOptions.sameSite = "lax";
    }

    // Clear the token cookie
    res.cookie('token', '', cookieOptions);
    console.log("Cookies cleared successfully", cookieOptions);
  } catch (error) {
    console.error("Error clearing cookies:", error);
  }
}

export const isValidObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};