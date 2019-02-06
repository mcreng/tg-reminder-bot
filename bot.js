require("dotenv").config();
const Telegraf = require("telegraf");
const Extra = require("telegraf/extra");

const firebase = require("firebase/app");
const firestore = require("./firestore");
const chrono = require("chrono-node");

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
bot.start(ctx => ctx.reply("Welcome!"));

/**
 * /help command.
 */
bot.help(ctx => ctx.reply("Hi!"));

/**
 * /remind command.
 *
 * Upon calling, toEnterReminder state is set, and user is expected to either
 * enter the item to remind next, or cancel the action.
 */
bot.command("/remind", ctx => {
  ctx.reply(
    "What do you want me to remind you of?\n\nReply me the item to be reminded of, or cancel the action.",
    Extra.markup(m =>
      m.inlineKeyboard([m.callbackButton("Cancel", "cancelEnterReminder")])
    )
  );
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
  firestore
    .collection("states")
    .doc(getSessionKey(ctx))
    .get()
    .then(docSnapshot => {
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

        ctx.reply(
          `When do you want me to remind you of "${
            ctx.message.text
          }"?\n\nReply me the item to be reminded of, or cancel the action.`,
          Extra.markup(m =>
            m.inlineKeyboard([
              m.callbackButton("Cancel", "cancelEnterReminder")
            ])
          )
        );
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

        // TODO: Reformat text with proper grammar
        ctx.reply(
          `I will remind you of "${
            docSnapshot.data()["tmpReminderName"]
          }" at ${parsedTime}.`
        );

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
