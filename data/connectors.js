//vim:et:tw=2:sts=2:sw=2
//import Sequelize, {queryInferface} from 'sequelize';
import Sequelize from 'sequelize';
import _ from 'lodash';
import Mongoose from 'mongoose';
import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';
import AWS from 'aws-sdk';
import Categories from './constants/categories.js';
import {loci} from './constants/loci.js';
import {contentValues} from './constants/contents.js';
import { createLogger, format, transports } from 'winston'

const logger = createLogger({
  level: 'silly',
  format: format.json(),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' })
  ]
});
function getMethods(obj) {
  var result = [];
	for (var id in obj) {
		try {
		  if (typeof(obj[id]) == "function") {
			result.push(id);
		  }
		} catch (err) {
		  result.push(id + ": inaccessible");
		}
	}
  return result;
}
//console.log(getMethods(logger))

var db = new Sequelize(
    'bbb'
  , process.env.RDS_USERNAME
  , process.env.RDS_PASSWORD
  , { dialect: 'mysql'
    , host: process.env.RDS_HOSTNAME
    , port: 3306
//    , logging: function(sql, sequelizeObject) {
//	    logger.silly(sql)
//	  }
//	, operatorsAliases: false
    }
)
logger.add(new transports.Console({
  format: format.simple()
}))

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
  const key = CryptoJS.enc.Hex.parse("6162636431323334");
  const iv = CryptoJS.enc.Hex.parse("696e707574766563");

  let imageString = imageId.toString().padStart(10, '0')
  if (process.env.NODE_ENV === "dev") {
    imageString = imageId.toString().padStart(9, '0').padStart(10, 'd')
  }
  const encrypted = CryptoJS.DES.encrypt(imageString, key,  { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7  });
  return encrypted.ciphertext.toString();
}

AWS.config.update({ accessKeyId: process.env.S3_USER_KEY_ID, secretAccessKey: process.env.S3_USER_SECRET_KEY, region: 'ap-southeast-1' })
const s3 = new AWS.S3();

const AWSS3 = {
  getSignedUrl( args ) {
    return ImageModel.create({})
      .then( image => {
        return new Promise((resolve, reject) => {
          let uniqKey = createOpaqueUniqueImageKey(image.id)
          s3.createPresignedPost({
            Bucket: BBB_BUCKET
            , Conditions: [
              ["content-length-range", 0, 262144],
              //    [ "eq", "$acl", "public-read" ]
            ]
            , Fields: {
              key: uniqKey
            }
            , ContentType: args.imageType
          },
            function(err, data) {
              if (err) {
                console.error('Presigning post data encountered an error', err);
                reject(err)
              } else {
                image.imageKey = data.fields.key;
                image.imageUrl = "https://s3-ap-southeast-1.amazonaws.com/bbb-app-images/" + data.fields.key
                image.save();
                console.log("data: ", data)
                resolve({
                  id: image.id
                  , key: data.fields.key
                  , bucket: data.fields.bucket
                  , X_Amz_Algorithm: data.fields['X-Amz-Algorithm']
                  , X_Amz_Credential: data.fields['X-Amz-Credential']
                  , X_Amz_Date: data.fields['X-Amz-Date']
                  , policy: data.fields.Policy
                  , X_Amz_Signature: data.fields['X-Amz-Signature']
                })
              }
            })
        })
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


const UserModel = db.define('user', {
  firstName: { type: Sequelize.STRING(35).BINARY },
  lastName: { type: Sequelize.STRING(35).BINARY },
  profileName: { type: Sequelize.STRING(76).BINARY },
  nameChangeCount: { type: Sequelize.SMALLINT , defaultValue: 1 },
  idVerification: { type: Sequelize.SMALLINT , defaultValue: 1 },
  sellerRating: { type: Sequelize.SMALLINT, defaultValue: 0 },
  sellerRatingCount: { type: Sequelize.INTEGER, defaultValue: 0 },
  translatorWeight: { type: Sequelize.INTEGER, defaultValue: 1 },
  ratingWeight: { type: Sequelize.INTEGER, defaultValue: 1 },
  token: { type: Sequelize.STRING(191).BINARY },
});

const ListingModel = db.define('listing', {
  title: { type: Sequelize.STRING(50).BINARY },
  description: { type: Sequelize.STRING(191).BINARY },
});

const SaleModeModel = db.define('salemode', {
  mode: { type: Sequelize.STRING(10).BINARY },
  price: { type: Sequelize.FLOAT },
  counterOffer: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
});

const TemplateModel = db.define('template', {
  title: { type: Sequelize.STRING(50).BINARY },
  description: { type: Sequelize.STRING(191).BINARY },
});

const TagModel = db.define('tag', {
  name: { type: Sequelize.STRING(32).BINARY },
});

const ChatModel = db.define('chat', {
  initUserAddress: { type: Sequelize.STRING(191).BINARY },
  recUserAddress: { type: Sequelize.STRING(191).BINARY },
},{
  timestamps: true
});

const ChatMessageModel = db.define('chatmessage', {
  message: { type: Sequelize.STRING(191).BINARY },
});

const CountryModel = db.define('country', {
  isoCode: { type: Sequelize.STRING(3).BINARY, primaryKey: true },
  name: { type: Sequelize.STRING(32).BINARY },
  tld: { type: Sequelize.STRING(2).BINARY },
  disabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
});
// TODO: Link language and currency to CountryModel
const LanguageModel = db.define('language', {
  iso639_2: { type: Sequelize.STRING(3).BINARY, primaryKey: true },
  name: { type: Sequelize.STRING(32).BINARY },
  disabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
});
const CurrencyModel = db.define('currency', {
  iso4217: { type: Sequelize.STRING(3).BINARY, primaryKey: true },
  currencyName: { type: Sequelize.STRING(32).BINARY },
  currencySymbol: { type: Sequelize.STRING(3).BINARY },
  symbolPrepend: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
  disabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
});
const CategoryModel = db.define('category', {
  name: { type: Sequelize.STRING(32).BINARY },
});
const ContentModel = db.define('content', {
  meaning: { type: Sequelize.STRING(191).BINARY },
  countryCode: { type: Sequelize.STRING(3).BINARY, unique: 'contentCountry' },
  locusId: { type: Sequelize.INTEGER, unique: 'contentCountry' },
});
const TranslationModel = db.define('translation', {
  text: { type: Sequelize.STRING(191).BINARY, allowNull: false },
  contentId: { type: Sequelize.INTEGER, allowNull: false, unique: 'countryTranslation' },
  iso639_2: { type: Sequelize.STRING(3).BINARY, allowNull: false, unique: 'countryTranslation' },
  //aggRating: { type: Sequelize.INTEGER },
  /*
TranslationModel.belongsTo(LanguageModel, {foreignKey: 'iso639_2', targetKey: 'iso639_2'})
ContentModel.hasMany(TranslationModel)
*/
});
const LocusModel = db.define('locus', {
  //name: { type: Sequelize.STRING(191).BINARY, primaryKey: true },
  name: {
    type: Sequelize.STRING(36).BINARY,
    allowNull: false,
    unique: 'nameIndex'
  },
  parentName: { type: Sequelize.STRING(36).BINARY, unique: 'nameIndex' },
});
TranslationModel.drop()
ContentModel.drop()
LocusModel.drop()
.catch( e => console.log("Error: ", e))
  /*
CountryModel.drop()
.catch( e => console.log("Error: ", e))
LanguageModel.drop()
.catch( e => console.log("Error: ", e))
*/

//LocusModel.removeAttribute('id');
const RatingModel = db.define('rating', {
  good: { type: Sequelize.BOOLEAN },
  weight: { type: Sequelize.INTEGER },
  comment: { type: Sequelize.STRING(191).BINARY },
});
const LocationModel = db.define('location', {
  latitude: { type: Sequelize.FLOAT },
  longitude: { type: Sequelize.FLOAT },
  lineOne: { type: Sequelize.STRING(40).BINARY },
  lineTwo: { type: Sequelize.STRING(40).BINARY },
  postcode: { type: Sequelize.STRING(10).BINARY },
  description: { type: Sequelize.STRING(191).BINARY },
});

const EmailModel = db.define('email', {
  email: { type: Sequelize.STRING(191).BINARY },
  primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  //TODO: probably needs a verification code to match against.
});
const OauthModel = db.define('oauth', {
  provider: { type: Sequelize.STRING(12).BINARY, allowNull: false },
  uid: { type: Sequelize.STRING(128).BINARY, allowNull: false },
  name: { type: Sequelize.STRING(191).BINARY },
  email: { type: Sequelize.STRING(191).BINARY },
  pictureURL: { type: Sequelize.STRING(191).BINARY },
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
  mode: { type: Sequelize.STRING(4).BINARY }, //F2F or Post
  price: { type: Sequelize.FLOAT },
});
// Later associate images with templates
const ImageModel = db.define('image', {
  imageURL: { type: Sequelize.STRING(191).BINARY },
  imageKey: { type: Sequelize.STRING(32).BINARY },
  // flagging
  // ratings
  // author
  // template
});

// Join table for ListingModel and ImageModel
const ListingImagesModel = db.define('listingImages', {
  primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false  },  // Only one TRUE ONCE for each listingId. Not constrained here.
});
// Join table for ListingModel and User (Views)
const ListingViewsModel = db.define('listingViews', {
  visits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
});
// Join table for BarterOptionModel and Template
const BarterOptionTemplatesModel = db.define('barterOptionTemplates', {
	/*
  id: {
    type: Sequelize.UUID,
    primaryKey: true,
    autoIncrement: true
  },
  */
  quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
});
// Join table for ListingModel and User (Views)
/*
const CountryUsersModel = db.define('listingViews', {
  visits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
});
*/
//const BarterGroupModel = db.define('barterGroup');

// ****************************
// Relationships between tables
// ****************************

// User Model
ListingModel.belongsTo(UserModel, {as: 'user'});
UserModel.belongsToMany(ListingModel, {as: 'Like', through: 'listingLikes'}); // UserModel.createLike, getLikes, setLikes, addLike,addLikes
//CountryModel.hasMany(UserModel, {as: 'User', foreignKey: 'countryCode'});
CountryModel.belongsToMany(UserModel, {as: 'User', through: 'countryUsers'})
UserModel.belongsToMany(CountryModel, {as: 'Country', through: 'countryUsers'})
UserModel.hasMany(EmailModel);
UserModel.hasMany(OauthModel);
UserModel.belongsTo(ImageModel, {as: 'profileImage'});
UserModel.belongsTo(CountryModel, {foreignKey: 'adminCountryCode', targetKey: 'isoCode'})
UserModel.belongsToMany(LanguageModel, {as: 'language', through: 'userLanguage'})
// Listing Model
UserModel.hasMany(ListingModel); //UserModel has setListingModel method; ListingModel has a userId foreign key
ListingModel.belongsToMany(UserModel, {as: 'Like', through: 'listingLikes'});// ListingModel.createLike, getLikes, setLikes, addLike,addLikes
ListingModel.belongsToMany(UserModel, {as: 'Views', through: 'listingViews'});
// parent to target child (target child gets parentId added to it which holds the id of parent
CategoryModel.hasMany(CategoryModel, {as: 'Children', foreignKey: 'parentId'})
// child contains parent
CategoryModel.belongsTo(CategoryModel, {as: 'parent'})

CategoryModel.hasMany(ListingModel, {as: 'listing'});
ListingModel.belongsTo(CategoryModel);

ListingModel.belongsTo(CountryModel);
ListingModel.belongsTo(SaleModeModel, {as: 'saleMode'});
ListingModel.belongsTo(TemplateModel, {as: 'template'});
ListingModel.belongsToMany(TagModel, {through: 'listingTags'});
TemplateModel.belongsToMany(TagModel, {through: 'templateTags'});

CategoryModel.hasMany(TemplateModel, {as: 'template'});
TemplateModel.belongsTo(CategoryModel);

SaleModeModel.belongsTo(CurrencyModel);
SaleModeModel.hasMany(BarterOptionModel);
SaleModeModel.hasMany(ExchangeModeModel);
BarterOptionModel.belongsTo(SaleModeModel);
ExchangeModeModel.belongsTo(SaleModeModel);
BarterOptionModel.belongsToMany(TemplateModel, {through: 'barterOptionTemplates'});
BarterOptionTemplatesModel.belongsToMany(TagModel, { through: 'barterOptionTags'});
ExchangeModeModel.belongsTo(LocationModel);
ExchangeModeModel.belongsTo(CurrencyModel);

CountryModel.belongsToMany(CurrencyModel, {as: 'Currency', through: 'countryCurrency'});
CountryModel.belongsToMany(LanguageModel, {as: 'Language', through: 'countryLanguage'});

//ListingModel.belongsTo(ImageModel, {as: 'primaryImage'}); // No need. Add to through model.
ListingModel.belongsToMany(ImageModel, {through: 'listingImages'}); //listingImages model has 'primary' field

// Chat Model
ChatModel.belongsTo(UserModel, {as: 'initUser'});
ChatModel.belongsTo(UserModel, {as: 'recUser'});
ChatModel.belongsTo(UserModel, {as: 'delRequestUser'});
ChatModel.belongsTo(ListingModel);
ChatModel.hasMany(ChatMessageModel, {onDelete: 'CASCADE'})
ChatMessageModel.belongsTo(ImageModel);
ImageModel.hasMany(ChatMessageModel);
ChatMessageModel.belongsTo(UserModel, {as: 'author'});

// ------
// I18n
// ------
LocusModel.hasMany(LocusModel, {as: 'children', foreignKey: 'parentName', sourceKey: 'name' })
LocusModel.belongsTo(LocusModel, {as: 'parent', foreignKey: 'parentName', targetKey: 'name'})

LocusModel.hasMany(ContentModel, {as: 'content', foreignKey: 'locusId', sourceKey: 'id'})
ContentModel.belongsTo(LocusModel, {as: 'locus', foreignKey: 'locusId', targetKey: 'id'})

ContentModel.belongsTo(CountryModel, {foreignKey: 'countryCode', targetKey: 'isoCode'})
TranslationModel.belongsTo(LanguageModel, {foreignKey: 'iso639_2', targetKey: 'iso639_2'})
ContentModel.hasMany(TranslationModel)
CategoryModel.belongsTo(LocusModel, {as: 'locus'})
/*
Country.hasMany(City, {foreignKey: 'countryCode', sourceKey: 'isoCode'});
City.belongsTo(Country, {foreignKey: 'countryCode', targetKey: 'isoCode'});
*/

////ContentModel.hasMany(RatingModel, {as: 'Rating', foreignKey: 'contentId'})
////ContentModel.belongsTo(UserModel, {as: 'author'})
//ContentModel.hasMany(ContentModel, {as: 'OtherContent', foreignKey: 'masterContentId'})
//ContentModel.belongsTo(ContentModel, {as: 'masterContent'})

//RatingModel.belongsTo(ContentModel, {as: 'content'})
//RatingModel.belongsTo(UserModel, {as: 'reviewer'})
// parent to target child (target child gets parentId added to it which holds the id of parent
//RatingModel.hasMany(RatingModel, {as: 'Comment', foreignKey: 'parentId'})
// child contains parent
//RatingModel.belongsTo(RatingModel, {as: 'parent'})

//TranslationModel.belongsTo(ContentModel)
//TranslationModel.belongsTo(UserModel, {as: 'translator'})
//TranslationModel.hasMany(RatingModel, {as: 'Rating', foreignKey: 'translationId'})
//RatingModel.belongsTo(TranslationModel)
//TranslationModel.hasMany(TranslationModel, {as: 'Edit', foreignKey: 'parentId'})
//TranslationModel.belongsTo(TranslationModel, {as: 'parent'})

// SaleMode Model
//

// Mongoose
/*
const ViewSchema = Mongoose.Schema({
  listingId: Number,
  countryCode: String, viewers: [Number],
});
*/

const OnlineSchema = Mongoose.Schema({
  userId: Number,
  online: Boolean,
});

function flatten( list, parentName ) {
  return list.map( element => {
    if (element.children.length > 0) {
      let mixedList = flatten(element.children, element.name)
      let flatList = []
      mixedList.map( mElement => {
        if (Array.isArray(mElement)) {
          flatList = flatList.concat(mElement)
        } else {
          flatList.push(mElement)
        }
      })
      flatList.unshift({name: element.name, parentName: parentName})
      return flatList
    } else {
      return {name: element.name, parentName: parentName}
    }
  })
}

db.sync({ logging: false }).then(() => {
 
  let rootCategoryPromise = CategoryModel.findOrCreate({ where: { name: 'root' }})
  .then( ([root, created]) => {
    if (created) {
      let catPromises = Object.keys(Categories).map( catName => {
        let subCatPromises = Object.keys(Categories[catName]).map( subCatName => {
          return CategoryModel.create({
            name: subCatName
          })
        })
        return CategoryModel.create({
          name: catName
        })
        .then( cat => {
          return Promise.all(subCatPromises)
          .then( subCats => {
            return cat.setChildren( subCats )
          })
        })
      }) // End first object map

      return Promise.all( catPromises )
      .then( cats => {
        return root.setChildren( cats ).catch(e => console.log("---------------------------12-----------------------"))
      })
    } else {
      return false
    }
  })
  .then( root => {
    console.log("root: ", root)
    let countryPromises = []
    let languagePromises = null
    if (true) {
      console.log("--------------------- Creating Languages --------------------")
      let engPromise = LanguageModel.findOrCreate({
        where: {
          iso639_2: 'eng'
        , name: 'English'
        }
      })
      let mayPromise = LanguageModel.findOrCreate({
        where: {
          iso639_2: 'may'
        , name: 'Bahasa Melayu'
        }
      })
      let gerPromise = LanguageModel.findOrCreate({
        where: {
          iso639_2: 'ger'
        , name: 'Deutsch'
        }
      })
      let araPromise = LanguageModel.findOrCreate({
        where: {
          iso639_2: 'ara'
        , name: 'العَرَبِيَّة'
        }
      })
      let chiPromise = LanguageModel.findOrCreate({
        where: {
          iso639_2: 'chi'
        , name: '中文'
        }
      })
      let spaPromise = LanguageModel.findOrCreate({
        where: {
          iso639_2: 'spa'
        , name: 'Español'
        }
      })
      languagePromises = [engPromise, mayPromise, gerPromise, araPromise, chiPromise, spaPromise]
      let sgdPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'SGD'
        , currencyName: 'Singapore Dollar'
        , currencySymbol: '$'
        }
      })
      let audPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'AUD'
        , currencyName: 'Australia Dollar'
        , currencySymbol: '$'
        }
      })
      let bndPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'BND'
        , currencyName: 'Brunei Darussalam Dollar'
        , currencySymbol: '$'
        }
      })
      let myrPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'MYR'
        , currencyName: 'Malaysia Ringgit'
        , currencySymbol: 'RM'
        }
      })
      let phpPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'PHP'
        , currencyName: 'Philippines Piso'
        , currencySymbol: '₱'
        }
      })
      let nzdPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'NZD'
        , currencyName: 'New Zealand Dollar'
        , currencySymbol: '$'
        }
      })
      let usdPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'USD'
        , currencyName: 'United States Dollar'
        , currencySymbol: '$'
        }
      })
      let gbpPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'GBP'
        , currencyName: 'United Kingdom Pound'
        , currencySymbol: '£'
        }
      })
      let idrPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'IDR'
        , currencyName: 'Indonesia Rupiah'
        , currencySymbol: 'Rp'
        }
      })
      let inrPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'INR'
        , currencyName: 'Indian Rupee'
        , currencySymbol: '₹'
        }
      })
      let copPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'COP'
        , currencyName: 'Colombia Peso'
        , currencySymbol: '$'
        }
      })
      let eurPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'EUR'
        , currencyName: 'Euro Member Countries'
        , currencySymbol: '€'
        }
      })
      let tzsPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'TZS'
        , currencyName: 'Tanzania Shilling'
        , currencySymbol: 'TSh'
        }
        // Note: It can be prepended.
        //, symbolPrepend: false
        // postpended, not prepended
        // Symbol is sometimes 100/=
      })
      let rwfPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'RWF'
        , currencyName: 'Rwanda Franc'
        , currencySymbol: 'FRw'
        }
      })
      let kesPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'KES'
        , currencyName: 'Kenya Shilling'
        , currencySymbol: 'KSh'
        }
      })
      let cadPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'CAD'
        , currencyName: 'Canada Dollar'
        , currencySymbol: '$'
        }
      })
      let hkdPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'HKD'
        , currencyName: 'Hong Kong Dollar'
        , currencySymbol: 'HK$'
        }
      })
      let kwdPromise = CurrencyModel.findOrCreate({
        where: {
          iso4217: 'KWD'
        , currencyName: 'Kuwaiti Dinar'
        , currencySymbol: 'KD'
        }
      })

      // Country Promises
      // ----------------
      countryPromises.push(
        Promise.all([engPromise, inrPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'IN'
          , name: 'India'
          , tld: 'in'
          }
        })])
        .then( values => {
          let [[eng, engSuccess], [inr, inrSuccess], [country, success]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("India:ENG:add: ", e.message)) )
          country.hasCurrency(inr)
          .then( exists => !exists && country.addCurrency(inr).catch(e => console.log("India:INR:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, sgdPromise, bndPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'BN'
          , name: 'Brunei'
          , tld: 'bn'
          }
        })])
        .then( values => {
          let [[eng, engSuccess], [sgd, sgdSuccess], [bnd, bndSuccess], [country, success]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Brunei:ENG:add: ", e.message)) )
          country.hasCurrency(sgd)
          .then( exists => !exists && country.addCurrency(sgd).catch(e => console.log("Brunei:SGD:add: ", e.message)) )
          country.hasCurrency(bnd)
          .then( exists => !exists && country.addCurrency(bnd).catch(e => console.log("Brunei:BND:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, mayPromise, myrPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'MY'
          , name: 'Malaysia'
          , tld: 'my'
          } 
        })])          
        .then( values => {
          let [[eng, engSuccess], [may, maySuccess], [myr, myrSuccess], [country, success]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Malaysia:ENG:add: ", e.message)) )
          country.hasLanguage(may)
          .then( exists => !exists && country.addLanguage(may).catch(e => console.log("Malaysia:MAY:add: ", e.message)) )
          country.hasCurrency(myr)
          .then( exists => !exists && country.addCurrency(myr).catch(e => console.log("Malaysia:MYR:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, mayPromise, chiPromise, sgdPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'SG'
          , name: 'Singapore'
          , tld: 'sg'
          }
        })])
        .catch(e => console.log("---------------------------14-----------------------", e))
        .then( values => {
          let [[eng, engCreated], [may, mayCreated], [chi, chiCreated], [sgd, sgdCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => {
            if (!exists) {
              country.addLanguage(eng).catch(e => console.log("---------------------------15-----------------------"))
            }
          })
          country.hasLanguage(may)
          .then( exists => {
            if (!exists) {
              country.addLanguage(may).catch(e => console.log("---------------------------15-----------------------"))
            }
          })
          country.hasLanguage(chi)
          .then( exists => {
            if (!exists) {
              country.addLanguage(chi).catch(e => console.log("---------------------------15-----------------------"))
            }
          })
          country.hasCurrency(sgd)
          .then( exists => {
            if (!exists) {
              country.addCurrency(sgd).catch(e => console.log("---------------------------16-----------------------"))
            }
          })
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, araPromise, kwdPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'KW'
          , name: 'Kuwait'
          , tld: 'kw'
          }
        })])
        .catch(e => console.log("---------------------------14-----------------------", e))
        .then( values => {
          let [[eng, engCreated], [ara, araCreated], [kwd, kwdCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => {
            if (!exists) {
              country.addLanguage(eng).catch(e => console.log("---------------------------15-----------------------"))
            }
          })
          country.hasLanguage(ara)
          .then( exists => {
            if (!exists) {
              country.addLanguage(ara).catch(e => console.log("---------------------------15-----------------------"))
            }
          })
          country.hasCurrency(kwd)
          .then( exists => {
            if (!exists) {
              country.addCurrency(kwd).catch(e => console.log("---------------------------16-Kuwait-Dinar----------", e))
            }
          })
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, phpPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'PH'
          , name: 'Philippines'
          , tld: 'ph'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [php, phpCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Philippines:ENG:add: ", e.message)) )
          country.hasCurrency(php)
          .then( exists => !exists && country.addCurrency(php).catch(e => console.log("Philippines:PHP:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, audPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'AU'
          , name: 'Australia'
          , tld: 'au'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [aud, audCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Australia:ENG:add: ", e.message)) )
          country.hasCurrency(aud)
          .then( exists => !exists && country.addCurrency(aud).catch(e => console.log("Australia:AUD:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, nzdPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'NZ'
          , name: 'New Zealand'
          , tld: 'nz'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [nzd, nzdCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("New Zealand:ENG:add: ", e.message)) )
          country.hasCurrency(nzd)
          .then( exists => !exists && country.addCurrency(nzd).catch(e => console.log("New Zealand:NZD:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, usdPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'US'
          , name: 'USA'
          , tld: 'us'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [usd, usdCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("USA:ENG:add: ", e.message)) )
          country.hasCurrency(usd)
          .then( exists => !exists && country.addCurrency(usd).catch(e => console.log("USA:USD:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, gbpPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'GB'
          , name: 'United Kingdom'
          , tld: 'uk'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [gbp, gbpCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("United Kingdom:ENG:add: ", e.message)) )
          country.hasCurrency(gbp)
          .then( exists => !exists && country.addCurrency(gbp).catch(e => console.log("United Kingdom:GBP:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, idrPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'ID'
          , name: 'Indonesia'
          , tld: 'id'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [idr, idrCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Indonesia:ENG:add: ", e.message)) )
          country.hasCurrency(idr)
          .then( exists => !exists && country.addCurrency(idr).catch(e => console.log("Indonesia:IDR:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, copPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'CO'
          , name: 'Colombia'
          , tld: 'co'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [cop, copCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Colombia:ENG:add: ", e.message)) )
          country.hasCurrency(cop)
          .then( exists => !exists && country.addCurrency(cop).catch(e => console.log("Colombia:COP:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, eurPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'NL'
          , name: 'Netherlands'
          , tld: 'nl'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [eur, eurCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Netherlands:ENG:add: ", e.message)) )
          country.hasCurrency(eur)
          .then( exists => !exists && country.addCurrency(eur).catch(e => console.log("Netherlands:EUR:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, tzsPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'TZ'
          , name: 'Tanzania'
          , tld: 'tz'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [tzs, tzsCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Tanzania:ENG:add: ", e.message)) )
          country.hasCurrency(tzs)
          .then( exists => !exists && country.addCurrency(tzs).catch(e => console.log("Tanzania:TZS:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, rwfPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'RW'
          , name: 'Rwanda'
          , tld: 'rw'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [rwf, rwfCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Rwanda:ENG:add: ", e.message)) )
          country.hasCurrency(rwf)
          .then( exists => !exists && country.addCurrency(rwf).catch(e => console.log("Rwanda:RWF:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, kesPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'KE'
          , name: 'Kenya'
          , tld: 'ke'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [kes, kesCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Kenya:ENG:add: ", e.message)) )
          country.hasCurrency(kes)
          .then( exists => !exists && country.addCurrency(kes).catch(e => console.log("Kenya:KES:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, cadPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'CA'
          , name: 'Canada'
          , tld: 'ca'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [cad, cadCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Canada:ENG:add: ", e.message)) )
          country.hasCurrency(cad)
          .then( exists => !exists && country.addCurrency(cad).catch(e => console.log("Canada:CAD:add: ", e.message)) )
          return country
        })
      )
      countryPromises.push(
        Promise.all([engPromise, hkdPromise, CountryModel.findOrCreate({
          where: {
            isoCode: 'HK'
          , name: 'Hong Kong'
          , tld: 'hk'
          }
        })])
        .then( values => {
          let [[eng, engCreated], [hkd, hkdCreated], [country, created]] = values;
          country.hasLanguage(eng)
          .then( exists => !exists && country.addLanguage(eng).catch(e => console.log("Hong Kong:ENG:add: ", e.message)) )
          country.hasCurrency(hkd)
          .then( exists => !exists && country.addCurrency(hkd).catch(e => console.log("Hong Kong:HKD:add: ", e.message)) )
          return country
        })
      )
    } // End if check for root created

    console.log("Create loci...")
    Promise.all(countryPromises.concat(languagePromises))
    .then( values => {
      console.log("Create loci...")
      Promise.all(
        flatten(loci, null)[0].map( newLoci => {
          return LocusModel.create({ 
            name: newLoci.name
          , parentName: newLoci.parentName
          })
          .catch( e => console.log("LocusCreate: ", e))
        })
      ).then( lociResults => {
        let populateContent = ( theLocus, content ) => {
          if (content.isCat) {
            if (content.locus.parentName == "CategoriesRoot") {
              // This means a category on the root level of Categories
              let category = Categories.find( cat => cat.lociName == content.locus.name)
              if (category) {
                CategoryModel.findOne({
                  where: {
                    name: category.name
                  , parentId: 1
                  }
                })
                .then( cat => {
                  if (cat) {
                    cat.setLocus( theLocus )
                    .catch( e => console.log("Problem adding Locus to Category: ", e))
                  } else {
                    console.log("Category not found: ", category.name)
                  }
                })
                .catch( e => console.log("Problem trying to find ", category.name, " on CategoryModel"))
              } else {
                console.log("content.locus.name: ", content.locus.name, " does not match any lociName in Categories.")
              }
            } else {
              let parentCategory = Categories.find( cat => cat.lociName == content.locus.parentName )
              let category = parentCategory.children.find( cat => cat.lociName == content.locus.name )
              if (parentCategory && category) {
                CategoryModel.findOne({
                  where: {
                    name: category.name
                  }
                , include: [
                    {
                      model: CategoryModel
                    , as: 'parent'
                    , where: {
                        name: parentCategory.name
                      }
                    , required: true
                    } 
                  ]
                })
                .then( cat => {
                  if (cat) {
                    cat.setLocus( theLocus )
                    .catch( e => console.log("Problem adding Locus to Category: ", e))
                  } else {
                    console.log("Category not found: ", category.name)
                  }
                })
                .catch( e => console.log("Problem trying to find ", category.name, " on CategoryModel ++ ", e))
              } else {
                console.log("Either parentCategory: ", (parentCategory ? "found" : "missing"), " or category: ", (category ? "found" : "missing"), ". (", content.locus.parentName, "->", content.locus.name, ")" )
              }
            }
          }
          theLocus.createContent({
            meaning: content.meaning
          , countryCode: content.countryCode
          })
          .then( theContent => {
            content.translations.map( translation => {
              theContent.createTranslation({
                iso639_2: translation.iso639_2
              , text: translation.text  
              })
              .catch( e => console.log("Error: ", e))
            })
          })
          .catch( e => console.log("ContentMeaning: ", content.meaning, " Error: ", e))
        }

        contentValues.map( content => {
          if (content.countryCode == "") {
            content.countryCode = null
          }
          let theLocus = lociResults.find(function(currentLocus) {
            return (currentLocus.dataValues.name == content.locus.name && currentLocus.dataValues.parentName == content.locus.parentName)
          })
          if (!theLocus) {
            LocusModel.create({ 
              name: content.locus.name
            , parentName: content.locus.parentName
            })
            .then( theLocus => {
              populateContent( theLocus, content )
            })
            .catch( e => console.log("Error creating locus: ", e))
          } else {
            populateContent( theLocus, content )
          }
        })
      })
      .catch( error => {
        console.log("Error: ", error)
      })
    })
  })
})

function* shuffle(array, excluded) {
    var i = array.length;
    array.splice( excluded - 1, 1)
    while (i--) {
        yield array.splice( Math.floor(Math.random() * i), 1)[0];
    }
}

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
const ListingViews = db.models.listingViews;
const Currency = db.models.currency;
const Location = db.models.location;
const Locus = db.models.locus;
const Translation = db.models.translation;
const Content = db.models.content;
const Rating = db.models.rating;
const Image = db.models.image;
const Oauth = db.models.oauth;
const Email = db.models.email;
//const View = Mongoose.model('views', ViewSchema);
const OnlineStatus = Mongoose.model('onlineStatus', OnlineSchema);

export {
   User
 , Listing
// , View // Not useful anylonger.
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
 , ListingViews
 , Currency
 , Location
 , Locus
 , Content
 , Translation
 , Rating
 , Image
 , FortuneCookie
 , Facebook
 , Oauth
 , Email
 , AWSS3
};
