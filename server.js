/*
import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  // In production, the production environment should control these variables.
  dotenv.config()
}
*/
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
const adminJWT = expressJWT({ secret: process.env.JWT_ADMIN_SECRET_KEY })
const normalJWT = expressJWT({ secret: process.env.JWT_SECRET_KEY })
	/*
const token = jwt.sign({
  "userid": "" 
, "roles": [
    "BARGAINER"
  ]   
, "countryCode": 'SG'
}, process.env.JWT_SECRET_KEY, { noTimestamp: true } );

const adminToken = jwt.sign({
  "userid": "" 
, "roles": [
    "BARGAINER"
  ]   
, "countryCode": 'SG'
}, process.env.JWT_ADMIN_SECRET_KEY, { noTimestamp: true } );
console.log("token: ", token)
console.log("AdminToken: ", adminToken)
*/

// This must be the first middleware
graphQLServer.use(engine.expressMiddleware())
graphQLServer.use(compression())
graphQLServer.use(
    '/graphql'
  , bodyParser.json()
  , normalJWT
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
    }))
graphQLServer.use('/graphiql', normalJWT, graphiqlExpress({ endpointURL: '/graphql' }));
graphQLServer.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    res.status(200).send({ errors: [{code: 209, message: "Invalid Token." }]})
  }
});
graphQLServer.listen(GRAPHQL_PORT, () =>
  console.log(
    `GraphiQL is now running on http://localhost:${GRAPHQL_PORT}/graphiql`
  )
);
