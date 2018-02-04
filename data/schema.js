import { makeExecutableSchema } from 'graphql-tools';
//import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
//import mocks from './mocks';
import resolvers from './resolvers.js';

const typeDefs = `
type Query {
  user(firstName: String, lastName: String): User
  allUsers: [User]
  getFortuneCookie: String @cacheControl (maxAge: 10)
}

type User {
  id: Int
  firstName: String
  lastName: String
  listings: [Listing]
}

type Listing {
  id: Int
  title: String
  description: String
  views: Int
  user: User
}
`;

const schema = makeExecutableSchema({ typeDefs, resolvers });

//addMockFunctionsToSchema({ schema, mocks });

export default schema;
