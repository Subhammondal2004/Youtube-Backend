import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';
import { ApiError } from './apiError';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

const uploadCloudinary = async (localfilePath) =>{
    try {
        if(!localfilePath) return null;
        const response = await cloudinary.uploader.upload(localfilePath, {
            resource_type: 'auto' // Automatically detect the resource type (image, video, etc.)
        });

        // console.log('File is uploaded on cloudinary!!', response.url);
        fs.unlinkSync(localfilePath)  ; // Remove the local file after upload.
        return response;

    } catch (error) {
        fs.unlinkSync(localfilePath)  //removed the locally saved file as upload operation fails.
        return null;
    }
}

const deleteCloudinary = async(filePublicId, resource_type="image")=>{
    try {
        if(!filePublicId)  return null;

        const response = await cloudinary.uploader.destroy(filePublicId,{
            resource_type: `${resource_type}`
        });
        return response;
        
    } catch (error) {
        throw new ApiError(500, error.message || "Error deleting files")
    }
}

export {
    uploadCloudinary,
    deleteCloudinary
}