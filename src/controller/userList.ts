// backend/user/src/controller/user.ts
import TryCatch from "../config/TryCatch.js";

import type { authenticatedRequest } from "../middleware/isAuth.js";
import { getSafeUserData } from "../middleware/helper.js";


// export const GetAllUsers = TryCatch(async (req: authenticatedRequest, res) => {
//     const userId = req.user?._id;

//     if (!userId) {
//         res.status(401).json({ message: "Please log in to view users" });
//         return;
//     }

//     // Get page and limit from query parameters with defaults
//     const page = parseInt(req.query.page as string) || 1;
//     const limit = parseInt(req.query.limit as string) || 10;
//     const skip = (page - 1) * limit;

//     // Validate pagination parameters
//     if (page < 1 || limit < 1 || limit > 100) {
//         res.status(400).json({
//             message: "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100"
//         });
//         return;
//     }

//     // Get total count for pagination info
//     const totalUsers = await User.countDocuments({ _id: { $ne: userId } });

//     // Get users with pagination
//     const users = await User.find({ _id: { $ne: userId } })
//         .select('-password -deactivatedByAdmin -isVerified -blockedUsers -friendRequests -updatedAt')
//         .skip(skip)
//         .limit(limit)
//         .sort({ createdAt: -1 }); // Optional: sort by creation date

//     // Calculate pagination metadata
//     const totalPages = Math.ceil(totalUsers / limit);
//     const hasNextPage = page < totalPages;
//     const hasPrevPage = page > 1;

//     res.status(200).json({
//         users,
//         pagination: {
//             currentPage: page,
//             totalPages,
//             totalUsers,
//             usersPerPage: limit,
//             hasNextPage,
//             hasPrevPage,
//             nextPage: hasNextPage ? page + 1 : null,
//             prevPage: hasPrevPage ? page - 1 : null
//         }
//     });
// });

export const GetUserById = TryCatch(async (req: authenticatedRequest, res) => {
    const { id } = req.params;
    const user = await getSafeUserData({ id: id as string })

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user });
});

export const GetUserByQuery = TryCatch(async (req: authenticatedRequest, res) => {
    const { email, username } = req.query;
    console.log("Query params:", req.query);
    let query = {};
    let paramType = '';

    if (email) {
        query = { email: email as string };
        paramType = 'email';
    } else {
        query = { username: username as string };
        paramType = 'username';
    }

    const user = await getSafeUserData(query)

    if (!user) return res.status(404).json({message: `No user found with this ${paramType}`});

    res.status(200).json({ user });
});