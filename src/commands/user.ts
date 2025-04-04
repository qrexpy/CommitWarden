import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Octokit } from '@octokit/rest';
import { Command } from '../types/discord';

export const data = new SlashCommandBuilder()
  .setName('user')
  .setDescription('View information about a GitHub user')
  .addStringOption(option =>
    option
      .setName('username')
      .setDescription('GitHub username to lookup')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction, octokit: Octokit) {
  const username = interaction.options.getString('username')!;

  try {
    // Get user data
    const { data: userData } = await octokit.users.getByUsername({
      username,
    });

    // Get user's repositories
    const { data: repos } = await octokit.repos.listForUser({
      username,
      sort: 'updated',
      per_page: 5
    });

    // Create user profile embed
    const userEmbed = new EmbedBuilder()
      .setTitle(userData.name || userData.login)
      .setURL(userData.html_url)
      .setThumbnail(userData.avatar_url)
      .setColor('#0366d6')
      .addFields(
        { name: 'Bio', value: userData.bio || 'No bio provided', inline: false },
        { name: 'Followers', value: userData.followers.toString(), inline: true },
        { name: 'Following', value: userData.following.toString(), inline: true },
        { name: 'Public Repos', value: userData.public_repos.toString(), inline: true }
      );

    // Add location if available
    if (userData.location) {
      userEmbed.addFields({ name: 'Location', value: userData.location, inline: true });
    }

    // Add company if available
    if (userData.company) {
      userEmbed.addFields({ name: 'Company', value: userData.company, inline: true });
    }

    // Add blog/website if available
    if (userData.blog) {
      userEmbed.addFields({ name: 'Website', value: userData.blog, inline: true });
    }

    // Add account creation date
    if (userData.created_at) {
      const creationDate = new Date(userData.created_at);
      userEmbed.addFields({ 
        name: 'Account Created', 
        value: `<t:${Math.floor(creationDate.getTime() / 1000)}:R>`, 
        inline: true 
      });
    }

    // Send the user profile embed
    await interaction.reply({ embeds: [userEmbed] });

    // Create repos embed if user has repositories
    if (repos.length > 0) {
      const reposEmbed = new EmbedBuilder()
        .setTitle(`${userData.login}'s Top Repositories`)
        .setColor('#2EA043');

      // Add each repository to the embed
      repos.forEach(repo => {
        reposEmbed.addFields({
          name: repo.name,
          value: `${repo.description || 'No description'}\n⭐ ${repo.stargazers_count} | 🍴 ${repo.forks_count} | [View](${repo.html_url})`
        });
      });

      // Send the repositories as a follow-up message
      await interaction.followUp({ embeds: [reposEmbed] });
    }

    // Get user's contributions (requires GraphQL)
    try {
      const response: any = await octokit.graphql(`
        query {
          user(login: "${username}") {
            contributionsCollection {
              totalCommitContributions
              totalIssueContributions
              totalPullRequestContributions
              totalPullRequestReviewContributions
            }
          }
        }
      `);

      if (response.user && response.user.contributionsCollection) {
        const contributionsCollection = response.user.contributionsCollection;
        const contributionsEmbed = new EmbedBuilder()
          .setTitle(`${userData.login}'s Contributions`)
          .setColor('#6f42c1')
          .addFields(
            { name: 'Commits', value: contributionsCollection.totalCommitContributions.toString(), inline: true },
            { name: 'Issues', value: contributionsCollection.totalIssueContributions.toString(), inline: true },
            { name: 'Pull Requests', value: contributionsCollection.totalPullRequestContributions.toString(), inline: true },
            { name: 'Reviews', value: contributionsCollection.totalPullRequestReviewContributions.toString(), inline: true }
          );

        await interaction.followUp({ embeds: [contributionsEmbed] });
      }
    } catch (graphqlError) {
      console.error('GraphQL error:', graphqlError);
      // Continue without contributions data if there's an error
    }

  } catch (error) {
    console.error(error);
    await interaction.reply({ 
      content: `Error fetching GitHub user: ${username}. The user might not exist or there may be an API issue.`,
      ephemeral: true 
    });
  }
} 