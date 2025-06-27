import { Router } from "express";
import { 
    loginUser,
    registerUser,
    logoutUser, 
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatar,
    updatecoverImage,
    getSubscriberDetails,
    getUserWatchHistory 
} from "../controllers/user-controller.js";
import { upload } from "../middlewares/multer-middleware.js";
import { verifyJwt } from "../middlewares/auth-middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)

//secured route
router.route("/logout").post(verifyJwt,  logoutUser)
router.route("/refresh-token").post(refreshAccessToken)

router.route("/update-password").post(verifyJwt, changeCurrentPassword)
router.route("/get-user").get(verifyJwt, getCurrentUser)
router.route("/update-account").patch(verifyJwt, updateAccountDetails)
router.route("/update-avatar").patch(verifyJwt, upload.single("avatar"), updateAvatar)
router.route("/update-coverImage").patch(verifyJwt,upload.single("coverImage"), updatecoverImage)
router.route("/channel-details/:username").get(verifyJwt, getSubscriberDetails)
router.route("/user-watchHistory").get(verifyJwt, getUserWatchHistory)

export default router;