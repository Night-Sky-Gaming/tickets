const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, MessageFlags, AttachmentBuilder } = require('discord.js');
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
                    console.log('Starting transcript creation...');
                    
                    // Fetch all messages from the ticket channel for transcript
                    let allMessages = [];
                    let lastId;

                    // Fetch messages in batches of 100 (Discord API limit)
                    while (true) {
                        const options = { limit: 100 };
                        if (lastId) {
                            options.before = lastId;
                        }

                        const messages = await channel.messages.fetch(options);
                        allMessages.push(...messages.values());
                        
                        if (messages.size !== 100) {
                            break;
                        }
                        
                        lastId = messages.last().id;
                    }

                    console.log(`Fetched ${allMessages.length} messages for transcript`);

                    // Sort messages by timestamp (oldest first)
                    allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

                    // Create transcript text
                    let transcript = `Ticket Transcript - ${channel.name}\n`;
                    transcript += `Category: ${categoryDisplay}\n`;
                    transcript += `Closed by: ${interaction.user.tag} (${interaction.user.id})\n`;
                    transcript += `Closed at: ${new Date().toUTCString()}\n`;
                    transcript += `Total Messages: ${allMessages.length}\n`;
                    transcript += `${'='.repeat(80)}\n\n`;

                    for (const msg of allMessages) {
                        const timestamp = new Date(msg.createdTimestamp).toUTCString();
                        transcript += `[${timestamp}] ${msg.author.tag} (${msg.author.id}):\n`;
                        
                        if (msg.content) {
                            transcript += `${msg.content}\n`;
                        }
                        
                        if (msg.embeds.length > 0) {
                            transcript += `[Embed: ${msg.embeds.length} embed(s)]\n`;
                        }
                        
                        if (msg.attachments.size > 0) {
                            transcript += `[Attachments: ${Array.from(msg.attachments.values()).map(a => a.url).join(', ')}]\n`;
                        }
                        
                        transcript += '\n';
                    }

                    // Create attachment
                    const transcriptBuffer = Buffer.from(transcript, 'utf-8');
                    const attachment = new AttachmentBuilder(transcriptBuffer, {
                        name: `transcript-${channel.name}-${Date.now()}.txt`
                    });

                    console.log('Transcript created, sending to log channel...');

                    // Send transcript first
                    await staffTicketsLogChannel.send({
                        content: `📄 Transcript for **${channel.name}**:`,
                        files: [attachment]
                    });

                    console.log('Transcript sent successfully');

                    // Then update the log message
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
                        
                        await logMessage.edit({ embeds: [updatedEmbed] });
                        console.log('Log message updated');
                    }
                } catch (error) {
                    console.error('Error updating log message or creating transcript:', error);
                    console.error('Full error details:', error.stack);
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
