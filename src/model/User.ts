// src/model/User.ts
import mongoose, { Document, Schema } from "mongoose";
import validator from "validator";

export enum PhoneVisibility {
  ONLY_ME = "only_me",
  ONLY_FRIENDS = "only_friends",
  EVERYONE = "everyone"
}

export interface IDeviceInfo {
  userAgent: string;
  browser: string;
  os: string;
  deviceType: string;
  ip: string;
}

export interface IUser extends Document {
  name: string;
  username: string;
  email: string;
  password: string;
  phoneNumber?: string;
  phoneVisibility: PhoneVisibility;
  isPhoneVerified: boolean;
  avatar?: string;
  isActive: boolean;
  deactivatedByAdmin: boolean;
  isVerified: boolean;
  lastSeen: Date;
  timezone?: string;
  location?: {
    country?: string;
    city?: string;
    region?: string;
  };
  ipAddress: string;
  deviceInfo?: IDeviceInfo;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema({
  name: { 
    type: String, 
    required: [true, "Name is required"],
    trim: true,
    maxlength: [50, "Name cannot exceed 50 characters"]
  },
  username: { 
    type: String, 
    required: [true, "Username is required"],
    unique: [true, "Username already taken"],
    trim: true,
    lowercase: true,
    minlength: [5, "Username must be at least 5 characters"],
    maxlength: [20, "Username cannot exceed 20 characters"],
    match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"],
    index: true
  },
  email: { 
    type: String, 
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, "Please provide a valid email"],
    index: true
  },
  password: { 
    type: String, 
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"]
  },
  phoneNumber: {
    type: String,
    default: null,
    index: true,
    sparse: true
  },
  phoneVisibility: {
    type: String,
    enum: Object.values(PhoneVisibility),
    default: PhoneVisibility.ONLY_ME
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  avatar: { 
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  deactivatedByAdmin: { 
    type: Boolean, 
    default: false,
    index: true
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  lastSeen: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  timezone: {
    type: String,
    default: null
  },
  location: {
    country: { type: String, default: null },
    city: { type: String, default: null },
    region: { type: String, default: null }
  },
  ipAddress: {
    type: String,
    required: true
  },
  deviceInfo: {
    userAgent: { type: String, default: null },
    browser: { type: String, default: null },
    os: { type: String, default: null },
    deviceType: { type: String, default: null },
    ip: { type: String, default: null }
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
}, { 
  timestamps: true,
});

// Compound indexes for common queries
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
// UserSchema.index({ phoneNumber: 1, phoneVisibility: 1 });
// UserSchema.index({ deactivatedByAdmin: 1, lastSeen: -1 });
// UserSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>("User", UserSchema);