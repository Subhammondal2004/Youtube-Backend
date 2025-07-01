import { Router  } from "express";
import { upload } from "../middlewares/multer-middleware.js";
import { verifyJwt } from "../middlewares/auth-middleware.js";
import {
    publishVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    getAllVideos
} from "../controllers/video-controller.js";

const router =  Router();

router.use(verifyJwt)
router.route("/publish-video").post(
    upload.fields([
        {
            name: "video",
            maxCount: 1,
        },
        {
            name: "thumbnail",
            maxCount: 1,
        }
    ]),
    publishVideo)

router.route("/video/:videoId").get(getVideoById)
router.route("/update-video/:videoId").patch(upload.single("thumbnail"), updateVideo)
router.route("/delete-video/:videoId").delete(deleteVideo)
router.route("/toggle-publish-status/:videoId").patch(togglePublishStatus)
router.route("/").get(getAllVideos)

export default router;