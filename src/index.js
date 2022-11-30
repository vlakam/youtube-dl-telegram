require("dotenv").config();

const { resolve } = require("path");
const { existsSync } = require('fs');
const fs = require("fs");
const ffmpeg = require('fluent-ffmpeg');
const youtubedl = require("youtube-dl");
const Telegraf = require("telegraf");
const Queue = require("./helpers/queue");

const downloadQueue = new Queue();

youtubedl.setYtdlBinary(resolve('yt-dlp'))
const bot = new Telegraf(process.env.TELEGRAM_TOKEN, {
  telegram: {
    apiRoot: process.env.TELEGRAM_API || "https://api.telegram.org",
  },
});

const generateFileName = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const createThumb = (pathToVideo) => {
  const thumbName = pathToVideo.split('\\').pop().split('/').pop().split('.').slice(0, -1).join('.') + '.jpg';
  return new Promise((rs, rj) => {
    try {
      ffmpeg(pathToVideo).screenshots({
        timestamps: ['50%'],
        filename: thumbName,
        folder: resolve(process.cwd(), 'tmp'),
        scale: 'if(gt(iw,ih),90,trunc(oh*a/2)*2):if(gt(iw,ih),trunc(ow/a/2)*2,90)'
      }).on('end', () => {
        rs(resolve(process.cwd(), 'tmp', thumbName));
      }).on('error', (e) => {
        rj(`Doesn't look like a video lol`);
      })
    } catch (e) {
      rj(`no thumb: ${e}`);
    }
  });
}


const generateParams = (fileName) => [
  "-f",
  "bestvideo[ext=mp4][height<=1080][vcodec!*=av01]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/bestvideo+bestaudio/best",
  "-o",
  `./tmp/${fileName}.%(ext)s`,
];

const findMyFile = (fileName) => {
  const extensions = ['mp4', 'mkv', 'webm', 'unknown_video'];
  for (const extension of extensions) {
    const path = resolve(process.cwd(), 'tmp', `${fileName}.${extension}`);
    if (existsSync(path)) {
      return {
        path, extension, fileName
      }
    }
  }

  throw Error('Unknown video format (maybe gifs?)');
}

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
  if (ctx.from.id === 2096216057) return;
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
        console.log(ctx.from, ctx.url);

        let filePath = null;
        let thumbPath = null;
        let fileName = generateFileName();

        try {
          await asyncyoutubedl(ctx.url, generateParams(fileName), { timeout: 180000 });
          const { path } = findMyFile(fileName);
          filePath = path;
          console.log(filePath);
          thumbPath = await createThumb(filePath);
          await ctx.replyWithVideo({ source: filePath }, { thumb: { source: thumbPath }, supports_streaming: true });
        } catch (e) {
          console.log(e);
          await ctx.reply(e.message);
        } finally {
          rs();
          filePath && fs.unlinkSync(filePath);
          thumbPath && fs.unlinkSync(thumbPath);
        }
      });
    },
  });
});

const init = async () => {
  bot.launch();
};

init();
