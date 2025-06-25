import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { Apiresponse } from "../utils/apiResponse.js";
import { User }  from "../models/user-model.js";
import { uploadCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async(req, res)=>{
    const {username, fullname, email, password}= req.body;

    if([username, email, fullname, password].some((field)=> field?.trim === "")){
        //for checking the validation of all fields if empty throws error
        throw new ApiError(400, "All fields are required!");
    }

    const existedUser = await User.findOne({
        $or: [username, email]    //to check the all fields
    })

    if(existedUser){
        throw new ApiError(409, "User with username or email already exists");
    }

    //extract the localpath of the files uploaded using multer
    const avatarlocalPath =  req.files?.avatar[0]?.path;
    const coverImagelocalPath = req.files?.coverImage[0]?.path;

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

    //sending client the response id the user is created.
    res.status(201).json(
        new Apiresponse(
            200, 
            createdUser,
            "user registered successfully!!!"
        )
    )

})

export {registerUser}