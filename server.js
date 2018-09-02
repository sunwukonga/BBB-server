import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  // In production, the production environment should control these variables.
  dotenv.config();
}
import express from 'express';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import bodyParser from 'body-parser';
import schema from './data/schema';
import compression from 'compression';
import { Engine } from 'apollo-engine';
import { formatError } from 'apollo-errors';
import roles from './data/constants/roles'
import jwt from 'jsonwebtoken';
import fs from 'fs';

const expressJWT = require('express-jwt');
const jwtDecode = require('jwt-decode');

const GRAPHQL_PORT = 3000;
const ENGINE_API_KEY = process.env.ENGINE_API_KEY;

const engine = new Engine({
    engineConfig: {
        apiKey: ENGINE_API_KEY
      , stores: [{
          name: 'inMemEmbeddedCache',
          inMemory: {
            cacheSize: 20971520 // 20 MB
          }
        }]
      , queryCache: {
            publicFullQueryStore: 'inMemEmbeddedCache'
        }
    }
  , graphqlPort: GRAPHQL_PORT
});
engine.start();

const graphQLServer = express();

// This must be the first middleware
graphQLServer.use(engine.expressMiddleware());
graphQLServer.use(compression());
//jwt takes authorization header and puts decoded token in req.user
graphQLServer.use(
  expressJWT({
      secret: process.env.JWT_SECRET_KEY
    , credentialsRequired: false
  })
  .unless({
      path: ['/graphiql']
  })
);
graphQLServer.use(
  expressJWT({
      secret: process.env.JWT_ADMIN_SECRET_KEY
    , credentialsRequired: false
  })
  .unless({
      path: ['/graphql']
  })
);
graphQLServer.use(
    '/graphql'
  , bodyParser.json()
  , graphqlExpress(req => {
      return {
          schema: schema
        , formatError: formatError
        , tracing: true
        , cacheControl: true
        , context: {
              userid: req.user.userid
            , roles: req.user.roles
            , countryCode: req.user.countryCode
          }
      };
    }));
graphQLServer.use('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));

graphQLServer.listen(GRAPHQL_PORT, () =>
  console.log(
    `GraphiQL is now running on http://localhost:${GRAPHQL_PORT}/graphiql`
  )
);
