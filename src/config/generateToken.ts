import Jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET

export const generateToken = (user : any) => {
    return Jwt.sign({user}, JWT_SECRET!, { expiresIn: '7d' }); // Token valid for 7 days
} 

export const generateResetToken = (user : any) => {
    return Jwt.sign({user}, JWT_SECRET!, { expiresIn: '5m' }); // Token valid for 5 minutes
}