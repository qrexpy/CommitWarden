import { Client, GatewayIntentBits, Collection, REST, Routes, Events } from 'discord.js';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Octokit } from '@octokit/rest';
import './types/discord'; // Import type extension
import { Command } from './types/discord';

// Load environment variables
config();

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Command collection
client.commands = new Collection<string, Command>();

// Load commands
const commandsPath = join(__dirname, 'commands');
try {
  // Check if commands directory exists
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`Loaded command: ${command.data.name}`);
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
} catch (error) {
  console.error('Error loading commands:', error);
}

// Register slash commands
const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    const commands = [];
    for (const [name, command] of client.commands) {
      commands.push(command.data.toJSON());
    }

    // Only register commands if we have at least one
    if (commands.length > 0) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, process.env.DISCORD_GUILD_ID!),
        { body: commands },
      );
      console.log('Successfully reloaded application (/) commands.');
    } else {
      console.log('No commands to register.');
    }
  } catch (error) {
    console.error('Error registering commands:', error);
  }
})();

// Event handling
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.log(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    console.log(`Executing command: ${interaction.commandName}`);
    await command.execute(interaction, octokit);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);
    const reply = { 
      content: 'There was an error while executing this command!', 
      ephemeral: true 
    };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Failed to login to Discord:', err);
}); 