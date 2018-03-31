import { makeExecutableSchema } from 'graphql-tools';
//import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
//import mocks from './mocks';
import resolvers from './resolvers.js';

// loginFacebook will check for a user with the associated email address and facebook id. Create user if not exist, return jwt token for authentication
const typeDefs = `
type Query {
  user(id: Int, firstName: String, lastName: String): User
  allUsers: [User]
  getFortuneCookie: String @cacheControl (maxAge: 10)
}

type Mutation {
  addListing(
    title: String!
    saleMode: String!
    description: String
    numberImages: Int
    salePrice: Float
    currency: String
  ): Listing

  loginFacebook(
    token: String!
  ): String
}

type User {
  id: Int
  firstName: String
  lastName: String
  profileName: String
  profileImage: Image
  listings: [Listing]
  liked: [Listing]
  chats: [Chat]
  country: Country
  online: Boolean
  idVerification: Int
  sellerRating: Int
  sellerRatingCount: Int
}

type Country {
  isoCode: String
  name: String
  currency: String
  tld: String
  language: String
}

type Image {
  imageURL: String
}

type Chat {
  initUser: User
  recUser: User
  listing: Listing
  createdAt: Int
  initUserAddress: String
  recUserAddress: String
}

type Listing {
  id: Int
  title: String
  description: String
  primaryImage: Image
  secondaryImages: [Image]
  saleMode: String
  salePrice: Float
  currency: String
  currencySymbol: String
  views: Int
  user: User
}

type LogStatus {
  result: String
}

type SaleMode {
  mode: String
  currency: String
  salePrice: Int
  barterItems: [Listing]
}
`;

const schema = makeExecutableSchema({ typeDefs, resolvers });

//addMockFunctionsToSchema({ schema, mocks });

export default schema;
