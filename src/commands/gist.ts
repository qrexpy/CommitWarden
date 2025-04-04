import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Octokit } from '@octokit/rest';
import { Command } from '../types/discord';

export const data = new SlashCommandBuilder()
  .setName('gist')
  .setDescription('Create and manage GitHub Gists')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a new GitHub Gist')
      .addStringOption(option =>
        option
          .setName('filename')
          .setDescription('Filename for the Gist, including extension')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('content')
          .setDescription('Content of the Gist')
          .setRequired(true)
      )
      .addBooleanOption(option =>
        option
          .setName('public')
          .setDescription('Whether the Gist should be public (default: false)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Description for the Gist')
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction, octokit: Octokit) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'create') {
    const filename = interaction.options.getString('filename')!;
    const content = interaction.options.getString('content')!;
    const isPublic = interaction.options.getBoolean('public') || false;
    const description = interaction.options.getString('description') || '';

    try {
      // Create a deferred reply since it might take a moment
      await interaction.deferReply();

      // Create the Gist
      const { data: gist } = await octokit.gists.create({
        description: description,
        public: isPublic,
        files: {
          [filename]: {
            content: content
          }
        }
      });

      // Create an embed with the Gist information
      const embed = new EmbedBuilder()
        .setTitle('Gist Created')
        .setDescription(`[View Gist](${gist.html_url})`)
        .setColor('#2EA043')
        .addFields(
          { name: 'Filename', value: filename, inline: true },
          { name: 'Visibility', value: isPublic ? 'Public' : 'Private', inline: true },
          { name: 'ID', value: gist.id?.toString() || 'Unknown', inline: true }
        );
      
      if (description) {
        embed.addFields({ name: 'Description', value: description });
      }

      // Preview the content (truncate if too long)
      const preview = content.length > 1000 
        ? content.substring(0, 997) + '...' 
        : content;
        
      embed.addFields({
        name: 'Content Preview',
        value: `\`\`\`${getLanguageFromFilename(filename)}\n${preview}\n\`\`\``
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error creating Gist:', error);
      await interaction.editReply('Error creating Gist. Please check your GitHub token permissions.');
    }
  }
}

// Helper function to determine code language from filename
function getLanguageFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'java': 'java',
    'rb': 'ruby',
    'php': 'php',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'sh': 'bash',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'sql': 'sql',
    'rs': 'rust'
  };

  return languageMap[extension || ''] || '';
} 