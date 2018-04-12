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
import CryptoJS from 'crypto-js';

function createOpaqueUniqueImageKey(imageId) {

	const key = CryptoJS.enc.Hex.parse("6162636431323334");
	const iv = CryptoJS.enc.Hex.parse("696e707574766563");
    const encrypted = CryptoJS.DES.encrypt(imageId, key,  { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7  });
    return encrypted.ciphertext.toString();
}
const imageKey = createOpaqueUniqueImageKey('1234520523');
console.log("ImageKey ", imageKey);

import AWS from 'aws-sdk';
AWS.config.update({ accessKeyId: process.env.S3_USER_KEY_ID, secretAccessKey: process.env.S3_USER_SECRET_KEY, region: 'ap-southeast-1' })
const s3 = new AWS.S3();

const imageTest = s3.createPresignedPost({
    Bucket: 'bbb-app-images'
  , Conditions: [
       ["content-length-range", 0, 524288 ]
	]
  , Fields: { 
	  key: 'somerandomlygeneratedalphanumeric'
    }
  , ContentType: 'image/jpeg'
  }, function(err, data) { 
  if (err) { 
	   console.error('Presigning post data encountered an error', err); }   
  else { 
		console.log('The post data is', data); 
		 } 
});
console.log('S3 image data: ');
console.log(imageTest);
const expressJWT = require('express-jwt');
const jwtDecode = require('jwt-decode');
//import jwt_decode from 'jwt-decode';

const jwtMiddleware = expressJWT({ secret: process.env.JWT_SECRET_KEY });
//const getUserFromJwt = (req, res, next) => {
//  const authHeader = req.headers.authorization;
//  req.test = jwtDecode(authHeader);
//  next();
//}
const token = jwt.sign({
    "userid": ""
  , "role": [
      {
         "name": "GENERAL"
      }
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
  }).unless({
      path: ['/graphiql']
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
              userid: req.userid
//            , test: req.test
      }};
    }));
graphQLServer.use('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));

graphQLServer.listen(GRAPHQL_PORT, () =>
  console.log(
    `GraphiQL is now running on http://localhost:${GRAPHQL_PORT}/graphiql`
  )
);
