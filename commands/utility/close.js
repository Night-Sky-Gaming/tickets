const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { staffTicketsLogChannelName } = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close the current ticket'),
    
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const channel = interaction.channel;
            
            // Check if this is a ticket channel
            if (!channel.name.startsWith('ticket-')) {
                await interaction.editReply({
                    content: '❌ This command can only be used in ticket channels.'
                });
                return;
            }

            // Parse the channel topic to get the log message ID and user ID
            const topic = channel.topic;
            if (!topic) {
                await interaction.editReply({
                    content: '❌ Unable to find ticket information.'
                });
                return;
            }

            // Extract user ID from topic
            const userMatch = topic.match(/User: (\d+)/);
            const ticketOwnerId = userMatch ? userMatch[1] : null;

            // Check if the user is either the ticket creator or has staff permissions
            const isTicketOwner = interaction.user.id === ticketOwnerId;
            const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

            if (!isTicketOwner && !isStaff) {
                await interaction.editReply({
                    content: '❌ You do not have permission to close this ticket. Only the ticket creator or staff members can close tickets.'
                });
                return;
            }

            // Extract log message ID and category from topic
            const logMatch = topic.match(/Log: (\d+)/);
            const categoryMatch = topic.match(/Category: (\w+)/);
            
            if (!logMatch) {
                await interaction.editReply({
                    content: '❌ Unable to find ticket log message.'
                });
                return;
            }

            const logMessageId = logMatch[1];
            const category = categoryMatch ? categoryMatch[1] : 'unknown';

            // Get category emoji
            const categoryEmojis = {
                'onboarding': '👋',
                'moderation': '🛡️',
                'tournaments': '🏆',
                'events': '🎉'
            };
            const categoryEmoji = categoryEmojis[category] || '🎫';
            const categoryDisplay = category.charAt(0).toUpperCase() + category.slice(1);

            // Find the staff-tickets log channel
            const staffTicketsLogChannel = interaction.guild.channels.cache.find(
                ch => ch.name === staffTicketsLogChannelName && ch.type === ChannelType.GuildText
            );

            if (staffTicketsLogChannel) {
                try {
                    // Fetch the original log message
                    const logMessage = await staffTicketsLogChannel.messages.fetch(logMessageId);
                    
                    if (logMessage && logMessage.embeds.length > 0) {
                        const originalEmbed = logMessage.embeds[0];
                        
                        // Create updated embed with closed status
                        const updatedEmbed = EmbedBuilder.from(originalEmbed)
                            .setTitle('📋 Ticket Closed')
                            .setColor(0xFF0000)
                            .setFields(
                                { name: '👤 User', value: originalEmbed.fields[0].value, inline: true },
                                { name: `${categoryEmoji} Category`, value: categoryDisplay, inline: true },
                                { name: '📝 Subject', value: originalEmbed.fields[2].value, inline: false },
                                { name: '🔗 Channel', value: originalEmbed.fields[3].value, inline: false },
                                { name: '📊 Status', value: '🔴 Closed', inline: true },
                                { name: '🔒 Closed by', value: `${interaction.user.tag}`, inline: true },
                                { name: '⏰ Closed at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                            );
                        
                        // Edit the log message
                        await logMessage.edit({ embeds: [updatedEmbed] });
                    }
                } catch (error) {
                    console.error('Error updating log message:', error);
                }
            }

            // Confirm closure to the user
            await interaction.editReply({
                content: '✅ This ticket will be deleted in 5 seconds...'
            });

            // Delete the channel after a short delay
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (error) {
                    console.error('Error deleting ticket channel:', error);
                }
            }, 5000);

        } catch (error) {
            console.error('Error closing ticket:', error);
            await interaction.editReply({
                content: '❌ There was an error closing this ticket.'
            });
        }
    },
};
