import {Client, GatewayIntentBits, GuildMember } from "discord.js"
import {REST, Routes} from 'discord.js'
import { RowDataPacket } from 'mysql2';

import config from "./config"
import db from './db'

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    {
        name: 'reg',
        description: 'You can register your key!',
        options: [
            {
                name: "key",
                description: "Key",
                type: 3,
                required: true
            }
        ],
        default_permission: true
    },
    {
        name: 'gen',
        description: 'Generates key for amount of days',
        options: [
            {
                name: "days",
                description: "Amount of days",
                type: 4,
                required: true
            }
        ],
        permissions: [
            {
                // role id
                id: '1071075585641676841',
                type: 1,
                // type: 2 -- userid
                permission: true
            }
        ],
        default_permission: false
    },
    {
        name: 'del',
        description: 'Delete user by id',
        options: [
            {
                name: "discordid",
                description: "Discord id",
                type: 3,
                required: true
            }
        ],
        permissions: [
            {
                // role id
                id: '1071075585641676841',
                type: 1,
                // type: 2 -- userid
                permission: true
            }
        ],
        default_permission: false
    },
    
];

const rest = new REST({ version: '10' }).setToken(config.TOKENBOT);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        let cmds = await rest.put(Routes.applicationCommands(config.CLIENTID), { body: commands });
        
        console.log(cmds)            

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.on('ready', () => {
    console.log(`Logged in as ${client?.user?.tag}`)
})


const generateKey = function<String>() {
    return 'NT_xxxxxxx-xyxxxx-yxxxxx-yxxxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const generateUsername = function<String>() {
    return 'xxxxxxxxx'.replace(/[xy]/g, function(c){
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const generatePassword = function<String>() {
    return 'xxxxxxx'.replace(/[xy]/g, function(c){
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const replaceDays = function(days: number) {
    const daysTime:number = days*24*60*60*1000
    const timestamp: number = Date.now()
    let time = timestamp + daysTime
    return time
}


function insertLicense(license: string, days: number) {
    return new Promise((resolve, reject) => {
        const licenseQuery = `INSERT INTO licenses (license, days) VALUES (?)`
        db.query(licenseQuery, [
            [
                license,
                days
            ]
        ], (err, res) => {
            if (err) reject(err)
            else resolve(res)
        })
    })
}

interface LicenseData {
    id: number,
    license: string,
    days: number
}

function getLicense(license: string) {
    return new Promise<LicenseData>((resolve, reject) => {
        const licenseQuery = `SELECT * FROM licenses WHERE license = ?`
        db.query(licenseQuery, [
            license
        ], (err, res) => {
            if (err) reject(err)
            else {
                const row = (<RowDataPacket> res)[0]
                resolve(row)
            }
        })
    })
}

function setLicense(discord:string, username: string, password: string, days:number) {
    return new Promise((resolve, reject) => {
        const licenseQuery = `INSERT INTO users (discordid, username, password, expires) VALUES (?) ON DUPLICATE KEY UPDATE username = VALUES(username), password = VALUES(password), expires = VALUES(expires)`
        db.query(licenseQuery, [
            [
                discord,
                username,
                password,
                days
            ]
        ], (err, res) => {
            if (err) reject(err)
            else resolve(res)
        })
    })
}

function removeLicense(id:number) {
    return new Promise((resolve, reject) => {
        const licenseQuery = `DELETE FROM licenses WHERE id = ?`
        db.query(licenseQuery, [
            id     
        ], (err, res) => {
            if (err) reject(err)
            else resolve(res)
        })
    })
}

function removeUser(discord:string) {
    return new Promise((resolve, reject) => {
        const licenseQuery = `DELETE FROM users WHERE discordid = ?`
        db.query(licenseQuery, [
            discord
        ], (err, res) => {
            if (err) reject(err)
            else resolve(res)
        })
    })
}



client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply()

    if (interaction.commandName === 'gen') {
        const days = interaction.options.getInteger('days')
        if (days) {
            const license: string = generateKey()
            insertLicense(license, days).then(() => {
                (interaction.member as GuildMember).send(`License key:\n${license} for amount of ${days} days`)
                interaction.followUp('Successfully created license');
            }).catch((err) => {
                console.log(err);
                (interaction.member as GuildMember).send(`${err}`)
                interaction.followUp('There was an error with mysql');
            })
        }
    } else if (interaction.commandName === 'reg') {
        const key = interaction.options.getString('key')
        if (key) {
            getLicense(key).then((res) => {
                const id = res.id
                const days = res.days
                const daysTime = replaceDays(days)
                const username = generateUsername()
                const password = generatePassword()
                const discordid = (interaction.member as GuildMember).user.id
                setLicense(discordid, username, password, daysTime).then((res) => {
                    removeLicense(id).catch(console.log);
                    (interaction.member as GuildMember).send(`Hello, this is your username:\n${username}\nand password:\n${password}`)
                    interaction.followUp('Successfully created account');
                }).catch((e) => {
                    console.log(e)
                    interaction.followUp('There was an error setting key for you');
                })
            }).catch((e) => {
                console.log(e)
                interaction.followUp('This license does not exist');
            }) 
        }
    } else if (interaction.commandName === 'del') {
        const userid = interaction.options.getString('discordid')
        if (userid) {
            removeUser(userid).then(() => {
                interaction.followUp('User removed!');
            }).catch(() => {
                interaction.followUp('Error removed!');
            })
        }
    }
});

client.login(config.TOKENBOT)