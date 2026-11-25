// backend/user/src/controller/user.ts
import TryCatch from "../config/TryCatch.js";
import { generateToken } from "../config/generateToken.js";
import type { authenticatedRequest } from "../middleware/isAuth.js";
import cloudinary from "../config/cloudinary.js";
import { setCookies } from "../middleware/helper.js";
import { returnSafeUserData } from "../middleware/helper.js";


export const UpdateUser = TryCatch(async (req: authenticatedRequest, res) => {
    const userId = req.user?._id;
    const user = req.user;

    if (!user) return res.status(404).json({ message: "Please log in to update your profile" });
    if (!userId) return res.status(401).json({ message: "Please log in to update your profile" });

    const { name, username, phoneNumber } = req.body;

    if (!name || !username) return res.status(404).json({ message: "Name and username are required" });

    // check username has no space and special characters
    if (username.includes(" ")) return res.status(400).json({ message: "Username must not contain spaces" });
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/g;
    if (specialCharRegex.test(username)) return res.status(400).json({ message: "Username must not contain special characters" });

    try {

        // Update fields
        if (name) user.name = name.trim();
        if (username) user.username = username.toLowerCase().trim();
        if (phoneNumber) user.phoneNumber = phoneNumber.trim();

        const updatedUser = await user.save();
        const userData = returnSafeUserData(updatedUser);
        const token = generateToken(userData);

        // Update token in HTTP-only cookie
        setCookies(res, token);

        res.status(200).json({
            message: "Profile updated successfully",
            user: userData
        });
    } catch (error: any) {
        console.error("Error updating profile:", error);

        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            const fieldName = field === 'email' ? 'Email' :
                field === 'username' ? 'Username' :
                    field === 'phoneNumber' ? 'Phone number' : 'Field';
            return res.status(400).json({
                message: `${fieldName} already exists`
            });
        }

        res.status(500).json({
            message: "Failed : " + (error instanceof Error ? error.message : "Unknown error")
        });
    }
});

export const UpdateProfilePicture = TryCatch(async (req: authenticatedRequest, res) => {
    const userId = req.user?._id;
    const user = req?.user;
    const imageFile = req.file;

    if (!imageFile) return res.status(400).json({ message: "Please add an image file" });
    if (!userId || !user) return res.status(401).json({ message: "Please log in to update your profile picture" });

    try {
      
        const cloudinaryResponse = await cloudinary.uploader.upload(imageFile.path);

        // Update user profile picture URL
        user.avatar = cloudinaryResponse.secure_url;
        const updatedUser =  await user.save();

        res.status(200).json({
            message: "Profile picture updated successfully",
            user: returnSafeUserData(updatedUser)
        });
    } catch (error) {
        console.error("Error updating profile picture:", error);
        res.status(500).json({
            message: "Failed to update profile picture : " + (error instanceof Error ? error.message : "Unknown error")
        });
    }
});

export const deleteProfilePicture = TryCatch(async (req: authenticatedRequest, res) => {
    const userId = req.user?._id;
    const user = req?.user;

    if (!userId || !user) return res.status(401).json({ message: "Please log in to remove your profile picture" });
    if (!user?.avatar) return res.status(400).json({ message: "No profile picture to remove" });

    try {

        user.avatar = "";
        const updatedUser = await user?.save();

       return res.status(200).json({
            message: "Profile picture removed successfully",
            user: returnSafeUserData(updatedUser)
        });
    } catch (error) {
        console.error("Error removing profile picture:", error);
        return res.status(500).json({
            message: "Failed to remove profile picture : " + (error instanceof Error ? error.message : "Unknown error")
        });
    }
});

export const GetUserProfile = TryCatch(async (req: authenticatedRequest, res) => {

    if (!req.user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user: returnSafeUserData(req.user) });
});