import dotenv from 'dotenv';
import cors from "cors";

dotenv.config();

import app from './app.js';

const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:3000", // your Next.js frontend
  credentials: true, // allow cookies if you ever use them
}));


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
