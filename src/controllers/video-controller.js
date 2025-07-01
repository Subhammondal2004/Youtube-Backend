import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video-model.js";
import { Like } from "../models/like-model.js";
import { Comment } from "../models/comment-model.js";
import { ApiError } from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    uploadCloudinary,
    deleteCloudinary
} from "../utils/cloudinary.js";


const publishVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if ([title, description].some((field) => field?.trim === "")) {
        throw new ApiError(400, "All fields are required")
    }

    const videolocalPath = req.files?.video[0]?.path;
    const thumbnaillocalPath = req.files?.thumbnail[0]?.path;

    if (!videolocalPath) {
        throw new ApiError(400, "Video file is required!")
    }

    if (!thumbnaillocalPath) {
        throw new ApiError(400, "Thumbnail is required!")
    }

    const videoupload = await uploadCloudinary(videolocalPath)
    const thumbnailupload = await uploadCloudinary(thumbnaillocalPath)

    if (!videoupload) {
        throw new ApiError(400, "Video file not found")
    }

    if (!thumbnailupload) {
        throw new ApiError(400, "Thumbnail not found")
    }

    const video = await Video.create({
        title,
        description,
        duration: videoupload.duration,
        video: {
            url: videoUploaded.url,
            public_id: videoUploaded.public_id,
        },
        thumbnail: {
            url: thumbnailupload.url,
            public_id: thumbnailupload.public_id,
        },
        owner: req.user?._id,
    })

    const videoUploaded = await Video.findById(video._id)

    if (!videoUploaded) {
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

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            },
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "comments"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscriberCount: {
                                $size: "$subscribers"
                            },
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        $in: [req.user?._id, "$subscribers.subscriber"]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    }, {
                        $project: {
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
            $addFields: {
                isLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "likes.likedBy"]
                        },
                        then: true,
                        else: false
                    }
                },
                Commented: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "comment.owner"]
                        },
                        then: true,
                        else: false
                    }
                },
                likeCount: {
                    $size: "$likes"
                },
                commentCount: {
                    $size: "$comment"
                },
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $project: {
                title: 1,
                description: 1,
                duration: 1,
                owner: 1,
                isLiked: 1,
                likeCount: 1,
                views: 1,
                video: 1,
                thumbnail: 1,
                createdAt: 1,
                comments: 1,
                commentCount: 1
            }
        }
    ])

    if (!video) {
        throw new ApiError(500, "Failed to fetch video details")
    }

    //update views on the video
    await Video.findByIdAndUpdate(videoId, {
        $inc: {
            views: 1
        }
    })

    //update watchHistory of the user.
    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet: {
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

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    if ([title, description].some((field) => field?.trim === "")) {
        throw new ApiError(400, "All fields are required")
    }

    const thumbnailPath = req.file?.path

    if (!thumbnailPath) {
        throw new ApiError(400, "Thumbnail is required!")
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(400, "Video not found!!")
    }

    if (video.owner?.trim.toString() !== req.user?._id.toString()) {
        throw new ApiError(401, "You donot have permission to update!")
    }

    const thumnailToDelete = video.thumbnail.public_id;

    //uploading the new thumbnail
    const thumbnailupload = await uploadCloudinary(thumbnailPath)

    if (!thumbnailupload) {
        throw new ApiError(400, "Failed to upload thumbnail!")
    }
    const updateVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: {
                    url: thumbnailupload?.url,
                    public_id: thumbnailupload?.public_id
                }
            }
        },
        {
            new: true
        }
    )

    if (updateVideo) {
        //deleting the old thumbnail
        await deleteCloudinary(thumnailToDelete)
    }

    if (!updateVideo) {
        throw new ApiError(500, "Internal server error while updating details, try again!!")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updateVideo,
                "Video details updated successfully!!!"
            )
        )
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid VideoId")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(400, "Video not found!!")
    }

    if (video.owner?.toString() !== req.user?._id.toString()) {
        throw new ApiError(401, "You donot have the permission to delete video!")
    }

    const videoPublicId = video?.video.public_id
    const thumbnailPublicId = video?.thumbnail.public_id

    const deletedVideo = await Video.findByIdAndDelete(videoId)

    if (!deletedVideo) {
        throw new ApiError(400, "Failed to delete video, please try again!!")
    }

    if (deletedVideo) {
        await deleteCloudinary(videoPublicId, "video"),
            await deleteCloudinary(thumbnailPublicId)
    }

    //delete all likes
    await Like.deleteMany({
        video: videoId
    })

    //delete all comments
    await Comment.deleteMany({
        video: videoId
    })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                deletedVideo,
                "Video deleted successfully!!!"
            )
        )
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invaild videoId")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(400, "Video not found!")
    }

    if (video.owner?.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "You are not the owner of video!")
    }

    const updateStatus = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video?.isPublished
            }
        },
        {
            new: true
        }
    )

    if (!updateStatus) {
        throw new ApiError(400, "Failed to toggle published status!")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updateStatus,
                "Published status toggled successfully!!!"
            )
        )

})

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    const pipeline = [];

    // for using Full Text based search u need to create a search index in mongoDB atlas
    // you can include field mapppings in search index eg.title, description, as well
    // Field mappings specify which fields within your documents should be indexed for text search.
    // this helps in seraching only in title, desc providing faster search results
    // here the name of search index is 'videoSearch'

    if (query) {
        pipeline.push({
            $search: {
                index: "videoSearch",
                text: {
                    query,
                    path: ["title", "description"]
                }
            }
        })
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId")
        }
        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        })
    }

    // fetch videos only that are set isPublished as true
    pipeline.push({
        $match: {
            isPublished: true
        }
    })

    //sortBy can be views, createdAt, duration
    //sortType can be ascending(-1) or descending(1)
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        })
    } else {
        pipeline.push({
            $sort: {
                createdAt: -1
            }
        })
    }

    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$owner"
        }
    )

    const videoaggregate = Video.aggregate(pipeline);

    const options = {
        pageNumber: parseInt(page, 10),
        pageSize: parseInt(limit, 10)
    }

    const videos = await Video.aggregatePaginate(videoaggregate, options)
    
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                videos,
                "Videos fetched successfully!!!"
            )
        )
})

export {
    publishVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    getAllVideos
}