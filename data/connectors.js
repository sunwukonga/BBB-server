import Sequelize from 'sequelize';
import casual from 'casual';
import _ from 'lodash';
import Mongoose from 'mongoose';
import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';
import AWS from 'aws-sdk';

const BBB_BUCKET = 'bbb-app-images';
const FortuneCookie = {
  getOne() {
    return fetch('http://fortunecookieapi.herokuapp.com/v1/cookie')
      .then(res => res.json())
      .then(res => {
        return res[0].fortune.message;
      });
  },
};

const Facebook = {
  login( args ) {
             //`https://graph.facebook.com/me?access_token=${args.token}&fields=id,name,email,picture.type(large)`
    return fetch(`https://graph.facebook.com/me?access_token=${args.token}&fields=id,name,email,picture`)
      .then(res => { return res.json() });
  },
};

function createOpaqueUniqueImageKey(imageId) {
    let imageString = imageId.toString()
  imageString.padStart(10, '0')
  const key = CryptoJS.enc.Hex.parse("6162636431323334");
  const iv = CryptoJS.enc.Hex.parse("696e707574766563");
    const encrypted = CryptoJS.DES.encrypt(imageString, key,  { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7  });
    return encrypted.ciphertext.toString();
}

AWS.config.update({ accessKeyId: process.env.S3_USER_KEY_ID, secretAccessKey: process.env.S3_USER_SECRET_KEY, region: 'ap-southeast-1' })
const s3 = new AWS.S3();

const AWSS3 = {
  async getSignedUrl( args ) {
    return await ImageModel.create({})
      .then( image => createOpaqueUniqueImageKey(image.id) )
      .then( uniqKey => s3.createPresignedPost({
        Bucket: BBB_BUCKET
        , Conditions: [
           ["content-length-range", 0, 262144],
           [ "eq", "$acl", "public-read" ]
        ]
        , Fields: {
          key: uniqKey
        }
        , ContentType: args.imageType
        }))
      .then( data => {
        image.imageKey = data.fields.key;
        image.save();
        console.log("data: ", data)
        return {
            id: image.id
          , key: data.fields.key
          , bucket: data.fields.bucket
          , X_Amz_Algorithm: data.fields['X-Amz-Algorithm']
          , X_Amz_Credential: data.fields['X-Amz-Credential']
          , X_Amz_Date: data.fields['X-Amz-Date']
          , policy: data.fields.Policy
          , X_Amz_Signature: data.fields['X-Amz-Signature']
        }
      })
  },
  async deleteObject( key ) {
    return await s3.deleteObject({
        Bucket: BBB_BUCKET,
        Key: key
      });
  },
};


Mongoose.Promise = global.Promise;

const mongo = Mongoose.connect('mongodb://localhost/views', {
  useMongoClient: true
});

const db = new Sequelize('market', null, null, {
  dialect: 'sqlite',
  storage: './market.sqlite',
  operatorsAliases: false,  // Gets rid of the warning.
});

const UserModel = db.define('user', {
  firstName: { type: Sequelize.STRING },
  lastName: { type: Sequelize.STRING },
  profileName: { type: Sequelize.STRING },
  idVerification: { type: Sequelize.TINYINT },
  sellerRating: { type: Sequelize.TINYINT },
  sellerRatingCount: { type: Sequelize.INTEGER },
  token: { type: Sequelize.STRING },
});

const ListingModel = db.define('listing', {
  title: { type: Sequelize.STRING },
  description: { type: Sequelize.STRING },
});

const SaleModeModel = db.define('salemode', {
  mode: { type: Sequelize.STRING },
  price: { type: Sequelize.FLOAT },
  counterOffer: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
});

const TemplateModel = db.define('template', {
  title: { type: Sequelize.STRING },
  description: { type: Sequelize.STRING },
});

const TagModel = db.define('tag', {
  name: { type: Sequelize.STRING },
});

const ChatModel = db.define('chat', {
  initUserAddress: { type: Sequelize.STRING },
  recUserAddress: { type: Sequelize.STRING },
},{
  timestamps: true
});

const ChatMessageModel = db.define('chatmessage', {
  message: { type: Sequelize.STRING },
});

const CountryModel = db.define('country', {
  isoCode: { type: Sequelize.STRING, primaryKey: true },
  name: { type: Sequelize.STRING },
  tld: { type: Sequelize.STRING },
});
// TODO: Link language and currency to CountryModel
const LanguageModel = db.define('language', {
  name: { type: Sequelize.STRING },
});
const CurrencyModel = db.define('currency', {
  currency: { type: Sequelize.STRING },
  currencySymbol: { type: Sequelize.STRING },
});
const CategoryModel = db.define('category', {
  name: { type: Sequelize.STRING },
});
const LocationModel = db.define('location', {
  latitude: { type: Sequelize.FLOAT },
  longitude: { type: Sequelize.FLOAT },
  lineOne: { type: Sequelize.STRING },
  lineTwo: { type: Sequelize.STRING },
  postcode: { type: Sequelize.STRING },
  description: { type: Sequelize.STRING },
});

const EmailModel = db.define('email', {
  email: { type: Sequelize.STRING },
  primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  //TODO: probably needs a verification code to match against.
});
const OauthModel = db.define('oauth', {
  provider: { type: Sequelize.STRING, allowNull: false },
  uid: { type: Sequelize.STRING, allowNull: false },
  name: { type: Sequelize.STRING },
  email: { type: Sequelize.STRING },
  picture: { type: Sequelize.STRING },
});

const BarterOptionModel = db.define('barterOption', {
  /*
  key: {
    type: Sequelize.INTEGER,
    allowNull: false,
    autoIncrement: true,
    unique: true
  }
  */
});
const ExchangeModeModel = db.define('exchangeMode', {
  mode: { type: Sequelize.STRING }, //F2F or Post
  price: { type: Sequelize.FLOAT },
});
// Later associate images with templates
const ImageModel = db.define('image', {
  imageURL: { type: Sequelize.STRING },
  imageKey: { type: Sequelize.STRING },
  // flagging
  // ratings
  // author
  // template
});

// Join table for ListingModel and ImageModel
const ListingImagesModel = db.define('listingImages', {
  primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false  },  // Only one TRUE ONCE for each listingId. Not constrained here.
});
// Join table for BarterOptionModel and Template
const BarterOptionTemplatesModel = db.define('barterOptionTemplates', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
});
//const BarterGroupModel = db.define('barterGroup');

// ****************************
// Relationships between tables
// ****************************

// User Model
ListingModel.belongsTo(UserModel, {as: 'user'});
UserModel.belongsToMany(ListingModel, {as: 'Like', through: 'listingLikes'}); // UserModel.createLike, getLikes, setLikes, addLike,addLikes
CountryModel.hasMany(UserModel, {as: 'User', foreignKey: 'country'});
UserModel.hasMany(EmailModel);
UserModel.hasMany(OauthModel);
UserModel.belongsTo(ImageModel, {as: 'profileImage'});
//UserModel.belongsTo(CountryModel, {foreignKey: 'country', targetKey: 'isoCode'});
// Listing Model
UserModel.hasMany(ListingModel); //UserModel has setListingModel method; ListingModel has a userId foreign key
ListingModel.belongsToMany(UserModel, {as: 'Like', through: 'listingLikes'});// ListingModel.createLike, getLikes, setLikes, addLike,addLikes
CategoryModel.hasMany(CategoryModel, {as: 'Children'})
CategoryModel.belongsTo(CategoryModel, {as: 'parent'})
CategoryModel.hasMany(ListingModel, {as: 'listing'});
ListingModel.belongsTo(CategoryModel);
ListingModel.belongsTo(SaleModeModel, {as: 'saleMode'});
ListingModel.belongsTo(TemplateModel, {as: 'template'});
ListingModel.belongsToMany(TagModel, {through: 'listingTags'});
TemplateModel.belongsToMany(TagModel, {through: 'templateTags'});
TemplateModel.belongsTo(CategoryModel);

SaleModeModel.belongsTo(CurrencyModel);
SaleModeModel.hasMany(BarterOptionModel);
SaleModeModel.hasMany(ExchangeModeModel);
BarterOptionModel.belongsTo(SaleModeModel);
ExchangeModeModel.belongsTo(SaleModeModel);
BarterOptionModel.belongsToMany(TemplateModel, {through: 'barterOptionTemplates'});
BarterOptionTemplatesModel.belongsToMany(TagModel, { through: 'barterOptionTags'});
//ExchangeModeModel.belongsTo(SaleModeModel);
ExchangeModeModel.belongsTo(LocationModel);
ExchangeModeModel.belongsTo(CurrencyModel);

CountryModel.belongsToMany(CurrencyModel, {as: 'Currency', through: 'countryCurrency'});
CountryModel.belongsToMany(LanguageModel, {as: 'Language', through: 'countryLanguage'});

//ListingModel.belongsTo(ImageModel, {as: 'primaryImage'}); // No need. Add to through model.
ListingModel.belongsToMany(ImageModel, {through: 'listingImages'}); //listingImages model has 'primary' field

// Chat Model
ChatModel.belongsTo(UserModel, {as: 'initUser'});
ChatModel.belongsTo(UserModel, {as: 'recUser'});
ChatModel.belongsTo(ListingModel);
ChatModel.hasMany(ChatMessageModel);
ChatMessageModel.belongsTo(ImageModel);
ChatMessageModel.belongsTo(UserModel, {as: 'author'});
// SaleMode Model
//

// Mongoose
const ViewSchema = Mongoose.Schema({
  listingId: Number,
  views: Number,
});

const OnlineSchema = Mongoose.Schema({
  userId: Number,
  online: Boolean,
});

// create mock data with a seed, so we always get the same
casual.seed(123);
db.sync({ force: true }).then(() => {
  let tagOnePromise = TagModel.create({ name: "myTag0" });
  let tagTwoPromise = TagModel.create({ name: "myTag1" });
  let categoryPromise = CategoryModel.create({
      name: 'root'
  });
  let subcategoryPromise = CategoryModel.create({
      name: 'sub'
  });
  let subsubcategoryPromise = CategoryModel.create({
      name: 'subsub'
  });
  Promise.all([tagOnePromise, tagTwoPromise, subcategoryPromise, subsubcategoryPromise])
  .then( values => {
    let [tag1, tag2, subCategory, subsubCategory] = values;
    TemplateModel.create({ title: "myTemplate0", description: "My 0th template description" })
    .then( template => {
      template.addTag( tag1 )
      template.setCategory( subCategory );
    });
    TemplateModel.create({ title: "myTemplate1", description: "My 1st template description" })
    .then( template => {
      template.addTag( tag2 )
      template.setCategory( subsubCategory );
    });
  });
  let sgdPromise = CurrencyModel.create({
      currency: 'SGD'
    , currencySymbol: '$'
  });
  let audPromise = CurrencyModel.create({
      currency: 'AUD'
    , currencySymbol: '$'
  });
  let engPromise = LanguageModel.create({
      name: 'eng'
  });
  let countryPromise = CountryModel.create({
      isoCode: 'SG'
    , name: 'Singapore'
    , tld: 'sg'
  });

  return Promise.all([sgdPromise, audPromise, engPromise, countryPromise, categoryPromise, subcategoryPromise, subsubcategoryPromise])
    .then ( values => {
      let [sgd, aud, eng, country, category, subCategory, subsubCategory] = values;
      country.addLanguage(eng);
      country.addCurrency(sgd);
      country.addCurrency(aud);
      category.addChildren(subCategory);
      subCategory.addChildren(subsubCategory);
    _.times(10, () => {
      return UserModel.create({
        firstName: casual.first_name,
        lastName: casual.last_name,
        profileName: casual.username,
        idVerification: casual.integer(1, 5),
        sellerRating: casual.integer(0, 5),
        sellerRatingCount: casual.integer(0, 200)
      }).then((user) => {
        user.createProfileImage({imageURL: 'Images.Trollie'});
        let salePromise = SaleMode.create({
            mode: "SALE"
          , price: (Math.floor(casual.double(100, 1000)) / 100)
          , counterOffer: casual.boolean
        }).then( sale => {
          sale.setCurrency( sgd );
        });
        let listingPromise = user.createListing({
          title: `A listing by ${user.firstName}`,
          description: casual.sentences(3),
        });
        return Promise.all([listingPromise, salePromise])
          .then( (values) => {
            let [listing, sale] = values;
            listing.createImage({imageURL: 'Images.Trollie'}, { through: { primary: true }});
            listing.createImage({imageURL: 'Images.Trollie'});
            listing.setSaleMode( sale );
            // create some View mocks
            return View.update(
              { listingId: listing.id },
              { views: casual.integer(0, 100) },
              { upsert: true }
            ).then( () => {
              country.addUser(user);
              return OnlineStatus.update(
                { userId: user.id },
                { online: casual.boolean },
                { upsert: true }
              )
            });
          });
      });
    });
  });
});

const User = db.models.user;
const Listing = db.models.listing;
const Country = db.models.country;
const Chat = db.models.chat;
const ChatMessage = db.models.chatmessage;
const SaleMode = db.models.salemode;
const Template = db.models.template;
const Tag = db.models.tag;
const Category = db.models.category;
const ExchangeMode = db.models.exchangeMode;
const BarterOption = db.models.barterOption;
const BarterOptionTemplates = db.models.barterOptionTemplates;
const Currency = db.models.currency;
const Location = db.models.location;
const Image = db.models.image;
const Oauth = db.models.oauth;
const Email = db.models.email;
const View = Mongoose.model('views', ViewSchema);
const OnlineStatus = Mongoose.model('onlineStatus', OnlineSchema);

export {
   User
 , Listing
 , View
 , OnlineStatus
 , Country
 , Chat
 , ChatMessage
 , SaleMode
 , Template
 , Tag
 , Category
 , ExchangeMode
 , BarterOption
 , BarterOptionTemplates
 , Currency
 , Location
 , Image
 , FortuneCookie
 , Facebook
 , Oauth
 , Email
 , AWSS3
};
