import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import  Apiresponse from "../utils/apiResponse.js";
import { User }  from "../models/user-model.js";
import { uploadCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

//method to generate tokens 
const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })  //just save the current values without any validations 

        return { accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Internal error while generating Access and Refresh Tokens")
    }
}

const registerUser = asyncHandler(async(req, res)=>{
    const {username, fullname, email, password}= req.body;

    if([username, email, fullname, password].some((field)=> field?.trim === "")){
        //for checking the validation of all fields if empty throws error
        throw new ApiError(400, "All fields are required!");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]    //to check the all fields
    })

    if(existedUser){
        throw new ApiError(409, "User with username or email already exists");
    }
  
    //extract the localpath of the files uploaded using multer
    const avatarlocalPath =  req.files?.avatar[0]?.path;
    // const coverImagelocalPath = req.files?.coverImage[0]?.path;

    let coverImagelocalPath ;
    if(req.files?.coverImage && req.files?.coverImage.length > 0){
        coverImagelocalPath = req.files.coverImage[0].path;
    }

    //checking if the avatar is uploaded or not
    if(!avatarlocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    //uploading the image files through coludinary(a 3rd party app to store image, pdf, video etc..)
    const avatarres =  await uploadCloudinary(avatarlocalPath)
    const coverImageres = await uploadCloudinary(coverImagelocalPath)

    //checking if the avatar is uploaded in the cloudinary or not
    if(!avatarres){
        throw new ApiError(400, "Avatar is required")
    }

    //creating a new user to our database
    const user = await User.create({
        username: username.toLowerCase(),
        avatar: avatarres.url,
        email,
        password,
        coverImage: coverImageres?.url || "",
        fullname
    })

    //checking if the user is created or not, if created then remove the password and refreshToken fields
    const createdUser =  await User.findById(user._id).select( "-password -refreshToken")

    //if user not created then sending an error from server to client
    if(!createdUser){
        throw new ApiError(500, "Something went wrong in server while registering the user")
    }

    //sending client the response if the user is created.
    res.status(201).json(
        new Apiresponse(
            200, 
            createdUser,
            "user registered successfully!!!"
        )
    )

})

const loginUser = asyncHandler(async(req, res)=>{
    const {email, username, password} = req.body;

    //check whether the username or email is given or not
    if(!username && !email){
        throw new ApiError(400, "username or email is required!");
    }

    //if given username or email then find in the databasa
    const exitUser = await User.findOne({
        $or: [{ username },{ email }]
    })

    //if user doesnot exist throws error to client
    if(!exitUser){
        throw new ApiError(400, "user dosenot exists, please register!!!!")
    }

    //check if the password matches or not
    const isPasswordValid = await exitUser.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invaild user credentials!!!!")
    }

    //getting tokens from the method call and destructuring both
    const {accessToken, refreshToken} =  await generateAccessAndRefreshTokens(exitUser._id);

    //when findOne operation is used all the quary were included so again updating the user
    const loggedInUser = await User.findById(exitUser._id).select("-password -refreshToken");

    //using this, the cookies can only be modified by server, and cannot be modified from frontend.
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new Apiresponse(
            200,
            {
                exitUser: loggedInUser, accessToken, refreshToken
            },
            "User loggedIn successfully!!!"
        )
    )

})

const logoutUser = asyncHandler( async(req, res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new : true     //return response with new updated value
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new Apiresponse(200, {}, "User logged out successfully!!!")
    )
})

const refreshAccessToken = asyncHandler( async(req, res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken; 

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorised request")
    }

    try {
        const decordedInfo = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decordedInfo._id)
    
        if(!user){
            throw new ApiError(401, "Invalid credentials!!")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used!!")
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
    
        const options = {
            httpOnly : true,
            secure: true
        }
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new Apiresponse(
                200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access token refreshed!!!"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
}) 

const changeCurrentPassword = asyncHandler(async(req, res)=>{
    const {oldpassword, newpassword} = req.body;

    if(!oldpassword && !newpassword){
        throw new ApiError(400, "All fields are required!")
    }

    const user = await User.findById(req.user?._id)

    const isPassword = await user.isPasswordCorrect(oldpassword)

    if(!isPassword){
        throw new ApiError(401, "Invalid password")
    }

    user.password = newpassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new Apiresponse(
            200,
            {},
            "Password updated successfully!!!"
        )
    )
})

const getCurrentUser = asyncHandler(async(req, res)=>{
    const user = await User.findById(req.user?._id).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new Apiresponse(
            200,
            {
                user
            },
            "current user fetched successfully!!!"
        )
    )
})

const updateAccountDetails = asyncHandler(async(req, res)=>{
    const {fullname, email, username} = req.body;

    if(!(fullname || email || username)){
        throw new ApiError(400, "Fields are required to update the account!")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email,
                username
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new Apiresponse(
            200,
            {
                user
            },
            "Account details updated successfully!!!"
        )
    )

})

const updateAvatar = asyncHandler(async(req, res)=>{
    const avatarlocalPath = req.file?.path

    if(!avatarlocalPath){
        throw new ApiError(400, "Required avatar to update!")
    }

    const avatar = await uploadCloudinary(avatarlocalPath);

    if(!avatar?.url){
        throw new ApiError(500, "Internal server while uploading the avatar!")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new Apiresponse(
            200,
            { 
                user
            },
            "Avatar updated successfully!!!"
        )
    )
})

const updatecoverImage = asyncHandler(async(req, res)=>{
    const coverImagelocalPath = req.file?.path

    if(!coverImagelocalPath){
        throw new ApiError(400, "Required cover image to update")
    }

    const coverImage = await uploadCloudinary(coverImagelocalPath)

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new Apiresponse(
            200,
            { 
                user
            },
            "CoverImage updated successfully!!!"
        )
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatar,
    updatecoverImage
}