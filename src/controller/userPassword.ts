// backend/user/src/controller/passwordController.ts
import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { publishToQueue } from '../config/rabbitmq.js';
import { returnSafeUserData } from "../middleware/helper.js";
import { generateResetToken, generateToken } from "../config/generateToken.js";
import type { authenticatedRequest } from "../middleware/isAuth.js";
import bcrypt from 'bcryptjs';
import { setCookies } from "../middleware/helper.js";
import { User } from "../model/User.js";
import jwt, { type JwtPayload } from "jsonwebtoken";


// Forgot Password - Generate OTP and send email
export const ForgotPassword = TryCatch(async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });

    // Check if user exists (use User model directly to get email)
    const user = await User.findOne({ email }).select('email _id');

    if (!user) return res.status(200).json({ message: "User not found" });

    const rateLimitKey = `password_otp:ratelimit:${email}`;
    const rateLimit = await redisClient.get(rateLimitKey);

    if (rateLimit) return res.status(429).json({ message: "Too many OTP requests. Please try again in 2 minutes." });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with 5-minute expiry
    const otpKey = `password_otp:${email}`;
    await redisClient.set(otpKey, otp, { EX: 300 }); // 5 minutes

    // Set rate limit (1 request every 2 minutes)
    await redisClient.set(rateLimitKey, "true", { EX: 120 });

    // Also store user ID for verification
    const userDataKey = `password_otp_user:${email}`;
    await redisClient.set(userDataKey, user._id!.toString(), { EX: 300 });

    console.log(`Password reset OTP for ${email}: ${otp}`);

    // Send OTP email via RabbitMQ
    const message = {
        to: email,
        subject: "Password Reset OTP",
        text: `Your password reset OTP is: ${otp}\n\nThis OTP is valid for 5 minutes.\n\nIf you didn't request this, please ignore this email.`
    };

    await publishToQueue("send-otp", message);

    res.status(200).json({ message: "OTP has been sent. OTP expires in 5 minutes." });
});

// Verify Reset OTP - Validate OTP and generate reset token
export const VerifyResetToken = TryCatch(async (req, res) => {
    const { email, otp: enteredOtp } = req.body;

    if (!email || !enteredOtp) return res.status(400).json({ message: "Email and OTP are required" });

    // Check OTP from Redis
    const otpKey = `password_otp:${email}`;
    const storedOtp = await redisClient.get(otpKey);

    if (!storedOtp) return res.status(400).json({ message: "OTP has expired. Please request a new one." });

    if (storedOtp !== enteredOtp) {
        // Increment failed attempts counter
        const failedAttemptsKey = `password_otp_failed:${email}`;
        const failedAttempts = await redisClient.incr(failedAttemptsKey);

        // Set expiry on first failed attempt
        if (failedAttempts === 1) {
            await redisClient.expire(failedAttemptsKey, 300); // 5 minutes
        }

        // Block after 3 failed attempts
        if (failedAttempts >= 3) {
            await redisClient.del(otpKey); // Clear OTP
            await redisClient.del(failedAttemptsKey);
            return res.status(429).json({
                message: "Too many failed attempts. OTP has been invalidated. Please request a new one."
            });
        }

        return res.status(400).json({ message: "Invalid OTP. You have " + (3 - failedAttempts) + " attempts remaining." });
    }

    // Get user ID from Redis
    const userDataKey = `password_otp_user:${email}`;
    const userId = await redisClient.get(userDataKey);

    if (!userId) return res.status(400).json({ message: "OTP verification failed. Please try again." });

    // Generate JWT reset token (valid for 5 minutes)
    const resetToken = generateResetToken({
        _id: userId,
        email: email,
        type: 'password_reset',
        otpVerified: true
    });

    // Store reset token in Redis for additional verification
    const resetTokenKey = `password_reset_token:${email}`;
    await redisClient.set(resetTokenKey, resetToken, { EX: 300 });

    // Clear OTP and failed attempts after successful verification
    await redisClient.del(otpKey);
    await redisClient.del(userDataKey);
    const failedAttemptsKey = `password_otp_failed:${email}`;
    await redisClient.del(failedAttemptsKey);

    // -----------------------------------------------------------------------   SET THIS ACCORDING TO DEPLOYMENT ENVIRONMENT -----------------------------------------------------------------------

    // res.cookie('reset_token', resetToken, {
    //     httpOnly: true,
    //     sameSite: 'none',
    //     secure: process.env.NODE_ENV === 'production',
    //     // domain: '.onrender.com',
    //     maxAge: 5 * 60 * 1000, // 5 minutes
    // });


    res.cookie("reset_token", resetToken, {
        httpOnly: true,
        secure: true,          
        sameSite: "none",      
        domain: ".merrygit.tech",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({ message: "OTP verified successfully" });
});

// Reset Password - Update password using verified reset token
export const ResetPassword = TryCatch(async (req, res) => {
    const { newPassword, confirmPassword } = req.body;
    const resetToken = req.cookies?.reset_token;

    if (!resetToken) return res.status(400).json({ message: "Reset token is required. Please verify OTP first." });
    if (!newPassword || !confirmPassword) return res.status(400).json({ message: "New password and confirmation are required" });
    if (newPassword !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });
    if (newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters long" });

    try {
        // Verify the JWT token
        const decoded = jwt.verify(resetToken, process.env.JWT_SECRET as string) as JwtPayload;

        if (!decoded || decoded?.user?.type !== 'password_reset' || !decoded?.user?.otpVerified) return res.status(400).json({ message: "Invalid or unverified reset token. Please verify OTP first." });

        // Additional verification: Check if token exists in Redis
        const email = decoded?.user?.email;
        const resetTokenKey = `password_reset_token:${email}`;
        const storedToken = await redisClient.get(resetTokenKey);

        if (!storedToken || storedToken !== resetToken) return res.status(400).json({ message: "Reset token has expired or is invalid. Please start the process again." });

        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: "User not found" });

        // Check if new password is same as old password
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) return res.status(400).json({ message: "New password must be different from your current password" });

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password
        user.password = hashedPassword;
        await user.save();

        // Clear all reset-related data from Redis
        await redisClient.del(resetTokenKey);
        await redisClient.del(`password_otp:${email}`);
        await redisClient.del(`password_otp_user:${email}`);
        await redisClient.del(`password_otp_failed:${email}`);
        await redisClient.del(`password_otp:ratelimit:${email}`);

        // Clear reset token cookies
        res.clearCookie('reset_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });

        // Send password changed email notification
        const message = {
            to: email,
            subject: "Password Changed Successfully",
            text: `Your password has been successfully reset.\n\nIf you didn't make this change, please contact support immediately. \n\n Contact email: info@merrygit.tech`
        };

        await publishToQueue("send-otp", message);

        res.status(200).json({ message: "Password has been reset successfully" });

    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            res.clearCookie('reset_token');

            return res.status(400).json({
                message: "Reset token has expired. Please start the process again."
            });
        }

        if (error.name === 'JsonWebTokenError') return res.status(400).json({ message: "Invalid reset token" });

        console.error("Error resetting password:", error);
        return res.status(500).json({ message: "Failed to reset password" });
    }
});

export const ChangePassword = TryCatch(async (req: authenticatedRequest, res) => {
    const userId = req.user?._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!userId) return res.status(401).json({ message: "Please log in to change password" });
    if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ message: "Current password, new password, and confirm password are required" });
    if (newPassword === currentPassword) return res.status(400).json({ message: "New password must be different from current password" });
    if (newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters long" });
    if (newPassword !== confirmPassword) return res.status(400).json({ message: "New password and confirm password do not match" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: "Current password is incorrect" });

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        await user.save();

        const message = {
            to: user.email,
            subject: "Password Changed Successfully",
            text: `Your password has been successfully changed.\n\nIf you didn't make this change, please contact support immediately. \n\n Contact email info@merrygit.tech`
        };

        await publishToQueue("send-otp", message);

        const userData = returnSafeUserData(user);
        const token = generateToken(userData);

        setCookies(res, token);

        res.status(200).json({ message: "Password changed successfully" });

    } catch (error: any) {
        console.error("Error changing password:", error);
        return res.status(500).json({
            message: "Failed to change password"
        });
    }
});