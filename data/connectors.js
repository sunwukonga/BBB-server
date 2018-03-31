import Sequelize from 'sequelize';
import casual from 'casual';
import _ from 'lodash';
import Mongoose from 'mongoose';
import fetch from 'node-fetch';

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
    return fetch(`https://graph.facebook.com/me?access_token=${args.token}`)
      .then(res => res.json())
      .then(res => {
        // What needs to happen here:
        //   get profile 
        //   Square photo https://graph.facebook.com/{facebookId}/picture?type=square
        //   use redirect=0 to get JSON description (incl. url) instead of image itself
        //   USE ALL info to create a NEW user if the facebookId is not found.
        //   RETURN our jwt token with authorization and user info encoded
        console.log(res);
        return 'Dummy response in place of valid jwt token';
        //return res[0].fortune.message;
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
});

const ListingModel = db.define('listing', {
  title: { type: Sequelize.STRING },
  description: { type: Sequelize.STRING },
  saleMode: { type: Sequelize.STRING },
  currency: { type: Sequelize.STRING },
  currencySymbol: { type: Sequelize.STRING },
  salePrice: { type: Sequelize.INTEGER },
});
// Attach barterItems
// Attach location

const ChatModel = db.define('chat', {
  initUserAddress: { type: Sequelize.STRING },
  recUserAddress: { type: Sequelize.STRING },
},{
  timestamps: true
});

const CountryModel = db.define('country', {
  isoCode: { type: Sequelize.STRING, primaryKey: true },
  name: { type: Sequelize.STRING },
  currency: { type: Sequelize.STRING },
  tld: { type: Sequelize.STRING },
  language: { type: Sequelize.STRING },
});

const LocationModel = db.define('location', {
  latitude: { type: Sequelize.FLOAT },
  longitude: { type: Sequelize.FLOAT },
  address: { type: Sequelize.STRING },
  description: { type: Sequelize.STRING },
});

const EmailModel = db.define('email', {
  email: { type: Sequelize.STRING },
  primary: { type: Sequelize.BOOLEAN },
  verified: { type: Sequelize.BOOLEAN },
  //TODO: probably needs a verification code to match against.
});

// Later associate images with templates
const ImageModel = db.define('image', {
  imageURL: { type: Sequelize.STRING },
  // flagging
  // ratings
  // author
  // template
});

// Join table for ListingModel and ImageModel
const ListingImagesModel = db.define('listingImages', {
  primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false  },  // Only one TRUE ONCE for each listingId. Not constrained here.
});
//const BarterGroupModel = db.define('barterGroup');

// ****************************
// Relationships between tables
// ****************************

// User Model
ChatModel.belongsTo(UserModel);
ListingModel.belongsTo(UserModel);
UserModel.belongsToMany(ListingModel, {as: 'Like', through: 'listingLikes'}); // UserModel.createLike, getLikes, setLikes, addLike,addLikes
CountryModel.hasMany(UserModel, {as: 'User', foreignKey: 'country'});
UserModel.hasMany(EmailModel);
UserModel.belongsTo(ImageModel, {as: 'profileImage'});
//UserModel.belongsTo(CountryModel, {foreignKey: 'country', targetKey: 'isoCode'});
// Listing Model
UserModel.hasMany(ListingModel); //UserModel has setListingModel method; ListingModel has a userId foreign key
ListingModel.belongsToMany(UserModel, {as: 'Like', through: 'listingLikes'});// ListingModel.createLike, getLikes, setLikes, addLike,addLikes

//ListingModel.belongsTo(ImageModel, {as: 'primaryImage'}); // No need. Add to through model.
ListingModel.belongsToMany(ImageModel, {as: 'Image', through: 'listingImages'}); //listingImages model has 'primary' field

// Chat Model
ChatModel.belongsTo(UserModel, {as: 'initUser'});
ChatModel.belongsTo(UserModel, {as: 'recUser'});
ChatModel.belongsTo(ListingModel);
// SaleMode Model

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
  return CountryModel.create({
      isoCode: 'SG'
    , name: 'Singapore'
    , currency: 'SGD'
    , tld: 'sg'
    , language: 'eng'
  }).then ( (country) => {
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
        return user.createListing({
          title: `A listing by ${user.firstName}`,
          description: casual.sentences(3),
          saleMode: 'SALE',
          currency: 'SGD',
          currencySymbol: '$',
          salePrice: (Math.floor(casual.double(100, 1000)) / 100),
        }).then((listing) => {
          listing.createImage({imageURL: 'Images.Trollie'}, { through: { primary: true }});
          listing.createImage({imageURL: 'Images.Trollie'});
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
const Image = db.models.image;
const View = Mongoose.model('views', ViewSchema);
const OnlineStatus = Mongoose.model('onlineStatus', OnlineSchema);

export { User, Listing, View, OnlineStatus, Country, Image, FortuneCookie, Facebook };
