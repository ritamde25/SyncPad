import { Request, Response } from "express";

export const getMe = async (req : Request, res : Response) => {
    res.send("Hello from the backend");
}