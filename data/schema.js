import { makeExecutableSchema } from 'graphql-tools';
//import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
//import mocks from './mocks';
import resolvers from './resolvers.js';

// loginFacebook will check for a user with the associated email address and facebook id. Create user if not exist, return jwt token for authentication
const typeDefs = `
type Query {
  user(id: Int, firstName: String, lastName: String): User
  allUsers: [User]
  allImages: [Image]
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
    currency: String!
    cost: Float
    counterOffer: Boolean
    barterTemplates: [[TemplateQty]]
    address: Address
    post: Postage
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

type Location {
  lineOne: String
  lineTwo: String
  postcode: String
  long: Float
  lat: Float
  directions: String
}

input Postage {
  postCurrency: String!
  postCost: Float!
}

type Image {
  id: String
  imageURL: String
}

type Category {
  name: String
}

type Tag {
  name: String!
}

type Template {
  title: String!
  description: String!
  primaryImage: Image
  secondaryImages: [Image]
  tags: [Tag]
}

type BarterOption {
  template: Template
  quantity: Int
  tags: [Tag]
}

input UploadedImage {
  imageId: String!
  imageKey: String!
  primary: Boolean!
  deleted: Boolean!
}

input TemplateQty {
  templateId: String!
  quantity: Int!
  tags: [String]
}

type Chat {
  initUser: User
  recUser: User
  listing: Listing
  initUserAddress: String
  recUserAddress: String
}

type Listing {
  id: String
  title: String
  description: String
  primaryImage: Image
  secondaryImages: [Image]
  saleMode: SaleMode
  template: Template
  tags: [Tag]
  views: Int
  user: User
}

type SaleMode {
  mode: String!
  price: Float
  counterOffer: Boolean
  currency: Currency
  barterOptions: [[BarterOption]]
  exchangeModes: [ExchangeMode]
}

type ExchangeMode {
  mode: String!
  price: Float
  currency: Currency
  location: Location
}

type Currency {
  currency: String!
  currencySymbol: String
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

`;

const schema = makeExecutableSchema({ typeDefs, resolvers });

//addMockFunctionsToSchema({ schema, mocks });

export default schema;
