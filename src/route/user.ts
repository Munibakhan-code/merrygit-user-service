// backend/user/src/route/user.ts
import express from 'express';
import { deleteProfilePicture, GetUserProfile, UpdateProfilePicture, UpdateUser } from '../controller/userProfile.js';
import { isAuth } from '../middleware/isAuth.js';
import { upload } from '../middleware/multer.js';
import { LoginUser, LogoutUser, RegisterUser, VerifyUser } from '../controller/userAuth.js';
import { GetUserById, GetUserByQuery } from '../controller/userList.js';
import { ChangePassword, ForgotPassword, ResetPassword, VerifyResetToken } from '../controller/userPassword.js';

const router = express.Router();

// User authentication routes
router.post("/register", RegisterUser)
router.post("/verify", VerifyUser);
router.post("/login", LoginUser);
router.get("/logout", LogoutUser);

// Password reset routes
router.post("/forgot-password", ForgotPassword);
router.post("/verify-reset-otp", VerifyResetToken);
router.post("/reset-password", ResetPassword);
router.post("/change-password", isAuth, ChangePassword);

// User profile routes
router.put("/update", isAuth, UpdateUser)
router.put("/update-avatar", isAuth, upload.single('avatar'), UpdateProfilePicture)
router.delete("/update-avatar", isAuth, deleteProfilePicture)
router.get("/me", isAuth, GetUserProfile);


// User list routes
router.get("/search", isAuth, GetUserByQuery);
router.get("/:id", GetUserById);


export default router;