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

Mongoose.Promise = global.Promise;

const mongo = Mongoose.connect('mongodb://localhost/views', {
  useMongoClient: true
});

const db = new Sequelize('market', null, null, {
  dialect: 'sqlite',
  storage: './market.sqlite',
});

const UserModel = db.define('user', {
  firstName: { type: Sequelize.STRING },
  lastName: { type: Sequelize.STRING },
});

const ListingModel = db.define('listing', {
  title: { type: Sequelize.STRING },
  description: { type: Sequelize.STRING },
});

const ViewSchema = Mongoose.Schema({
  listingId: Number,
  views: Number,
});

UserModel.hasMany(ListingModel);
ListingModel.belongsTo(UserModel);

// create mock data with a seed, so we always get the same
casual.seed(123);
db.sync({ force: true }).then(() => {
  _.times(10, () => {
    return UserModel.create({
      firstName: casual.first_name,
      lastName: casual.last_name,
    }).then((user) => {
      return user.createListing({
        title: `A listing by ${user.firstName}`,
        description: casual.sentences(3),
      }).then((listing) => {
        // create some View mocks
        return View.update(
          { listingId: listing.id },
          { views: casual.integer(0, 100) },
          { upsert: true });
      });
    });
  });
});

const User = db.models.user;
const Listing = db.models.listing;
const View = Mongoose.model('views', ViewSchema);

export { User, Listing, View, FortuneCookie };
