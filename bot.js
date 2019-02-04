require("dotenv").config();
const Telegraf = require("telegraf");
const firestore = require("./firestore");

const bot = new Telegraf(process.env.TG_BOT_TOKEN);

/**
 * /start command.
 */
bot.start(ctx => ctx.reply("Welcome!"));

/**
 * /help command.
 */
bot.help(ctx => ctx.reply("Hi!"));

/**
 * /reply command.
 */
bot.command("/remind", ctx =>
  ctx.reply("What do you want me to remind you of?")
);

module.exports = bot;
