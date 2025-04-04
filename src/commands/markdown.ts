import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Octokit } from '@octokit/rest';
import { Command } from '../types/discord';

export const data = new SlashCommandBuilder()
  .setName('markdown')
  .setDescription('Render GitHub Flavored Markdown as a preview')
  .addStringOption(option =>
    option
      .setName('text')
      .setDescription('Markdown text to render')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction, octokit: Octokit) {
  const markdownText = interaction.options.getString('text')!;

  try {
    // Create a deferred reply since it might take a moment
    await interaction.deferReply();

    // Render the markdown using GitHub's API
    const { data: rendered } = await octokit.rest.markdown.render({
      text: markdownText,
      mode: 'gfm'
    });

    // Create an embed with preview
    const embed = new EmbedBuilder()
      .setTitle('Markdown Preview')
      .setColor('#0366d6')
      .addFields(
        { 
          name: 'Source', 
          value: markdownText.length > 1000 
            ? markdownText.substring(0, 997) + '...' 
            : markdownText 
        }
      );

    // Send the original Markdown and rendered HTML
    // Discord can't render HTML in embeds, so we'll send rendered as a file if it's complex
    const htmlContent = rendered;
    
    // If the markdown contains elements that need better rendering (tables, images, etc.)
    if (htmlContent.includes('<table') || 
        htmlContent.includes('<img') ||
        htmlContent.includes('<h') ||
        htmlContent.includes('<pre') ||
        htmlContent.includes('<code')) {
      // Create a simple HTML file with basic styling
      const styledHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Preview</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #24292e;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    pre, code {
      background-color: #f6f8fa;
      border-radius: 3px;
      padding: 0.2em 0.4em;
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
    }
    pre {
      padding: 16px;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    table th, table td {
      padding: 6px 13px;
      border: 1px solid #dfe2e5;
    }
    table tr {
      background-color: #fff;
      border-top: 1px solid #c6cbd1;
    }
    table tr:nth-child(2n) {
      background-color: #f6f8fa;
    }
    img {
      max-width: 100%;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

      // Send the Markdown embed and a rendered HTML file
      await interaction.editReply({
        embeds: [embed],
        files: [{
          attachment: Buffer.from(styledHtml),
          name: 'markdown-preview.html'
        }]
      });
    } else {
      // For simple markdown, just show the rendered content as text
      // Strip HTML tags for simple display in Discord
      const strippedHtml = htmlContent
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&lt;/g, '<')    // Replace HTML entities
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

      embed.addFields({ 
        name: 'Rendered', 
        value: strippedHtml.length > 1024 
          ? strippedHtml.substring(0, 1021) + '...' 
          : strippedHtml 
      });

      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error rendering markdown:', error);
    await interaction.editReply('Error rendering markdown. Please check your syntax and try again.');
  }
} 