import Sequelize from 'sequelize';
import casual from 'casual';
import _ from 'lodash';
import Mongoose from 'mongoose';
import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';
import AWS from 'aws-sdk';
import Categories from './constants/categories.js';
import {loci, contentValues} from './constants/loci.js';

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

const db = new Sequelize('market', null, null, {
  dialect: 'sqlite',
  storage: './market.sqlite',
  operatorsAliases: false,  // Gets rid of the warning.
});

const UserModel = db.define('user', {
  firstName: { type: Sequelize.STRING },
  lastName: { type: Sequelize.STRING },
  profileName: { type: Sequelize.STRING },
  idVerification: { type: Sequelize.TINYINT , defaultValue: 1 },
  sellerRating: { type: Sequelize.TINYINT, defaultValue: 0 },
  sellerRatingCount: { type: Sequelize.INTEGER, defaultValue: 0 },
  translatorWeight: { type: Sequelize.INTEGER, defaultValue: 1 },
  ratingWeight: { type: Sequelize.INTEGER, defaultValue: 1 },
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
  disabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
});
// TODO: Link language and currency to CountryModel
const LanguageModel = db.define('language', {
  iso639_2: { type: Sequelize.STRING, primaryKey: true },
  name: { type: Sequelize.STRING },
  disabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
});
const CurrencyModel = db.define('currency', {
  iso4217: { type: Sequelize.STRING, primaryKey: true },
  currencyName: { type: Sequelize.STRING },
  currencySymbol: { type: Sequelize.STRING },
  symbolPrepend: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
  disabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
});
const CategoryModel = db.define('category', {
  name: { type: Sequelize.STRING },
});
const ContentModel = db.define('content', {
  meaning: { type: Sequelize.STRING },
  countryIsoCode: { type: Sequelize.STRING, unique: 'contentCountry' },
  // locuId seems to be the name sequelize is using.
  locusId: { type: Sequelize.INTEGER, unique: 'contentCountry' },
});
const TranslationModel = db.define('translation', {
  text: { type: Sequelize.STRING },
  aggRating: { type: Sequelize.INTEGER },
});
const LocusModel = db.define('locus', {
  //name: { type: Sequelize.STRING, primaryKey: true },
  name: { type: Sequelize.STRING, unique: 'nameIndex' },
  parentId: { type: Sequelize.INTEGER,  unique: 'nameIndex' },
});
const RatingModel = db.define('rating', {
  good: { type: Sequelize.BOOLEAN },
  weight: { type: Sequelize.INTEGER },
  comment: { type: Sequelize.STRING },
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
// Join table for ListingModel and User (Views)
const ListingViewsModel = db.define('listingViews', {
  visits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
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
// Join table for ListingModel and User (Views)
const CountryUsersModel = db.define('listingViews', {
  visits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
});
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

// create mock data with a seed, so we always get the same
casual.seed(123);
db.sync({ force: true }).then(() => {
  let lociPromises = loci.map( locus => LocusModel.create({ name: locus.name }) )
  Promise.all( lociPromises )
  .then( newLoci => {
    let index = 0
    loci.map( locus => {
      let filteredParentLoci
      if (locus.parentName) {
        let parentLoci = newLoci.filter( locusModel => locusModel.parentName == locus.parentName)
        if (locus.grandParentName) {
          filteredParentLoci = parentLoci.filter( locusModel => locusModel.parentName = locus.grandParentName )
          newLoci[index].setParent( filteredParentLoci[0] )
        } else {
          filteredParentLoci = parentLoci.filter( locusModel => locusModel.parentName == null )
          newLoci[index].setParent( filteredParentLoci[0] )
        }
      } else {
        // root element
      }
      index++
    })
  })
  let tagOnePromise = TagModel.create({ name: "myTag0" });
  let tagTwoPromise = TagModel.create({ name: "myTag1" });
 // let categories = Object.assign({}, Categories)
  let rootCategoryPromise = CategoryModel.create({
      name: 'root'
  })
  .then( root => {
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
  })
  let tagResultsPromise = Promise.all([tagOnePromise, tagTwoPromise, rootCategoryPromise])
  .then( values => {
    let [tag1, tag2, rootCategory] = values;
    TemplateModel.create({ title: "myTemplate0", description: "My 0th template description" })
    .then( template => {
      template.addTag( tag1 )
      template.setCategory( 14 );
    });
    TemplateModel.create({ title: "myTemplate1", description: "My 1st template description" })
    .then( template => {
      template.addTag( tag2 )
      template.setCategory( 17 );
    });
  })
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
  Promise.all([engPromise, copPromise, CountryModel.create({
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
  });
  return Promise.all([singaporePromise, sgdPromise, tagResultsPromise])
    .then ( values => {
      let [singapore, sgd, tagResults] = values;
    _.times(10, () => {
      return UserModel.create({
        firstName: casual.first_name,
        lastName: casual.last_name,
        profileName: casual.username,
        idVerification: casual.integer(1, 5),
        sellerRating: casual.integer(1, 6),
        sellerRatingCount: casual.integer(0, 200)
      }).then((user) => {
        user.createProfileImage({imageURL: 'Images.Trollie'}).catch(e => console.log("---------------------------10-----------------------"))
        let salePromise = SaleMode.create({
            mode: "SALE"
          , price: (Math.floor(casual.double(100, 1000)) / 100)
          , counterOffer: casual.boolean
        }).then( sale => {
          return sale.setCurrency( sgd ).catch(e => console.log("---------------------------16-----------------------"))
        }).catch(e => console.log("---------------------------9-----------------------"))
        let listingPromise = user.createListing({
          title: `A listing by ${user.firstName}`,
          description: casual.sentences(3),
        }).catch(e => console.log("---------------------------17-----------------------"))
        return Promise.all([listingPromise, salePromise])
          .then( (values) => {
            let [listing, sale] = values;
            listing.createImage({imageURL: 'Images.Trollie'}, { through: { primary: true }}).catch(e => console.log("---------------------------3-----------------------"))
            listing.createImage({imageURL: 'Images.Trollie'}).catch(e => console.log("---------------------------4-----------------------"))
            listing.setSaleMode( sale ).catch(e => console.log("---------------------------5-----------------------"))
            listing.setTemplate( casual.integer(1,2) ).catch(e => console.log("---------------------------6-----------------------")) //relies on two templates created above.
            listing.addTag( casual.integer(1,2) ).catch(e => console.log("---------------------------6.5-----------------------")) //relies on two templates created above.
            listing.setCountry(singapore).catch(e => console.log("---------------------------7-----------------------"))
            listing.setCategory( casual.integer(12, 40) ).catch(e => console.log("---------------------------8-----------------------" + e))
            listing.setCountry(singapore).catch(e => console.log("---------------------------7-----------------------"))
            listing.setCategory( casual.integer(12, 40) ).catch(e => console.log("---------------------------8-----------------------" + e))
            // create some View mocks
//            return View.update(
//              { listingId: listing.id },
//              { views: casual.integer(0, 100) },
//              { upsert: true }
            let userGenerator = shuffle(Array.from({length: 10}, (v, k) => k+1), user.id)
            let ranUsers = []
            for ( var i=0; i < Math.floor(Math.random() * 10); i++ ) {
              ranUsers.push(userGenerator.next().value)
            }
            return listing.setViews( ranUsers, { through: { count: 1 }} ).catch(e => console.log("---------------------------2-----------------------"))
//            return View.update(
//              { listingId: listing.id },
//              { countryCode: country.isoCode },
//              { viewers: ranUsers },
//              { upsert: true },
            .then( () => {
              singapore.addUser(user).catch(e => console.log("---------------------------1-----------------------"))
              return OnlineStatus.update(
                { userId: user.id },
                { online: casual.boolean },
                { upsert: true }
              )
            })
            .catch( e => console.log("Error: " + e))
          });
      });
    });
  });
});

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
