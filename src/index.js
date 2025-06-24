import dotenv from 'dotenv';
import connectDB from './db/db-connect.js';

dotenv.config({
    path: './env'
})

connectDB();