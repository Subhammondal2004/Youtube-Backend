import mongoose, {isValidObjectId} from "mongoose";
import { Video } from "../models/video-model.js";
import { User } from "../models/user-model.js";
import { ApiError } from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const publishVideo = asyncHandler(async(req, res)=>{
    const { title, description} = req.body;

    if([title, description].some((field)=>field?.trim === "")){
        throw new ApiError(400, "All fields are required")
    }

    const videolocalPath = req.files?.video[0]?.path;
    const thumbnaillocalPath = req.files?.thumbnail[0]?.path;

    if(!videolocalPath){
        throw new ApiError(400, "Video file is required!")
    }

    if(!thumbnaillocalPath){
        throw new ApiError(400, "Thumbnail is required!")
    }

    const videoupload = await uploadOnCloudinary(videolocalPath)
    const thumbnailupload = await uploadOnCloudinary(thumbnaillocalPath)

    if(!videoupload){
        throw new ApiError(400, "Video file not found")
    }

    if(!thumbnailupload){
        throw new ApiError(400, "Thumbnail not found")
    }

    const video = await Video.create({
        title,
        description,
        duration: videoupload.duration,
        video: videoupload?.url,
        thumbnail: thumbnailupload?.url,
        owner: req.user?._id,
        isPublished:false,
    })

    const videoUploaded = await Video.findById(video._id)

    if(!videoUploaded){
        throw new ApiError(500, "Internal server error while uploading video, try again!! ")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            videoUploaded,
            "Video uploaded successfully!!!"
        )
    )
});

const getVideoById = asyncHandler(async(req, res)=>{
    const { videoId } = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid videoId")
    }

    const video = await Video.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup:{
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            },
        },
        {
            $lookup:{
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "comments"
            }
        },
        {
            $lookup:{
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as:"owner",
                pipeline:[
                    {
                        $lookup:{
                            from: "subscriptions",
                            localField:"_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields:{
                            subscriberCount:{
                                $size : "$subscribers"
                            },
                            isSubscribed:{
                                $cond:{
                                    if:{
                                        $in:[req.user?._id, "$subscribers.subscriber"]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },{
                        $project:{
                            username: 1,
                            avatar: 1,
                            subscriberCount: 1,
                            isSubscribed: 1,
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                isLiked:{
                    $cond:{
                        if:{
                            $in:[req.user?._id, "likes.likedBy"]
                        },
                        then: true,
                        else: false
                    }
                },
                Commented:{
                    $cond:{
                        if:{
                            $in:[req.user?._id, "comment.owner"]
                        },
                        then: true,
                        else: false
                    }
                },
                likeCount:{
                    $size : "$likes"
                },
                commentCount:{
                    $size: "$comment"
                },
                owner:{
                    $first: "$owner"
                }
            }
        },
        {
            $project:{
                title: 1,
                description: 1,
                duration: 1,
                owner:1,
                isLiked: 1,
                likeCount: 1,
                views: 1,
                video: 1,
                thumbnail: 1,
                createdAt: 1,
                comments: 1,
                commentCount:1
            }
        }
    ])

    if(!video){
        throw new ApiError(500, "Failed to fetch video details")
    }

    //update views on the video
    await Video.findByIdAndUpdate(videoId,{
        $inc:{
            views: 1
        }
    })

    //update watchHistory of the user.
    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet:{
            watchHistory: videoId
        }
    })

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            video[0],
            "Video fetched successfully!!!"
        )
    )
});

export {
    publishVideo,
    getVideoById
}