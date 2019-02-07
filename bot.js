require("dotenv").config();
const Telegraf = require("telegraf");
const Telegram = require("telegraf/telegram");
const Extra = require("telegraf/extra");

const firebase = require("firebase/app");
const firestore = require("./firestore");
const chrono = require("chrono-node");

const telegram = new Telegram(process.env.TG_BOT_TOKEN);
const bot = new Telegraf(process.env.TG_BOT_TOKEN);

/**
 * Get session key of current session. Used as unique key in database.
 * @param ctx Context for Telegram update
 * @return {str} Session Key
 */
const getSessionKey = ctx => {
  if (ctx.from && ctx.chat) {
    return `${ctx.from.id}:${ctx.chat.id}`;
  } else if (ctx.from && ctx.inlineQuery) {
    return `${ctx.from.id}:${ctx.from.id}`;
  }
  return null;
};

/**
 * /start command.
 */
bot.start(async ctx => {
  await ctx.reply("Welcome!").then(m => (bot.lastMessageID = m.message_id));
  console.log(bot.lastMessageID);
  firestore
    .collection("states")
    .doc(getSessionKey(ctx))
    .set({});
});

/**
 * /help command.
 */
bot.help(
  async ctx =>
    await ctx.reply("Hi!").then(m => (bot.lastMessageID = m.message_id))
);

/**
 * /remind command.
 *
 * Upon calling, toEnterReminder state is set, and user is expected to either
 * enter the item to remind next, or cancel the action.
 */
bot.command("/remind", async ctx => {
  await ctx
    .reply(
      "What do you want me to remind you of?\n\nReply me the item to be reminded of, or cancel the action.",
      Extra.markup(m =>
        m.inlineKeyboard([m.callbackButton("Cancel", "cancelEnterReminder")])
      )
    )
    .then(m => (bot.lastMessageID = m.message_id));
  firestore
    .collection("states")
    .doc(getSessionKey(ctx))
    .upsert({ toEnterReminder: true });
});

/**
 * Text Listener.
 *
 * If toEnterReminder is set, bot listens to reminder item. As user reply bot
 * with item, the item is stored in database.
 * Otherwise, the text is discarded.
 */
bot.on("text", ctx => {
  if (ctx.chat.id < 0) {
    repliedTo = ctx.update.message.reply_to_message
      ? {
          chat: ctx.update.message.reply_to_message.chat.id,
          msg: ctx.update.message.reply_to_message.message_id
        }
      : null;
  } else {
    repliedTo = bot.lastMessageID
      ? {
          chat: ctx.chat.id,
          msg: bot.lastMessageID
        }
      : null;
  }

  firestore
    .collection("states")
    .doc(getSessionKey(ctx))
    .get()
    .then(async docSnapshot => {
      // check toEnterReminder state
      if (docSnapshot.exists && docSnapshot.data()["toEnterReminder"]) {
        firestore
          .collection("states")
          .doc(getSessionKey(ctx))
          .upsert({
            toEnterReminder: false,
            toEnterDate: true,
            tmpReminderName: ctx.message.text
          });

        if (repliedTo) {
          telegram.editMessageReplyMarkup(
            repliedTo["chat"],
            repliedTo["msg"],
            (markup = {})
          );
        }

        await ctx
          .reply(
            `When do you want me to remind you of "${
              ctx.message.text
            }"?\n\nReply me the item to be reminded of, or cancel the action.`,
            Extra.markup(m =>
              m.inlineKeyboard([
                m.callbackButton("Cancel", "cancelEnterReminder")
              ])
            )
          )
          .then(m => (bot.lastMessageID = m.message_id));
      } else if (docSnapshot.exists && docSnapshot.data()["toEnterDate"]) {
        let rawTime = ctx.message.text;

        parsedTime = chrono.parseDate(rawTime);

        firestore
          .collection("reminders")
          .doc(getSessionKey(ctx))
          .upsert({
            items: firebase.firestore.FieldValue.arrayUnion({
              name: docSnapshot.data()["tmpReminderName"],
              time: parsedTime
            })
          });

        if (repliedTo) {
          telegram.editMessageReplyMarkup(
            repliedTo["chat"],
            repliedTo["msg"],
            (markup = {})
          );
        }

        // TODO: Reformat text with proper grammar
        await ctx
          .reply(
            `I will remind you of "${
              docSnapshot.data()["tmpReminderName"]
            }" at ${parsedTime}.`
          )
          .then(m => (bot.lastMessageID = m.message_id));

        firestore
          .collection("states")
          .doc(getSessionKey(ctx))
          .set({});
      }
    });
});

/**
 * Cancel Enter Reminder action.
 *
 * Deletes the message, and reset toEnterReminder state.
 */
bot.action("cancelEnterReminder", ctx => {
  ctx.deleteMessage();
  firestore
    .collection("states")
    .doc(getSessionKey(ctx))
    .set({});
});

module.exports = bot;
