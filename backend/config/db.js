import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Modern way: No extra options needed
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    // Detailed Debugging for ECONNREFUSED
    if (error.message.includes('ECONNREFUSED')) {
      console.error('👉 Tip: Check if your IP is whitelisted in MongoDB Atlas Network Access.');
    }
    
    process.exit(1);
  }
};

export default connectDB;