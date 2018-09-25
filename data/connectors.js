import Sequelize from 'sequelize';
import _ from 'lodash';
import Mongoose from 'mongoose';
import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';
import AWS from 'aws-sdk';
import Categories from './constants/categories.js';
import {loci, contentValues} from './constants/loci.js';
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
  countryIsoCode: { type: Sequelize.STRING(3).BINARY, unique: 'contentCountry' },
  // locuId seems to be the name sequelize is using.
  // Commented out trying to remove foreign key constraint error
//  locusId: { type: Sequelize.UUID, unique: 'contentCountry' },
});
const TranslationModel = db.define('translation', {
  text: { type: Sequelize.STRING(191).BINARY },
  aggRating: { type: Sequelize.INTEGER },
});
const LocusModel = db.define('locus', {
  //name: { type: Sequelize.STRING(191).BINARY, primaryKey: true },
  name: { type: Sequelize.STRING(36).BINARY, unique: 'nameIndex' },
  // Commented out trying to remove foreign key constraint error
//  parentId: { type: Sequelize.UUID,  unique: 'nameIndex' },
});
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

/*
// ------
// I18n
// ------
LocusModel.hasMany(LocusModel, {as: 'Children', foreignKey: 'id', targetKey: 'parentId' })
LocusModel.belongsTo(LocusModel, {as: 'parent', foreignKey: 'parentId', targetKey: 'id'})
LocusModel.hasMany(ContentModel, {as: 'content', foreignKey: 'locusId', targetKey: 'id'})
ContentModel.belongsTo(LocusModel, {as: 'locus', foreignKey: 'locusId', targetKey: 'id'})
ContentModel.belongsTo(CountryModel)
ContentModel.hasMany(RatingModel, {as: 'Rating', foreignKey: 'contentId'})
ContentModel.belongsTo(UserModel, {as: 'author'})
//ContentModel.hasMany(ContentModel, {as: 'OtherContent', foreignKey: 'masterContentId'})
//ContentModel.belongsTo(ContentModel, {as: 'masterContent'})

RatingModel.belongsTo(ContentModel, {as: 'content'})
RatingModel.belongsTo(UserModel, {as: 'reviewer'})
// parent to target child (target child gets parentId added to it which holds the id of parent
RatingModel.hasMany(RatingModel, {as: 'Comment', foreignKey: 'parentId'})
// child contains parent
RatingModel.belongsTo(RatingModel, {as: 'parent'})

ContentModel.hasMany(TranslationModel)
TranslationModel.belongsTo(ContentModel)
TranslationModel.belongsTo(LanguageModel, {foreignKey: 'iso639_2', targetKey: 'iso639_2'})
TranslationModel.belongsTo(UserModel, {as: 'translator'})
TranslationModel.hasMany(RatingModel, {as: 'Rating', foreignKey: 'translationId'})
RatingModel.belongsTo(TranslationModel)
TranslationModel.hasMany(TranslationModel, {as: 'Edit', foreignKey: 'parentId'})
TranslationModel.belongsTo(TranslationModel, {as: 'parent'})
*/

// SaleMode Model
//

// Mongoose
/*
const ViewSchema = Mongoose.Schema({
  listingId: Number,
  countryCode: String,
  viewers: [Number],
});
*/

const OnlineSchema = Mongoose.Schema({
  userId: Number,
  online: Boolean,
});

db.sync({ logging: false }).then(() => {
  let rootCategoryPromise = CategoryModel.findOrCreate({ where: { name: 'root' }})
  .then( ([root, success]) => {
    console.log("success: ", success)
    if (success) {
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
    if (root) {
      let engPromise = LanguageModel.create({
          iso639_2: 'eng'
        , name: 'English'
      })
      let msaPromise = LanguageModel.create({
          iso639_2: 'msa'
        , name: 'Malay'
      })
      let sgdPromise = CurrencyModel.create({
          iso4217: 'SGD'
        , currencyName: 'Singapore Dollar'
        , currencySymbol: '$'
      })
      let audPromise = CurrencyModel.create({
          iso4217: 'AUD'
        , currencyName: 'Australia Dollar'
        , currencySymbol: '$'
      })
      let bndPromise = CurrencyModel.create({
          iso4217: 'BND'
        , currencyName: 'Brunei Darussalam Dollar'
        , currencySymbol: '$'
      })
      let myrPromise = CurrencyModel.create({
          iso4217: 'MYR'
        , currencyName: 'Malaysia Ringgit'
        , currencySymbol: 'RM'
      })
      let phpPromise = CurrencyModel.create({
          iso4217: 'PHP'
        , currencyName: 'Philippines Piso'
        , currencySymbol: '₱'
      })
      let nzdPromise = CurrencyModel.create({
          iso4217: 'NZD'
        , currencyName: 'New Zealand Dollar'
        , currencySymbol: '$'
      })
      let usdPromise = CurrencyModel.create({
          iso4217: 'USD'
        , currencyName: 'United States Dollar'
        , currencySymbol: '$'
      })
      let gbpPromise = CurrencyModel.create({
          iso4217: 'GBP'
        , currencyName: 'United Kingdom Pound'
        , currencySymbol: '£'
      })
      let idrPromise = CurrencyModel.create({
          iso4217: 'IDR'
        , currencyName: 'Indonesia Rupiah'
        , currencySymbol: 'Rp'
      })
      let copPromise = CurrencyModel.create({
          iso4217: 'COP'
        , currencyName: 'Colombia Peso'
        , currencySymbol: '$'
      })
      let eurPromise = CurrencyModel.create({
          iso4217: 'EUR'
        , currencyName: 'Euro Member Countries'
        , currencySymbol: '€'
      })
      let tzsPromise = CurrencyModel.create({
          iso4217: 'TZS'
        , currencyName: 'Tanzania Shilling'
        , currencySymbol: 'TSh'
        // Note: It can be prepended.
        //, symbolPrepend: false
        // postpended, not prepended
        // Symbol is sometimes 100/=
      })
      let rwfPromise = CurrencyModel.create({
          iso4217: 'RWF'
        , currencyName: 'Rwanda Franc'
        , currencySymbol: 'FRw'
      })
      let kesPromise = CurrencyModel.create({
          iso4217: 'KES'
        , currencyName: 'Kenya Shilling'
        , currencySymbol: 'KSh'
      })
      let cadPromise = CurrencyModel.create({
          iso4217: 'CAD'
        , currencyName: 'Canada Dollar'
        , currencySymbol: '$'
      })
      let hkdPromise = CurrencyModel.create({
          iso4217: 'HKD'
        , currencyName: 'Hong Kong Dollar'
        , currencySymbol: 'HK$'
      })

      Promise.all([engPromise, sgdPromise, bndPromise, CountryModel.create({
            isoCode: 'BN'
          , name: 'Brunei'
          , tld: 'bn'
        })])
      .then( values => {
          let [eng, sgd, bnd, country] = values;
          country.addLanguage(eng);
          country.addCurrency(sgd);
          country.addCurrency(bnd);
      });
      Promise.all([engPromise, myrPromise, CountryModel.create({
            isoCode: 'MY'
          , name: 'Malaysia'
          , tld: 'my'
        })
      ])
      .then( values => {
          let [eng, myr, country] = values;
          country.addLanguage(eng);
          country.addCurrency(myr);
      })
      let singaporePromise = Promise.all([engPromise, sgdPromise, CountryModel.create({
            isoCode: 'SG'
          , name: 'Singapore'
          , tld: 'sg'
        })
      ])
      .catch(e => console.log("---------------------------14-----------------------"))
      .then( values => {
          let [eng, sgd, country] = values;
          country.addLanguage(eng).catch(e => console.log("---------------------------15-----------------------"))
          country.addCurrency(sgd).catch(e => console.log("---------------------------16-----------------------"))
          return country
      })
      Promise.all([engPromise, phpPromise, CountryModel.create({
            isoCode: 'PH'
          , name: 'Philippines'
          , tld: 'ph'
        })
      ])
      .then( values => {
          let [eng, php, country] = values;
          country.addLanguage(eng);
          country.addCurrency(php);
      });
      Promise.all([engPromise, audPromise, CountryModel.create({
            isoCode: 'AU'
          , name: 'Australia'
          , tld: 'au'
        })
      ])
      .then( values => {
          let [eng, aud, country] = values;
          country.addLanguage(eng);
          country.addCurrency(aud);
      });
      Promise.all([engPromise, nzdPromise, CountryModel.create({
            isoCode: 'NZ'
          , name: 'New Zealand'
          , tld: 'nz'
        })
      ])
      .then( values => {
          let [eng, nzd, country] = values;
          country.addLanguage(eng);
          country.addCurrency(nzd);
      });
      Promise.all([engPromise, usdPromise, CountryModel.create({
            isoCode: 'US'
          , name: 'USA'
          , tld: 'us'
        })
      ])
      .then( values => {
          let [eng, usd, country] = values;
          country.addLanguage(eng);
          country.addCurrency(usd);
      });
      Promise.all([engPromise, gbpPromise, CountryModel.create({
            isoCode: 'GB'
          , name: 'United Kingdom'
          , tld: 'uk'
        })
      ])
      .then( values => {
          let [eng, gbp, country] = values;
          country.addLanguage(eng);
          country.addCurrency(gbp);
      });
      Promise.all([engPromise, idrPromise, CountryModel.create({
            isoCode: 'ID'
          , name: 'Indonesia'
          , tld: 'id'
        })
      ])
      .then( values => {
          let [eng, idr, country] = values;
          country.addLanguage(eng);
          country.addCurrency(idr);
      });
      Promise.all([engPromise, copPromise, CountryModel.create({
            isoCode: 'CO'
          , name: 'Colombia'
          , tld: 'co'
        })
      ])
      .then( values => {
          let [eng, cop, country] = values;
          country.addLanguage(eng);
          country.addCurrency(cop);
      });
      Promise.all([engPromise, eurPromise, CountryModel.create({
            isoCode: 'NL'
          , name: 'Netherlands'
          , tld: 'nl'
        })
      ])
      .then( values => {
          let [eng, eur, country] = values;
          country.addLanguage(eng);
          country.addCurrency(eur);
      });
      Promise.all([engPromise, tzsPromise, CountryModel.create({
            isoCode: 'TZ'
          , name: 'Tanzania'
          , tld: 'tz'
        })
      ])
      .then( values => {
          let [eng, tzs, country] = values;
          country.addLanguage(eng);
          country.addCurrency(tzs);
      });
      Promise.all([engPromise, rwfPromise, CountryModel.create({
            isoCode: 'RW'
          , name: 'Rwanda'
          , tld: 'rw'
        })
      ])
      .then( values => {
          let [eng, rwf, country] = values;
          country.addLanguage(eng);
          country.addCurrency(rwf);
      });
      Promise.all([engPromise, kesPromise, CountryModel.create({
            isoCode: 'KE'
          , name: 'Kenya'
          , tld: 'ke'
        })
      ])
      .then( values => {
          let [eng, kes, country] = values;
          country.addLanguage(eng);
          country.addCurrency(kes);
      });
      Promise.all([engPromise, cadPromise, CountryModel.create({
            isoCode: 'CA'
          , name: 'Canada'
          , tld: 'ca'
        })
      ])
      .then( values => {
          let [eng, cad, country] = values;
          country.addLanguage(eng);
          country.addCurrency(cad);
      });
      Promise.all([engPromise, hkdPromise, CountryModel.create({
            isoCode: 'HK'
          , name: 'Hong Kong'
          , tld: 'hk'
        })
      ])
      .then( values => {
          let [eng, hkd, country] = values;
          country.addLanguage(eng);
          country.addCurrency(hkd);
      })
    } // End if check for root created
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
