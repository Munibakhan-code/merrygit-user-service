// src/middleware/isAuth.ts
import type { Request } from "express";
import { User, type IUser } from "../model/User.js";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { getSafeUserData } from "./helper.js";

export interface authenticatedRequest extends Request {
    user?: IUser | null;
}

export const isAuth = async (req: authenticatedRequest, res: any, next: any) => {
    try {
        const authToken = req.cookies?.token;

        if (!authToken) return res.status(401).json({ message: "Unauthorized - No token provided" });

        const decodedValue = jwt.verify(authToken, process.env.JWT_SECRET as string) as JwtPayload;

        const user = await getSafeUserData({ id: decodedValue?.user?._id })

        if (!user) return res.status(401).json({ message: "Unauthorized user" });

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: "Unauthorized - jwt verification failed", error: (error as Error).message });
    }
}