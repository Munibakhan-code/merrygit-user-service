import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { publishToQueue } from '../config/rabbitmq.js';
import { PhoneVisibility, User } from "../model/User.js";
import { generateToken } from "../config/generateToken.js";
import type { authenticatedRequest } from "../middleware/isAuth.js";
import bcrypt from 'bcryptjs';
import { clearCookies, setCookies } from "../middleware/helper.js";
import { getLocationFromIP, getSafeUserData, parseDeviceInfo, returnSafeUserData } from "../middleware/helper.js";

export const RegisterUser = TryCatch(async (req, res) => {
    const { email, name, username, password, phoneNumber } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!name) return res.status(400).json({ message: "Name is required" });
    if (!username) return res.status(400).json({ message: "Username is required" });
    if (!password) return res.status(400).json({ message: "Password is required" });

    // check username has no space and special characters
    if (username.includes(" ")) return res.status(400).json({ message: "Username must not contain spaces" });
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/g;
    if (specialCharRegex.test(username)) return res.status(400).json({ message: "Username must not contain special characters" });

    // Get IP address from request
    const ipAddress = req.ip ||
        req.headers['x-forwarded-for']?.toString() ||
        req.socket.remoteAddress ||
        'unknown';

    const userAgent = req.headers['user-agent'] || '';

    const deviceInfo = parseDeviceInfo(userAgent);
    deviceInfo.ip = ipAddress;

    const location = getLocationFromIP(ipAddress);

    const timezone = req.headers['timezone']?.toString() || 'UTC';

    // Check for existing user with email or username
    const existingUserByEmail = await getSafeUserData({ email });
    if (existingUserByEmail) return res.status(400).json({ message: "User with this email already exists" });

    const existingUserByUsername = await getSafeUserData({ username });
    if (existingUserByUsername) return res.status(400).json({ message: "Username already taken" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user with all data
    try {
        const newUser = new User({
            email,
            name: name.trim(),
            username: username.toLowerCase().trim(),
            password: hashedPassword,
            phoneNumber: phoneNumber || null,
            phoneVisibility: phoneNumber ? PhoneVisibility.ONLY_ME : PhoneVisibility.ONLY_ME,
            isPhoneVerified: false,
            avatar: null,
            deactivatedByAdmin: false,
            isVerified: false,
            lastSeen: new Date(),
            timezone,
            location,
            ipAddress,
            deviceInfo,
            preferences: {
                theme: 'auto',
                language: req.headers['accept-language']?.split(',')[0] || 'en'
            },
            blockedUsers: []
        });

        const savedUser = await newUser.save();


        // Rate limiting for OTP
        const rateLimitKey = `otp:ratelimit:${email}`;
        const rateLimit = await redisClient.get(rateLimitKey);
        if (rateLimit) return res.status(429).json({ message: "Too many requests. Please try again later." });

        // Generate and store OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpKey = `otp:${email}`;

        await redisClient.set(otpKey, otp, { EX: 120 });
        await redisClient.set(rateLimitKey, "true", { EX: 120 });

        console.log(`OTP for ${email}: ${otp}`);

        const message = {
            to: email,
            subject: "Your OTP Code",
            text: `Your OTP code is ${otp}. It is valid for 2 minutes.`,
        }

        // Publish message to RabbitMQ queue
        await publishToQueue("send-otp", message);

        res.status(200).json({ message: "Registration successful. OTP sent to your email for verification." });

    } catch (error: any) {
        console.error("Error creating user:", error);

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                message: `${field === 'email' ? 'Email' : 'Username'} already exists`
            });
        }

        return res.status(500).json({
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

export const VerifyUser = TryCatch(async (req, res) => {
    const { email, otp: enteredOtp } = req.body;

    if (email == undefined || email == "" || enteredOtp == undefined || enteredOtp == "") return res.status(400).json({ message: "Email and OTP are required" });

    const otpKey = `otp:${email}`;
    const storedOtp = await redisClient.get(otpKey);

    if (!storedOtp || storedOtp !== enteredOtp) return res.status(400).json({ message: "Invalid or expired OTP" });

    await redisClient.del(otpKey);

    let user = await getSafeUserData({ email });

    // if user does not exist, create a new user
    if (!user) return res.status(404).json({ message: "User not found" });

    // mark user as verified
    user.isVerified = true;
    await user.save();

    const userData = returnSafeUserData(user);
    const token = generateToken(userData);
    setCookies(res, token);

    res.json({
        message: "User verified successfully",
        user: userData
    })
});

export const LoginUser = TryCatch(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });


    if (!user) return res.status(404).json({ message: "User not found" });
    if (user?.isVerified === false) return res.status(403).json({ message: "User is not verified" });
    if (user?.isActive === false) return res.status(403).json({ message: "User account is deactivated" });
    if (user?.deactivatedByAdmin === true) return res.status(403).json({ message: "User is deactivated because of some reasons" });

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) return res.status(401).json({ message: "Invalid credentials" });
    const userData = returnSafeUserData(user);
    const token = generateToken(userData);

    setCookies(res, token);

    res.json({
        message: "Login successful",
        userData
    });
});

export const LogoutUser = TryCatch(async (req: authenticatedRequest, res) => {
    // Clear the token cookie
    clearCookies(res);

    res.status(200).json({ message: "Logout successful" });
});
