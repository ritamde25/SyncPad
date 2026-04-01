import ratelimit from "../config/upstash.js";
import { Request, Response, NextFunction } from "express";

const rateLimiter = async (req : Request, res : Response, next : NextFunction) => {
    try {
        const { success } = await ratelimit.limit("my-key");
        if(!success){
            return res.status(429).json({
                message: "Too many requests, please try again later"
            });
        }

        next();
    } catch (e){
        console.error("Rate limit error: ", e);
        next(e);
    }
}

export default rateLimiter;