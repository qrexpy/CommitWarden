import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Octokit } from '@octokit/rest';
import { Command } from '../types/discord';

// Language colors based on GitHub's colors
const languageColors: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Swift: '#ffac45',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  PowerShell: '#012456',
  Dockerfile: '#384d54',
  Lua: '#000080',
  // Add more languages as needed
  default: '#8257e6' // Default purple color
};

// Create a progress bar for languages
function createProgressBar(percentage: number, color: string): string {
  const filledBlocks = Math.floor(percentage / 5); // 20 blocks for 100%
  const emptyBlocks = 20 - filledBlocks;
  const filledBar = '█'.repeat(filledBlocks);
  const emptyBar = '░'.repeat(emptyBlocks);
  return `\`\`\`ansi\n\u001b[38;2;${hexToRgb(color)}m${filledBar}${emptyBar} ${percentage.toFixed(1)}%\u001b[0m\`\`\``;
}

// Convert hex color to RGB
function hexToRgb(hex: string): string {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `${r};${g};${b}`;
}

export const data = new SlashCommandBuilder()
  .setName('repo')
  .setDescription('View repository statistics')
  .addStringOption(option =>
    option
      .setName('repository')
      .setDescription('Repository name (owner/repo)')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction, octokit: Octokit) {
  const repo = interaction.options.getString('repository')!;
  const [owner, repository] = repo.split('/');

  try {
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo: repository,
    });

    const { data: contributors } = await octokit.repos.listContributors({
      owner,
      repo: repository,
    });

    const { data: languages } = await octokit.repos.listLanguages({
      owner,
      repo: repository,
    });

    // Create main embed
    const embed = new EmbedBuilder()
      .setTitle(repoData.name)
      .setDescription(repoData.description || 'No description provided')
      .setColor('#2EA043')
      .addFields(
        { name: 'Stars', value: repoData.stargazers_count.toString(), inline: true },
        { name: 'Forks', value: repoData.forks_count.toString(), inline: true },
        { name: 'Watchers', value: repoData.watchers_count.toString(), inline: true },
        { name: 'Open Issues', value: repoData.open_issues_count.toString(), inline: true },
        { name: 'License', value: repoData.license?.name || 'None', inline: true },
        { name: 'Default Branch', value: repoData.default_branch, inline: true }
      )
      .setURL(repoData.html_url);
    
    if (repoData.owner && repoData.owner.avatar_url) {
      embed.setThumbnail(repoData.owner.avatar_url);
    }

    // Create language progress bars
    if (Object.keys(languages).length > 0) {
      const totalBytes = Object.values(languages).reduce((a, b) => a + Number(b), 0);
      
      // Sort languages by bytes
      const sortedLanguages = Object.entries(languages)
        .sort(([, a], [, b]) => (Number(b) - Number(a)))
        .slice(0, 5);
      
      // Create a field for each language with a progress bar
      for (const [lang, bytes] of sortedLanguages) {
        const percentage = (Number(bytes) / totalBytes) * 100;
        const color = languageColors[lang] || languageColors.default;
        embed.addFields({
          name: lang,
          value: createProgressBar(percentage, color)
        });
      }
    } else {
      embed.addFields({ name: 'Languages', value: 'No languages detected' });
    }

    // First embed will be the repo info with language progress bars
    await interaction.reply({ embeds: [embed] });

    // Create a separate embed for top contributors if there are any
    if (contributors.length > 0) {
      const contributorsEmbed = new EmbedBuilder()
        .setTitle(`Top Contributors for ${repo}`)
        .setColor('#0366d6');

      // Fetch and add top 5 contributors with their avatars
      for (let i = 0; i < Math.min(5, contributors.length); i++) {
        const contributor = contributors[i];
        contributorsEmbed.addFields({
          name: `${contributor.login} (${contributor.contributions} commits)`,
          value: `[GitHub Profile](${contributor.html_url})`,
          inline: true
        });
        
        // Add contributor's avatar as thumbnail for the first contributor
        if (i === 0 && contributor.avatar_url) {
          contributorsEmbed.setThumbnail(contributor.avatar_url);
        }
      }

      // Send contributors as a follow-up message
      await interaction.followUp({ embeds: [contributorsEmbed] });
    }
  } catch (error) {
    console.error(error);
    await interaction.reply('Error fetching repository information.');
  }
} 