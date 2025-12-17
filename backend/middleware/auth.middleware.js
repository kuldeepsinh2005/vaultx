//auth.middleware.js
const ErrorResponse = require("../utils/errorResponse.js");
const { asyncHandler } = require("../utils/asyncHandler.js");
const jwt = require("jsonwebtoken");
const User = require("../models/User.model.js");

const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
        const token =
            req.cookies?.accessToken ||
            req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            return next(new ErrorResponse("Unauthorized request", 401));
        }

        const decodedToken = jwt.verify(
            token,
            process.env.ACCESS_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id)
            .select("-password -refreshToken");

        if (!user) {
            return next(new ErrorResponse("Invalid Access Token", 401));
        }

        req.user = user;
        next();
    } catch (error) {
        next(
            new ErrorResponse(
                error?.message || "Invalid access token",
                401
            )
        );
    }
});

module.exports = { verifyJWT };
