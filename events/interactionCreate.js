const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { staffTicketsLogChannelName } = require('../config.json');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isChatInputCommand()) {
			console.log(`[InteractionCreate] Command received: ${interaction.commandName}`);
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				console.log(`[InteractionCreate] Executing command: ${interaction.commandName}`);
				await command.execute(interaction);
				console.log(`[InteractionCreate] Command completed: ${interaction.commandName}`);
			} catch (error) {
				console.error(`[InteractionCreate] Error in ${interaction.commandName}:`, error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({
						content: 'There was an error while executing this command!',
						flags: MessageFlags.Ephemeral,
					});
				} else {
					await interaction.reply({
						content: 'There was an error while executing this command!',
						flags: MessageFlags.Ephemeral,
					});
				}
			}
		} else if (interaction.isButton()) {
			await handleButtonInteraction(interaction);
		} else if (interaction.isStringSelectMenu()) {
			await handleSelectMenuInteraction(interaction);
		} else if (interaction.isModalSubmit()) {
			await handleModalSubmit(interaction);
		}
	},
};

// Handle button interactions
async function handleButtonInteraction(interaction) {
    if (interaction.customId === 'create_ticket') {
        // Create category select menu
        const categorySelect = new StringSelectMenuBuilder()
            .setCustomId('ticket_category')
            .setPlaceholder('Select a ticket category')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Onboarding')
                    .setDescription('Questions about getting started')
                    .setValue('onboarding')
                    .setEmoji('👋'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Moderation')
                    .setDescription('Moderation-related issues')
                    .setValue('moderation')
                    .setEmoji('🛡️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Competitive')
                    .setDescription('Competitive-related inquiries')
                    .setValue('competitive')
                    .setEmoji('🏆'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('PR')
                    .setDescription('Public Relations matters')
                    .setValue('pr')
                    .setEmoji('📢'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Development')
                    .setDescription('Development and technical issues')
                    .setValue('development')
                    .setEmoji('💻'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Events')
                    .setDescription('Select this if you\'re interested in becoming an Event Host!')
                    .setValue('events')
                    .setEmoji('🎉')
            );

        const row = new ActionRowBuilder().addComponents(categorySelect);

        await interaction.reply({
            content: 'Please select a category for your ticket:',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    } else if (interaction.customId === 'close_ticket') {
        await handleCloseTicket(interaction);
    }
}

// Handle select menu interactions
async function handleSelectMenuInteraction(interaction) {
    if (interaction.customId === 'ticket_category') {
        const selectedCategory = interaction.values[0];

        // Create modal for ticket creation
        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${selectedCategory}`)
            .setTitle(`Create ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Ticket`);

        // Create text inputs
        const subjectInput = new TextInputBuilder({
            customId: 'ticket_subject',
            label: 'Ticket Subject',
            style: TextInputStyle.Short,
            placeholder: 'Brief description of your issue...',
            required: true,
            maxLength: 100
        });

        const contentInput = new TextInputBuilder({
            customId: 'ticket_content',
            label: 'Ticket Description',
            style: TextInputStyle.Paragraph,
            placeholder: 'Please provide detailed information about your issue...',
            required: true,
            maxLength: 1000
        });

        // Create action rows for the inputs
        const subjectRow = new ActionRowBuilder().addComponents(subjectInput);
        const contentRow = new ActionRowBuilder().addComponents(contentInput);

        // Add inputs to the modal
        modal.addComponents(subjectRow, contentRow);

        // Show the modal to the user
        await interaction.showModal(modal);
    }
}

// Handle modal submissions
async function handleModalSubmit(interaction) {
    if (interaction.customId.startsWith('ticket_modal_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // Extract category from customId
            const category = interaction.customId.replace('ticket_modal_', '');
            const categoryDisplay = category.charAt(0).toUpperCase() + category.slice(1);

            // Get emoji for category
            const categoryEmojis = {
                'onboarding': '👋',
                'moderation': '🛡️',
                'competitive': '🏆',
                'pr': '📢',
                'development': '💻',
                'events': '🎉'
            };
            const categoryEmoji = categoryEmojis[category] || '🎫';

            // Role IDs to tag based on category
            const categoryRoles = {
                'onboarding': '1434216081177972848',
                'moderation': '1434216186471645326',
                'competitive': '1434216253140107346',
                'pr': '1434216149133955192',
                'development': '1434216347159756872',
                'events': '1430039289953128498'
            };

            // Get the values from the modal
            const subject = interaction.fields.getTextInputValue('ticket_subject');
            const content = interaction.fields.getTextInputValue('ticket_content');
            const user = interaction.user;

            // Find or create the "Tickets" category
            let ticketsCategory = interaction.guild.channels.cache.find(
                channel => channel.name.toLowerCase() === 'tickets' && channel.type === ChannelType.GuildCategory
            );

            if (!ticketsCategory) {
                ticketsCategory = await interaction.guild.channels.create({
                    name: 'Tickets',
                    type: ChannelType.GuildCategory,
                });
            }

            // Create the ticket channel
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${user.username}`,
                type: ChannelType.GuildText,
                parent: ticketsCategory.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                ],
            });

            // Create embed for the ticket channel
            const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎫 New Support Ticket`)
                .setDescription('A new support ticket has been created!')
                .addFields(
                    { name: '👤 Created by', value: `${user}`, inline: true },
                    { name: `${categoryEmoji} Category`, value: categoryDisplay, inline: true },
                    { name: '📝 Subject', value: subject, inline: false },
                    { name: '📄 Description', value: content, inline: false }
                )
                .setColor(0x00FF00)
                .setFooter({ text: 'Andromeda Gaming Support' })
                .setTimestamp();

            // Create close button
            const closeButton = new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            const buttonRow = new ActionRowBuilder().addComponents(closeButton);

            // Send the embed to the ticket channel and mention the user and relevant role
            const roleId = categoryRoles[category];
            const roleMention = roleId ? `<@&${roleId}>` : '';
            
            await ticketChannel.send({
                content: `${user} Your ticket has been created! ${roleMention}`,
                embeds: [ticketEmbed],
                components: [buttonRow]
            });

            // Log ticket creation to staff-tickets channel
            const staffTicketsLogChannel = interaction.guild.channels.cache.find(
                channel => channel.name === staffTicketsLogChannelName && channel.type === ChannelType.GuildText
            );

            if (staffTicketsLogChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📋 New Ticket Created')
                    .setDescription(`A new ticket has been created by ${user}`)
                    .addFields(
                        { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: `${categoryEmoji} Category`, value: categoryDisplay, inline: true },
                        { name: '📝 Subject', value: subject, inline: false },
                        { name: '🔗 Channel', value: `${ticketChannel}`, inline: false },
                        { name: '📊 Status', value: '🟢 Open', inline: true }
                    )
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Ticket System Log' })
                    .setTimestamp();

                const logMessage = await staffTicketsLogChannel.send({ embeds: [logEmbed] });
                
                // Store the log message ID in the channel topic for later retrieval
                await ticketChannel.setTopic(`Log: ${logMessage.id} | User: ${user.id} | Category: ${category}`);
            } else {
                console.warn(`[WARNING] Channel "${staffTicketsLogChannelName}" not found for logging`);
            }

            // Confirm ticket creation to the user
            await interaction.editReply({
                content: `✅ Your ticket has been created! Please check ${ticketChannel} for more information.`
            });

        } catch (error) {
            console.error('Error creating ticket:', error);
            await interaction.editReply({
                content: '❌ There was an error creating your ticket. Please try again later.'
            });
        }
    }
}

// Handle ticket closing
async function handleCloseTicket(interaction) {
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

        // Parse the channel topic to get the log message ID
        const topic = channel.topic;
        if (!topic) {
            await interaction.editReply({
                content: '❌ Unable to find ticket information.'
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
            'competitive': '🏆',
            'pr': '📢',
            'development': '💻',
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
                console.log('[Close Ticket] Starting transcript creation...');
                
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

                console.log(`[Close Ticket] Fetched ${allMessages.length} messages for transcript`);

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

                console.log('[Close Ticket] Transcript created, sending to log channel...');

                // Send transcript first
                await staffTicketsLogChannel.send({
                    content: `📄 Transcript for **${channel.name}**:`,
                    files: [attachment]
                });

                console.log('[Close Ticket] Transcript sent successfully');

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
                    console.log('[Close Ticket] Log message updated');
                }
            } catch (error) {
                console.error('Error updating log message or creating transcript:', error);
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
}