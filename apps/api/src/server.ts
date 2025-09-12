import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API server is running' });
});

// Basic API endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'Brokerage API is running',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API server is running on http://localhost:${PORT}`);
});