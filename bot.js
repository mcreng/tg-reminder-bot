require("dotenv").config();
const Telegraf = require("telegraf");
const Telegram = require("telegraf/telegram");
const Extra = require("telegraf/extra");

const schedule = require("node-schedule");

const moment = require("moment");
const firebase = require("firebase/app");
const firestore = require("./firestore");
const chrono = require("chrono-node");
const diff = require("deep-diff");
const bot = new Telegraf(process.env.TG_BOT_TOKEN);

// const getNextReminder = async () =>
//   firestore
//     .collection("reminders")
//     .get()
//     .then(async snapshot => {
//       if (!snapshot.empty) {
//         const nextEntry = snapshot.docs
//           .map(doc => {
//             if (!doc.data().items.length) return Infinity;
//             else
//               return doc
//                 .data()
//                 .items.map(item => {
//                   return { id: doc.id, ...item };
//                   // return item;
//                 })
//                 .reduce((prev, curr) => (prev.time < curr.time ? prev : curr));
//           })
//           .reduce((prev, curr) => (prev.time < curr.time ? prev : curr));
//         return nextEntry;
//       }
//     });

// bot.command("/check", ctx => {
//   getNextReminder().then(l => console.log(l));
// });

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

// (async () => {
//   // purge expired reminders
//   await (async () => {
//     var nextReminder = null;
//     while (typeof nextReminder !== undefined) {
//       nextReminder = await getNextReminder();
//       console.log("nextReminder", nextReminder);

//       // no reminders
//       if (typeof nextReminder == "undefined") break;

//       // no more reminders left
//       if (nextReminder === Infinity) break;

//       // removed all expired reminders
//       if (nextReminder.time.seconds >= Date.now() / 1000) break;

//       var { id: nextReminderID, ...nextReminder } = nextReminder;
//       if (nextReminder !== undefined) {
//         firestore
//           .collection("reminders")
//           .doc(nextReminderID)
//           .update({
//             items: await firestore
//               .collection("reminders")
//               .doc(nextReminderID)
//               .get()
//               .then(items => {
//                 console.log("items", items.data().items);
//                 return items
//                   .data()
//                   .items.filter(item => diff(item, nextReminder) !== undefined);
//               })
//           });
//       }
//     }
//   })();

//   nextReminder = await getNextReminder();
//   if (typeof nextReminder !== "undefined" && nextReminder !== Infinity) {
//     schedule.scheduleJob(
//       new Date(
//         nextReminder.time.seconds * 1000 + nextReminder.time.nanoseconds
//       ),
//       async function() {
//         nextReminder = await getNextReminder();
//         // await ctx.reply(
//         telegram.sendMessage(
//           nextReminder.id,
//           `I am here to remind you about '${nextReminder.name}'!`
//         );
//         // );
//       }
//     );
//   }
//   console.log("Initialised.");
// })();

/**
 * /start command.
 */
bot.start(async ctx => {
  await ctx.reply("Welcome!").then(m => (bot.lastMessageID = m.message_id));
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
          bot.telegram.editMessageReplyMarkup(
            repliedTo["chat"],
            repliedTo["msg"],
            (markup = {})
          );
        }

        await ctx
          .reply(
            `When do you want me to remind you of "${ctx.message.text}"?\n\nReply me the item to be reminded of, or cancel the action.`,
            Extra.markup(m =>
              m.inlineKeyboard([
                m.callbackButton("Cancel", "cancelEnterReminder")
              ])
            )
          )
          .then(m => (bot.lastMessageID = m.message_id));
      } else if (docSnapshot.exists && docSnapshot.data()["toEnterDate"]) {
        parsedTime = chrono.parseDate(ctx.message.text);

        // firestore
        //   .collection("reminders")
        //   .doc(getSessionKey(ctx))
        //   .upsert({
        //     items: firebase.firestore.FieldValue.arrayUnion({
        //       name: docSnapshot.data()["tmpReminderName"],
        //       time: parsedTime
        //     })
        //   });
        schedule.scheduleJob(parsedTime, async function() {
          await ctx.reply(
            `I am here to remind you about '${
              docSnapshot.data()["tmpReminderName"]
            }'!`
          );
        });
        console.log(
          `Scheduled reply ${
            docSnapshot.data()["tmpReminderName"]
          } at ${parsedTime}.`
        );

        if (repliedTo) {
          bot.telegram.editMessageReplyMarkup(
            repliedTo["chat"],
            repliedTo["msg"],
            (markup = {})
          );
        }

        await ctx
          .reply(
            `I will remind you of "${
              docSnapshot.data()["tmpReminderName"]
            }" at ${moment(parsedTime).format("HH:mm, Do MMM YYYY")}.`
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
