import { Client, Collection, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Octokit } from '@octokit/rest';

// Define our slash command structure
export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction, octokit: Octokit) => Promise<void>;
}

// Extend the Discord.js Client class
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
  }
} 