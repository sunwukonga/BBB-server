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
  allCountries: [Country]
  # Returns all categories as a flat list
  allCategoriesFlat: [Category]
  # Returns all categories as a nested list
  allCategoriesNested: [Category]
  allTemplates(categoryId: String!): [Template]
  getFortuneCookie: String @cacheControl (maxAge: 10)
  getChatMessages(chatIndexes: [ChatIndex]): [Chat]
  getListing(id: String): Listing
  searchTemplates(
    terms: [String]
    categoryId: String!
    countryCode: String!
    limit: Int = 20
    page: Int = 1
  ): [Template]
  searchListings(
    # Each string is stripped of anything not [A-Za-z_]. Each array element is used to search both title and description. 
    terms: [String]
    # Limits the result set.
    limit: Int = 20
    # Selects which page of limited result sets should be returned.
    page: Int = 1
    # Mechanism for limiting results to particular categories, templates, price ranges, etc. Country selection is mandatory and nested in here.
    filters: Filters!
  ): [Listing]
  getProfile: User

  getMostRecentListings(countryCode: String!, limit: Int = 20, page: Int = 1): [Listing]
  getMostVisitedListings(countryCode: String!, limit: Int = 20, page: Int = 1): [Listing]
  getMostLikedListings(countryCode: String!, limit: Int = 20, page: Int = 1): [Listing]

  getUserVisitedListings(countryCode: String!, limit: Int = 20, page: Int = 1): [Listing]
  getUserLikedListings(countryCode: String!, limit: Int = 20, page: Int = 1): [Listing]
  getUserPostedListings(countryCode: String!, limit: Int = 20, page: Int = 1): [Listing]
  

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
    countryId: String
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
    countryCode: String!
    barterTemplates: [[TemplateQty]]
    address: Address
    post: Postage
    title: String
    description: String
    category: String
    template: String
    tags: [String]
    ): Listing
  
  # Flag a listing for deletion
  flagListingForDeletion(
    # This is the id of a Listing
    listingId: String!
    # This is the reason for flagging the Listing, i.e. no response from seller, old, dishonest description
    reason: String
  ): Int
  
  # Cancels deletion flag and confirs a three day protection 
  protectFromDeleteFlag(
    listingId: String!
  ): Boolean

  likeListing(
    listingId: String!
    like: Boolean = true
  ): Boolean
  
  incrementViewings(
    listingId: String!
  ): Int

  createChat(
    recUserId: String
    listingId: String
  ): Chat

  sendChatMessage(
    chatId: String!
    message: String
    image: UploadedImage
    lastMessageId: String
  ): [ChatMessage]

  deleteChatMessage(
    id: String
    lastMessageId: String = 0
  ): [ChatMessage]

  addCountry(
    isoCode: String!
    name: String!
    tld: String!
    languageIds: [String]
    currencyIds: [String]
  ): Country

  editCountry(
    isoCode: String!
    name: String
    tld: String
    addLanguageIds: [String]
    addCurrencyIds: [String]
    setLanguageIds: [String]
    setCurrencyIds: [String]
  ): Country

  enableCountry(
    isoCode: String!
  ): Country

  disableCountry(
    isoCode: String!
  ): Country

  addLanguage(
    iso639_2: String!
    name: String!
  ): Language

  editLanguage(
    iso639_2: String!
    name: String!
  ): Language

  enableLanguage(
    iso639_2: String!
  ): Language

  disableLanguage(
    iso639_2: String!
  ): Language

  addCurrency(
    iso4217: String!
    currencyName: String!
    currencySymbol: String!
    symbolPrepend: String
  ): Currency

  editCurrency(
    iso4217: String!
    currencyName: String
    currencySymbol: String
    symbolPrepend: String
  ): Currency

  enableCurrency(
    iso4217: String!
  ): Currency

  disableCurrency(
    iso4217: String!
  ): Currency

  addCategory(
    name: String!
    parentId: String!
  ): Category

  editCategory(
    id: String!
    name: String
    parentId: String
  ): Category

  enableCategory(
    id: String!
  ): Category

  disableCategory(
    id: String!
  ): Category

  addTemplate(
    title: String!
    description: String!
    categoryId: String!
    tagIds: [String]
    images: [UploadedImage]
  ): Template

  editTemplate(
    id: String!
    title: String
    description: String
    categoryId: String
    setTagIds: [String]
    addTagIds: [String]
    setImages: [UploadedImage]
    addImages: [UploadedImage]
  ): Template

  enableTemplate(
    id: String!
  ): Category

  disableTemplate(
    id: String!
  ): Category

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
  currencies: [Currency]
  tld: String
  languages: [Language]
}

type Language {
  iso639_2: String
  name: String
  disabled: Boolean
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
  id: String
  name: String
  children: [Category]
}

type Tag {
  name: String!
}

type Template {
  id: String
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
  imageKey: String
  primary: Boolean!
  deleted: Boolean!
  exists: Boolean!
}

input TemplateQty {
  templateId: String!
  quantity: Int!
  tags: [String]
}

input ChatIndex {
  chatId: String!
  lastMessageId: String = 0
}

input Filters {
  # SALE, DONATE, BARTER, SALEBARTER
  mode: String
  # Mandatory field. Selects country.
  countryCode: String!
  # Number of seconds (not milliseconds) to search into the past.
  seconds: Int
  # Rating:  1 -> 000001 (base 2) -> [0] stars<br />
  # Rating:  3 -> 000011 -> [0,1] stars<br />
  # Rating:  8 -> 001000 -> [3] stars<br />
  # Rating: 12 -> 001100 -> [3,2] stars<br />
  rating: Int = 63
  # Minimum verification is 1. 
  # Verification: 28 -> 11100 -> [5,4,3] stars
  verification: Int = 31
  # Not yet implemented.
  distance: Int
  priceMax: Float
  priceMin: Float
  # List of categoryId's to include in search. If an id invalid, ignored. If all invalid, search ALL categories 
  categories: [String]
  # List of templateId's. Same behavior as categories.
  templates: [String]
  # List of tagId's. Same behavior as categories.
  tags: [String]
  counterOffer: Boolean
}

type Chat {
  id: String
  initUser: User
  recUser: User
  listing: Listing
  chatMessages: [ChatMessage]
  initUserAddress: String
  recUserAddress: String
}

type ChatMessage {
  id: String
  message: String
  image: Image
  authorId: String
  time: Int
}

type Listing {
  id: String
  title: String
  description: String
  primaryImage: Image
  secondaryImages: [Image]
  saleMode: SaleMode
  template: Template
  category: Category
  tags: [Tag]
  viewers: Int
  likes: Int
  liked: Boolean
  chatExists: Boolean
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
  iso4217: String!
  currencyName: String!
  currencySymbol: String!
  symbolPrepend: String
  disabled: Boolean
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
