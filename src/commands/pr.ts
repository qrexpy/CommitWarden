import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Octokit } from '@octokit/rest';
import { Command } from '../types/discord';

export const data = new SlashCommandBuilder()
  .setName('pr')
  .setDescription('Manage GitHub pull requests')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List open pull requests')
      .addStringOption(option =>
        option
          .setName('repo')
          .setDescription('Repository name (owner/repo)')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('check')
      .setDescription('Check pull request details')
      .addStringOption(option =>
        option
          .setName('repo')
          .setDescription('Repository name (owner/repo)')
          .setRequired(true)
      )
      .addNumberOption(option =>
        option
          .setName('number')
          .setDescription('Pull request number')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction, octokit: Octokit) {
  const subcommand = interaction.options.getSubcommand();
  const repo = interaction.options.getString('repo')!;
  const [owner, repository] = repo.split('/');

  if (subcommand === 'list') {
    try {
      const { data: pulls } = await octokit.pulls.list({
        owner,
        repo: repository,
        state: 'open',
      });

      if (pulls.length === 0) {
        await interaction.reply('No open pull requests found.');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Open Pull Requests in ${repo}`)
        .setColor('#2EA043');

      pulls.forEach(pr => {
        embed.addFields({
          name: `#${pr.number}: ${pr.title}`,
          value: `By: ${pr.user?.login}\nStatus: ${pr.state}\n[View PR](${pr.html_url})`,
        });
      });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply('Error fetching pull requests.');
    }
  } else if (subcommand === 'check') {
    const prNumber = interaction.options.getNumber('number')!;

    try {
      const { data: pr } = await octokit.pulls.get({
        owner,
        repo: repository,
        pull_number: prNumber,
      });

      const embed = new EmbedBuilder()
        .setTitle(`PR #${pr.number}: ${pr.title}`)
        .setDescription(pr.body || 'No description provided')
        .setColor('#2EA043')
        .addFields(
          { name: 'Author', value: pr.user?.login || 'Unknown', inline: true },
          { name: 'Status', value: pr.state, inline: true },
          { name: 'Created', value: new Date(pr.created_at).toLocaleDateString(), inline: true },
          { name: 'Last Updated', value: new Date(pr.updated_at).toLocaleDateString(), inline: true },
          { name: 'Commits', value: pr.commits.toString(), inline: true },
          { name: 'Changed Files', value: pr.changed_files.toString(), inline: true }
        )
        .setURL(pr.html_url);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply('Error fetching pull request details.');
    }
  }
} 