import mongoose, { Schema } from "mongoose"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const userSchema = new Schema({
    username:{
        type: String,
        required: true,
        lowercaes: true,
        unique: true,
        trim: true,
        index: true
    },
    email:{
        type: String,
        required: true,
        lowercaes: true,
        unique: true
    },
    fullname:{
        type: String,
        required: true,
        trim: true
    },
    avatar:{
        type: String,  //cloudinary url
        required: true
    },
    coverImage:{
        type: String
    },
    watchHistory:{
        type: Schema.Types.ObjectId,
        ref: 'Video'
    },
    password:{
        type: String,
        required: [true, 'Password is required']
    },
    refreshToken:{
        type: String
    },

},{timestamps: true})

userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10)
        this.password = await bcrypt.hash(this.password, salt)
    }
    next()
})

userSchema.methods.isPasswordCorrect = async function(password) {
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
    { 
        id: this._id, 
        username: this.username, 
        email: this.email, 
        fullname: this.fullname 
    }, 
    process.env.ACCESS_TOKEN_SECRET, 
    { 
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
    )
}

userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
    { 
        id: this._id
    },
    process.env.REFRESH_TOKEN_SECRET, 
    { 
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
    )
}
export const User = mongoose.model('User', userSchema)