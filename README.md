# Telegram Reminder Bot

This is a telegram bot which users can set reminders.

## Setup

1. Setup your own bot in [Botfather](https://telegram.me/botfather).
2. Fill in the details in `.env.example` and rename it as `.env`.
3. Install dependencies.

   ```bash
   npm install
   ```

4. Run by

   ```bash
   npm start
   ```

   or develop by

   ```bash
   npm run dev
   ```

## Caveat
This bot uses in-memory scheduling, which might not be scalable. I originally planned to use Firebase for this purpose, but it turns out to be very complicated, or at least I couldn't find a good way to achieve this. It should be possible to improve this by using a database scheduler, like [bee-queue](https://github.com/bee-queue/bee-queue), but I am too lazy haha. This project was originally only meant to try out the Telegram API anyway.