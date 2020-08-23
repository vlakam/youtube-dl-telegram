class Deferred {
  constructor() {
    this.resolve = null;
    this.reject = null;
    this.promise = new Promise((rs, rj) => {
      this.resolve = rs;
      this.reject = rj;
    });
  }

  getPromise() {
    return this.promise;
  }
}

class Queue {
  queue = [];

  maxParallel;
  active = 0;
  constructor(maxParallel = 1) {
    this.maxParallel = maxParallel;
  }

  enqueue({ ctx, executor }) {
    new Promise(async (rs) => {
      if (++this.active > this.maxParallel) {
        const message = await ctx.reply("in queue");
        const queueObj = { ctx, message, executor, promise: new Deferred() };
        this.queue.push(queueObj);
        await queueObj.promise.getPromise();
        await ctx.telegram.deleteMessage(message.chat.id, message.message_id);
      }

      try {
        await executor();
      } catch (e) {
        console.log("rofl", e);
      } finally {
        this.active--;
        if (this.queue.length) {
          this.queue.shift().promise.resolve();
        }
        this.notifyQueue();
        rs();
      }
    });
  }

  async notifyQueue() {
    for (const idx in this.queue) {
      const { message, ctx } = this.queue[idx];
      await ctx.telegram.editMessageText(
        message.chat.id,
        message.message_id,
        null,
        `queue pos: ${idx + 1}`
      );
    }
  }
}

module.exports = Queue;
