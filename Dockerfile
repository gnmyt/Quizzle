FROM node:18-alpine AS build
RUN apk add g++ make cmake python3

WORKDIR /quizzle

COPY ./webui ./webui
COPY ./server ./server
COPY ./package.json ./package.json

RUN yarn install
RUN cd webui && yarn install --force
RUN cd webui && yarn run build
RUN mv /quizzle/webui/dist /quizzle

FROM node:18-alpine

RUN apk add --no-cache tzdata

ENV NODE_ENV=production
ENV TZ=Etc/UTC

WORKDIR /quizzle

COPY --from=build /quizzle/dist /quizzle/dist
COPY --from=build /quizzle/server /quizzle/server
COPY --from=build /quizzle/node_modules /quizzle/node_modules
COPY --from=build /quizzle/package.json /quizzle/package.json

VOLUME ["/quizzle/data"]

EXPOSE 6412

CMD ["node", "server"]