require("dotenv").config();

const { resolve } = require("path");
const fs = require("fs");
const ffmpeg = require('fluent-ffmpeg');
const youtubedl = require("youtube-dl");
const Telegraf = require("telegraf");
const Queue = require("./helpers/queue");

const downloadQueue = new Queue();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN, {
  telegram: {
    apiRoot: process.env.TELEGRAM_API || "https://api.telegram.org",
  },
});

const createThumb = (pathToVideo) => {
const thumbName = pathToVideo.split('\\').pop().split('/').pop().split('.').slice(0,-1).join('.') + '.jpg';
console.log('thumb', pathToVideo, pathToVideo + '.jpg', thumbName);
  return new Promise((rs) => {
      ffmpeg(pathToVideo).screenshots({
          timestamps: ['50%'],
          filename: thumbName,
		folder: resolve(process.cwd(), 'tmp'),
          scale: 'if(gt(iw,ih),90,trunc(oh*a/2)*2):if(gt(iw,ih),trunc(ow/a/2)*2,90)'
      }).on('end', () => {
          rs(resolve(process.cwd(), 'tmp', thumbName));
      })
  });
}


const defaultVideoParams = [
  "-f",
  "bestvideo+bestaudio/best",
  "-o",
  "./tmp/%(title)s.%(ext)s",
];

const asyncyoutubedl = async (url, args, options) => {
  return new Promise((rs, rj) => {
    youtubedl.exec(url, args, options, function (err, output) {
      if (err) {
        console.log(err); 
        return rj(err);
      }

      rs(output.join("\n"));
    });
  });
};

bot.url((ctx) => {
  downloadQueue.enqueue({
    ctx,
    executor: () => {
      return new Promise(async (rs, rj) => {
        const urls = ctx.message.entities
          .filter(({ type }) => type === "url")
          .slice(0, 1)
          .map(({ offset, length }) =>
            ctx.message.text.substring(offset, offset + length)
          );

        ctx.url = urls[0];
        console.log(ctx.url);

        const info = await asyncyoutubedl(ctx.url, [
          ...defaultVideoParams,   "--get-filename",
        ]);

        const filePath = resolve(process.cwd(), info);
        let thumb = null;
        console.log(filePath);
        try {
          await asyncyoutubedl(ctx.url, defaultVideoParams)
          thumb = await createThumb(filePath);
          await ctx.replyWithVideo({ source: filePath} , { thumb: { source: thumb } });
        } catch (e) {
          console.log(e);
        } finally {
          rs();
          fs.unlinkSync(filePath);
          fs.unlinkSync(thumb);
        }
      });
    },
  });
});

const init = async () => {
  bot.launch();
};

init();
