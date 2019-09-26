FROM node:10.16.3-alpine
RUN mkdir -p /home/node/kiel-parksensors-application-mashup/node_modules && chown -R node:node /home/node/kiel-parksensors-application-mashup
WORKDIR /home/node/kiel-parksensors-application-mashup
COPY package*.json /home/node/kiel-parksensors-application-mashup/
USER node
RUN npm install
COPY --chown=node:node . /home/node/kiel-parksensors-application-mashup
CMD node index.js
