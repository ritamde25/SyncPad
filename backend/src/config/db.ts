import mongoose from "mongoose";

export const connectDB = async () => {
    try{
        await mongoose.connect(process.env.MONGO_URI!);
        console.log("MongoDB connected succesfully!");
    } catch(e){
        console.log("Error connecting to MongoDB: ", e);
        process.exit(1);
    } 
}