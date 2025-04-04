import express from 'express';
import { verifyWebhook, handleWebhook } from './webhooks/github';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Webhook endpoint
app.post('/webhook/github', verifyWebhook, handleWebhook);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 