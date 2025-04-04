import { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { config } from 'dotenv';
import { Octokit } from '@octokit/rest';

// Load environment variables
config();

// Initialize Discord client (will be initialized when imported, but only used for commands)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Bot login (for development environment)
if (process.env.NODE_ENV !== 'production') {
  client.login(process.env.DISCORD_TOKEN).catch(console.error);
  
  client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user?.tag}!`);
  });
}

export default async (req: VercelRequest, res: VercelResponse) => {
  // Health check
  return res.status(200).json({
    status: 'ok',
    message: 'GitHub Workflow Discord Bot is running',
    environment: process.env.NODE_ENV || 'development',
  });
}; 