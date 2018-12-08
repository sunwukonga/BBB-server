import { makeExecutableSchema } from 'graphql-tools';
//import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
//import mocks from './mocks';
import resolvers from './resolvers.js';

// loginFacebook will check for a user with the associated email address and facebook id. Create user if not exist, return jwt token for authentication
const typeDefs = `
scalar Date
type Query {
  user(id: Int!): User
  allUsers: [User]
  allImages: [Image]
  allCountries: [Country]
  # Returns all categories as a flat list
  allCategoriesFlat: [Category]
  # Returns all categories as a nested list
  allCategoriesNested: [Category]
  allTemplates(categoryId: Int!): [Template]
  getFortuneCookie: String @cacheControl (maxAge: 10)
  getChatMessages(chatIndexes: [ChatIndex]): [Chat]
  getListing(id: Int!): Listing
  searchTemplates(
    terms: [String]
    categoryIds: [Int]
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

  # For SUPER + ADMIN returns most highly rated
  # For other roles, returns most highly rated, unless content has been added by calling user.
  getContent(
    locusId: Int!
    countryCode: String!
    languageCodes: [String]!
    cascade: Boolean = true
    preferMyContent: Boolean
  ): [Locus]


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
    countryCode: String
  ): LogStatus

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
    categoryId: Int
    templateId: Int
    tagIds: [Int]
    ): Listing

  # Will return false if user not set in Auth header OR user doesn't own listing
  deleteListing(
    listingId: Int!
  ): Boolean

  # Flag a listing for deletion
  flagListingForDeletion(
    # This is the id of a Listing
    listingId: Int!
    # This is the reason for flagging the Listing, i.e. no response from seller, old, dishonest description
    reason: String
  ): Int

  # Cancels deletion flag and confirs a three day protection 
  protectFromDeleteFlag(
    listingId: Int!
  ): Boolean

  likeListing(
    listingId: Int!
    like: Boolean = true
  ): Boolean
  
  incrementViewings( listingId: Int!
  ): Int

  createChat(
    listingId: Int!
  ): Chat

  # Requests that a chat be deleted. If other user has already made this request, the chat is destroyed. If not, only requesting user's messages are deleted and chat is flagged for destruction.
  deleteChat(
    chatId: Int!
  ): Boolean

  sendChatMessage(
    chatId: Int!
    message: String
    image: UploadedImage
    lastMessageId: Int
  ): [ChatMessage]

  # Deletes a chat message. If other user has not yet received the message, they will not.
  deleteChatMessage(
    id: Int!
    lastMessageId: Int = 0
  ): [ChatMessage]

  setProfileImage(
    image: UploadedImage!
  ): Image

  deleteProfileImage: Image

  setProfileName(
    profileName: String!
  ): String

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
    name: Int!
    parentId: Int!
  ): Category

  editCategory(
    id: Int!
    name: String
    parentId: Int
  ): Category

  enableCategory(
    id: Int!
  ): Category

  disableCategory(
    id: Int!
  ): Category

  addTemplate(
    title: String!
    description: String!
    categoryId: Int!
    tagIds: [Int]
    images: [UploadedImage]
  ): Template

  editTemplate(
    id: Int!
    title: String
    description: String
    categoryId: Int
    setTagIds: [Int]
    addTagIds: [Int]
    setImages: [UploadedImage]
    addImages: [UploadedImage]
  ): Template

  enableTemplate(
    id: Int!
  ): Category

  disableTemplate(
    id: Int!
  ): Category

  # SUPER Only [Returns contentAnchorId]
  createLocus(
    name: String!
    parentId: Int
  ): Int

  # SUPER Only
  setContentToLocus(
    contentId: Int!
    locusId: Int!
  ): Int 

  # SUPER + ADMIN Only [Returns: countryContentId]
  createContent(
    meaning: String!
    locusId: Int!
    # Required for SUPER, ignored for ADMIN
    countryIsoCode: String!
  ): Int

  # SUPER + ADMIN Only [Warning: for small changes only. Non-trackable]
  # If a large edit, or a change of meaning is required. Create new content. 
  editContent(
    meaning: String!
    countryContentId: Int!
  ): Content

  # SUPER + ADMIN
  # Will fail if attached to locus, or rating too high
  deleteContent(
    contentId: Int
  ): Boolean

  createTranslation(
    text: String!
    contentId: Int!
    iso639_2: String!
  ): Translation

  editTranslation(
    text: String!
    parentId: Int!
  ): Translation

  rateContent(
    contentId: Int!
    good: Boolean!
    comment: String
  ): Rating

  unrateContent(
    ratingId: Int! 
  ): Boolean
 
  rateRating(
    ratingId: Int!
    good: Boolean!
    comment: String
  ): Rating

  unrateRating(
    ratingId: Int!
  ): Boolean

  rateTranslation(
    translationId: Int!
    good: Boolean!
    comment: String = ""
  ): Rating

  unrateTranslation(
    ratingId: Int!
  ): Boolean

  # Deletion will only succeed if it is NOT the current default.
  deleteTranslation(
    translationId: Int!
  ): Boolean
}

type User {
  id: Int
  firstName: String
  lastName: String
  profileName: String
  nameChangeCount: Int
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
  id: Int
  lineOne: String
  lineTwo: String
  postcode: String
  longitude: Float
  latitude: Float
  directions: String
}

input Postage {
  id: Int
  postCurrency: String!
  postCost: Float!
}

type Image {
  id: Int
  imageKey: String
  imageURL: String
}

type Category {
  id: Int
  name: String
  children: [Category]
}

type Tag {
  id: Int
  name: String!
}

type Template {
  id: Int
  title: String!
  description: String
  primaryImage: Image
  secondaryImages: [Image]
  categoryId: Int!
  tags: [Tag]
}

type BarterOption {
  id: Int
  template: Template
  quantity: Int
  tags: [Tag]
}

type Locus {
  id: Int
  name: String!
  parentId: Int!
  children: [Locus]
  content: [Content]
}

type Content {
  id: Int
  meaning: String!
  author: User
  authorId: Int
  country: Country
  countryId: Int
  translations: [Translation]
  ratings: [Rating]
}

type Translation {
  id: Int
  text: String!
  languageId: String!
  translatorId: Int!
  contentId: Int
  ratings: [Rating]
}

type Rating {
  id: Int
  good: Boolean!
  weight: Int!
  comment: String
  ratings: [Rating]
  contentId: Int
  translationId: Int
}


input UploadedImage {
  imageId: Int!
  imageKey: String
  primary: Boolean!
  deleted: Boolean!
}

input TemplateQty {
  templateId: Int!
  quantity: Int!
  tags: [Int]
}

input ChatIndex {
  chatId: Int!
  lastMessageId: Int = 0
}

input Filters {
  # SALE, DONATE, BARTER, SALEBARTER
  mode: String
  # Mandatory field. Selects country.
  countryCode: String!
  # Number of seconds (not milliseconds) to search into the past.
  seconds: Int
  # Rating:  1 -> 000001 (base 2) -> [0] stars
  # Rating:  3 -> 000011 -> [0,1] stars
  # Rating:  8 -> 001000 -> [3] stars
  # Rating: 12 -> 001100 -> [3,2] stars
  rating: Int = 63
  # Minimum verification is 1. 
  # Verification: 28 -> 11100 -> [5,4,3] stars
  verification: Int = 31
  # Not yet implemented.
  distance: Int
  priceMax: Float
  priceMin: Float
  # List of categoryIds to include in search. Sub categories automatically included. If id invalid, id ignored.
  categories: [Int]
  # List of templateIds. If id invalid, id ignored.
  templates: [Int]
  # List of tagIds.
  tags: [Int]
  counterOffer: Boolean
}

type Chat {
  id: Int
  initUser: User
  listing: Listing
  userId: Int
  delRequestUserId: Int
  chatMessages: [ChatMessage]
  initUserAddress: String
  recUserAddress: String
}

type ChatMessage {
  id: Int
  message: String
  image: Image
  authorId: Int
  time: Date
}

type Listing {
  id: Int
  title: String
  description: String
  primaryImage: Image
  secondaryImages: [Image]
  saleMode: SaleMode
  template: Template
  categoryId: Int
  category: Category
  tags: [Tag]
  viewers: Int
  likes: Int
  liked: Boolean
  chatId: Int
  user: User
}

type SaleMode {
  id: Int!
  mode: String!
  price: Float
  counterOffer: Boolean
  currency: Currency
  barterOptions: [[BarterOption]]
  exchangeModes: [ExchangeMode]
}

type ExchangeMode {
  id: Int
  mode: String
  price: Float
  currency: Currency
  location: Location
}

type Currency {
  iso4217: String
  currencyName: String
  currencySymbol: String
  symbolPrepend: String
  disabled: Boolean
}

type LogStatus {
  token: String
  user: User
}

type SignedUrl {
  id: Int!
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
