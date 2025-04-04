import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { Octokit } from '@octokit/rest';

export const data = new SlashCommandBuilder()
  .setName('repo')
  .setDescription('View repository statistics')
  .addStringOption(option =>
    option
      .setName('repository')
      .setDescription('Repository name (owner/repo)')
      .setRequired(true)
  );

export async function execute(interaction: CommandInteraction, octokit: Octokit) {
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
      .addFields({
        name: 'Top Languages',
        value: Object.entries(languages)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([lang, bytes]) => `${lang}: ${((bytes / Object.values(languages).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%`)
          .join('\n')
      })
      .addFields({
        name: 'Top Contributors',
        value: contributors
          .slice(0, 5)
          .map(contributor => `${contributor.login}: ${contributor.contributions} commits`)
          .join('\n')
      })
      .setURL(repoData.html_url)
      .setThumbnail(repoData.owner.avatar_url);

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.reply('Error fetching repository information.');
  }
} 