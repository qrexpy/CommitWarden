import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Octokit } from '@octokit/rest';
import { Command } from '../types/discord';

export const data = new SlashCommandBuilder()
  .setName('star')
  .setDescription('Star or unstar a GitHub repository')
  .addStringOption(option =>
    option
      .setName('repository')
      .setDescription('Repository name (owner/repo)')
      .setRequired(true)
  )
  .addBooleanOption(option =>
    option
      .setName('unstar')
      .setDescription('Unstar the repository instead of starring it')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction, octokit: Octokit) {
  const repo = interaction.options.getString('repository')!;
  const shouldUnstar = interaction.options.getBoolean('unstar') || false;
  const [owner, repository] = repo.split('/');

  if (!owner || !repository) {
    return await interaction.reply({
      content: 'Please provide a valid repository name in the format `owner/repo`',
      ephemeral: true
    });
  }

  try {
    // Create a deferred reply since GitHub API interactions can be slow
    await interaction.deferReply();

    // Check if repository exists
    try {
      await octokit.repos.get({
        owner,
        repo: repository
      });
    } catch (error) {
      return await interaction.editReply(`Repository ${repo} not found. Make sure you have the correct name.`);
    }

    // Check if the repo is already starred
    let isStarred = false;
    try {
      const { status } = await octokit.activity.checkRepoIsStarredByAuthenticatedUser({
        owner,
        repo: repository
      });
      isStarred = status === 204;
    } catch (error) {
      // 404 means not starred, which is fine
      if ((error as any).status !== 404) {
        throw error;
      }
    }

    // Star or unstar based on command and current status
    if (shouldUnstar) {
      if (!isStarred) {
        return await interaction.editReply(`Repository ${repo} is not starred, so it cannot be unstarred.`);
      }
      
      await octokit.activity.unstarRepoForAuthenticatedUser({
        owner,
        repo: repository
      });
      
      const embed = new EmbedBuilder()
        .setTitle('Repository Unstarred')
        .setDescription(`Successfully removed star from [${repo}](https://github.com/${repo})`)
        .setColor('#CB2431')
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      if (isStarred) {
        return await interaction.editReply(`Repository ${repo} is already starred.`);
      }
      
      await octokit.activity.starRepoForAuthenticatedUser({
        owner,
        repo: repository
      });
      
      // Get updated star count
      const { data: updatedRepo } = await octokit.repos.get({
        owner,
        repo: repository
      });
      
      const embed = new EmbedBuilder()
        .setTitle('Repository Starred')
        .setDescription(`Successfully starred [${repo}](https://github.com/${repo})`)
        .setColor('#FFD700')  // Gold color for stars
        .addFields(
          { name: 'Total Stars', value: updatedRepo.stargazers_count.toString(), inline: true }
        )
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error starring/unstarring repository:', error);
    await interaction.editReply('Error processing your request. Make sure your GitHub token has the necessary permissions.');
  }
} 