FROM jrottenberg/ffmpeg:4.1-ubuntu

USER root

RUN apt-get update
RUN apt-get -y install curl gnupg python locales
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && \
    locale-gen
ENV LANG en_US.UTF-8  
ENV LANGUAGE en_US:en  
ENV LC_ALL en_US.UTF-8  
RUN curl -sL https://deb.nodesource.com/setup_14.x  | bash -
RUN apt-get -y install nodejs wget
RUN node -v
RUN npm -v
RUN apt-get clean autoclean
RUN apt-get autoremove --yes
RUN rm -rf /var/lib/{apt,dpkg,cache,log}/

ENV NODE_WORKDIR /home/node/app

WORKDIR $NODE_WORKDIR
RUN wget https://github.com/yt-dlp/yt-dlp/releases/download/2022.11.11/yt-dlp
RUN chmod +x ./yt-dlp
ADD . $NODE_WORKDIR
RUN mkdir -p $NODE_WORKDIR/tmp

RUN npm install

ENTRYPOINT [ "npm", "start" ]
