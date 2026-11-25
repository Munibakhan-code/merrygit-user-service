import mongoose from 'mongoose';

const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI

    if (!mongoURI) throw new Error(' ❌ MONGO_URI is not defined');

    try {
        await mongoose.connect(mongoURI, {
            
            dbName: 'userDB-chat-app',
        });
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error(' ❌ Error connecting to MongoDB:', error);
        process.exit(1);
    }
};

export default connectDB;
