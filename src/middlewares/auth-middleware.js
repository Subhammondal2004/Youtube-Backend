import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user-model.js";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyJwt = asyncHandler(async(req, _, next)=>{
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","");

        if(!token){
            throw new ApiError(401, "Unauthorized request!!")
        }

        const decordedInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decordedInfo._id).select("-password -refreshToken");

        if(!user){
            throw new ApiError(400, "Invaild access Token")
        }

        req.user = user
        next()

    } catch (error) {
        throw new ApiError(401, error?.message || "Invaild access token" )
    }
})