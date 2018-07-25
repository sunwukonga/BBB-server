import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  // In production, the production environment should control these variables.
  dotenv.config();
  //require('dotenv').load();
}
import express from 'express';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import bodyParser from 'body-parser';
import schema from './data/schema';
import compression from 'compression';
import { Engine } from 'apollo-engine';
import { formatError } from 'apollo-errors';
//import jwt from 'jwt-express';
//const jwt = require('jsonwebtoken');
import jwt from 'jsonwebtoken';

import fs from 'fs';
   // const fs = require('fs');

const expressJWT = require('express-jwt');
const jwtDecode = require('jwt-decode');
//import jwt_decode from 'jwt-decode';

//const jwtMiddleware = expressJWT({ secret: process.env.JWT_SECRET_KEY });
//const getUserFromJwt = (req, res, next) => {
//  const authHeader = req.headers.authorization;
//  req.test = jwtDecode(authHeader);
//  next();
//}
const token = jwt.sign({
    "userid": ""
  , "roles": [
      "GENERAL"
    ]
  }, process.env.JWT_SECRET_KEY );

console.log('Token: ' + token);
console.log('Decoded: ' + jwtDecode(token));
console.log(jwtDecode(token));

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
  /*.unless({
      path: ['/graphiql']
  }) */
);
graphQLServer.use(
    '/graphql'
  , bodyParser.json()
  , graphqlExpress(req => {
    /*
      let cache = [];
      fs.writeFile("./test.log"
        , JSON.stringify(req, function(key, value) {
          if (typeof value === 'object' && value !== null) {
              if (cache.indexOf(value) !== -1) {
                  return;
              }
              cache.push(value);
          }
          return value;
        }, 4)
        , function(err) {
          if(err) {
              return console.log(err);
          }
          console.log("The file was saved!");
      });
      cache = null;
      */
      //console.log("Request: ", req.user);
      return {
          schema: schema
        , formatError: formatError
        , tracing: true
        , cacheControl: true
        , context: {
              userid: req.user.userid
            , roles: req.user.roles
          }
      };
    }));
graphQLServer.use('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));

graphQLServer.listen(GRAPHQL_PORT, () =>
  console.log(
    `GraphiQL is now running on http://localhost:${GRAPHQL_PORT}/graphiql`
  )
);
