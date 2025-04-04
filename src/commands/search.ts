import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Octokit } from '@octokit/rest';
import { Command } from '../types/discord';

export const data = new SlashCommandBuilder()
  .setName('search')
  .setDescription('Search across GitHub')
  .addSubcommand(subcommand =>
    subcommand
      .setName('code')
      .setDescription('Search for code across GitHub repositories')
      .addStringOption(option =>
        option
          .setName('query')
          .setDescription('Search query (e.g., "function in:file language:javascript")')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('scope')
          .setDescription('Scope of the search')
          .setRequired(false)
          .addChoices(
            { name: 'All GitHub', value: 'all' },
            { name: 'User repositories', value: 'user' },
            { name: 'Organization repositories', value: 'org' }
          )
      )
      .addStringOption(option =>
        option
          .setName('owner')
          .setDescription('Username or organization (required if scope is not "All GitHub")')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('repositories')
      .setDescription('Search for repositories on GitHub')
      .addStringOption(option =>
        option
          .setName('query')
          .setDescription('Search query (e.g., "tensorflow stars:>1000")')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction, octokit: Octokit) {
  const subcommand = interaction.options.getSubcommand();

  // Create a deferred reply since search can take time
  await interaction.deferReply();

  if (subcommand === 'code') {
    await handleCodeSearch(interaction, octokit);
  } else if (subcommand === 'repositories') {
    await handleRepoSearch(interaction, octokit);
  }
}

async function handleCodeSearch(interaction: ChatInputCommandInteraction, octokit: Octokit) {
  const query = interaction.options.getString('query')!;
  const scope = interaction.options.getString('scope') || 'all';
  const owner = interaction.options.getString('owner');

  // Build the search query based on scope
  let searchQuery = query;
  if (scope === 'user' && owner) {
    searchQuery = `${query} user:${owner}`;
  } else if (scope === 'org' && owner) {
    searchQuery = `${query} org:${owner}`;
  } else if ((scope === 'user' || scope === 'org') && !owner) {
    return await interaction.editReply('You must specify an owner when using user or organization scope.');
  }

  try {
    // Perform the search
    const { data: searchResults } = await octokit.rest.search.code({
      q: searchQuery,
      per_page: 10
    });

    if (searchResults.total_count === 0) {
      return await interaction.editReply(`No code found matching: ${searchQuery}`);
    }

    // Create the main embed
    const embed = new EmbedBuilder()
      .setTitle(`Code Search Results: ${searchQuery}`)
      .setDescription(`Found ${searchResults.total_count} code ${searchResults.total_count === 1 ? 'result' : 'results'}`)
      .setColor('#0366d6')
      .setFooter({ text: 'GitHub Code Search' });

    // Add the first few results
    searchResults.items.slice(0, 5).forEach((item, index) => {
      embed.addFields({
        name: `${index + 1}. ${item.repository.full_name}: ${item.path}`,
        value: `[View Code](${item.html_url})\nRepository: [${item.repository.full_name}](${item.repository.html_url})`
      });
    });

    // Add a "View more" button if there are more results
    let components = [];
    if (searchResults.total_count > 5) {
      const viewMoreButton = new ButtonBuilder()
        .setLabel('View on GitHub')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://github.com/search?q=${encodeURIComponent(searchQuery)}&type=code`);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(viewMoreButton);

      components.push(row);
    }

    await interaction.editReply({ 
      embeds: [embed],
      components: components
    });
  } catch (error) {
    console.error('Error searching code:', error);
    await interaction.editReply('Error searching code. GitHub search has rate limits - please try again later or refine your query.');
  }
}

async function handleRepoSearch(interaction: ChatInputCommandInteraction, octokit: Octokit) {
  const query = interaction.options.getString('query')!;

  try {
    // Perform the search
    const { data: searchResults } = await octokit.rest.search.repos({
      q: query,
      per_page: 10
    });

    if (searchResults.total_count === 0) {
      return await interaction.editReply(`No repositories found matching: ${query}`);
    }

    // Create the main embed
    const embed = new EmbedBuilder()
      .setTitle(`Repository Search Results: ${query}`)
      .setDescription(`Found ${searchResults.total_count} ${searchResults.total_count === 1 ? 'repository' : 'repositories'}`)
      .setColor('#0366d6')
      .setFooter({ text: 'GitHub Repository Search' });

    // Add the first few results
    searchResults.items.slice(0, 5).forEach((repo, index) => {
      embed.addFields({
        name: `${index + 1}. ${repo.full_name}`,
        value: `${repo.description || 'No description'}\n⭐ ${repo.stargazers_count} | 🍴 ${repo.forks_count} | [View](${repo.html_url})`
      });
    });

    // Add a "View more" button if there are more results
    let components = [];
    if (searchResults.total_count > 5) {
      const viewMoreButton = new ButtonBuilder()
        .setLabel('View on GitHub')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://github.com/search?q=${encodeURIComponent(query)}&type=repositories`);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(viewMoreButton);

      components.push(row);
    }

    await interaction.editReply({ 
      embeds: [embed],
      components: components
    });
  } catch (error) {
    console.error('Error searching repositories:', error);
    await interaction.editReply('Error searching repositories. GitHub search has rate limits - please try again later or refine your query.');
  }
} 