import { Router  } from "express";
import { upload } from "../middlewares/multer-middleware.js";
import { verifyJwt } from "../middlewares/auth-middleware.js";
import {
    publishVideo,
    getVideoById
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

export default router;