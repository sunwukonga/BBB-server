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

  getSignedUrl(
    imageType: String!
  ): SignedUrl

  createListing(
    mode: String!
    images: [UploadedImage]
    currency: String
    cost: Float
    counterOffer: Boolean
    barterTemplates: [[TemplateQty]]
    address: Address
    postCurrency: String
    postCost: Float
    title: String
    description: String
    category: String
    template: String
    tags: [String]
    ): Listing

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

input Address {
  lineOne: String
  lineTwo: String
  postcode: String
  long: Float
  lat: Float
  directions: String
}

type Image {
  imageURL: String
}

type Category {
  name: String
}

type Template {
  title: String!
  description: String!
  primaryImage: Image
  secondaryImages: [Image]
  tags: [String]
}

input UploadedImage {
  imageId: String!
  imageKey: String!
  deleted: Boolean!
}

input TemplateQty {
  templateId: String
  quantity: Int
}

type Chat {
  initUser: User
  recUser: User
  listing: Listing
  initUserAddress: String
  recUserAddress: String
}

type Listing {
  title: String
  description: String
  primaryImage: Image
  secondaryImages: [Image]
  saleMode: String
  salePrice: Float
  currency: String
  currencySymbol: String
  template: Template
  views: Int
  user: User
}

type LogStatus {
  result: String
}

type SignedUrl {
  id: String!
  key: String!
  bucket: String!
  X_Amz_Algorithm: String!
  X_Amz_Credential: String!
  X_Amz_Date: String!
  policy: String!
  X_Amz_Signature: String!
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
