import { User, Listing, View, OnlineStatus, Country, Image, FortuneCookie } from './connectors';
import { createError, isInstance } from 'apollo-errors';

const FooError = createError('FooError', {
  message: 'A foo error has occurred'
});

const resolvers = {
  Query: {
    user(_, args, context) {
      //throw new FooError({
     //   data: context
      //});
      return User.find({ where: args });
    },
    allUsers(_, args, context) {
      //console.log("This is a test: " + context.user);
      return User.findAll();
    },
    getFortuneCookie(_, args) {
      return FortuneCookie.getOne();
    }
  },
  Mutation: {
    loginFacebook(_, args) {
      return Facebook.login( args );
      // Get info from Facebook. Check email and facebook userId. If not exist, create user. Return our jwt token.
    },
  },
  User: {
    listings(user) {
      return user.getListings();
    },
    online(user) {
      // OnlineStatus is Mongoose, not sqlite
      return OnlineStatus.findOne({ userId: user.id }).then(is => is.online);
    },
    country(user) {
      return Country.findOne({ where: { isoCode: user.country }});
    },
    profileImage(user) {
      return user.getProfileImage();
    },
  },
  Listing: {
    user(listing) {
      return listing.getUser();
    },
    views(listing) {
      return View.findOne({ listingId: listing.id }).then(view => view.views);
    },
    primaryImage(listing) {
//      listing.getImage().then(images => images.filter(image => image.listingImages.dataValues.primary == true).map(image => console.log(image.listingImages.dataValues.primary)));
      return listing.getImage().then(images => images.filter(image => image.listingImages.dataValues.primary == true)).then(images => images[0]);
    },
    secondaryImages(listing) {
      return listing.getImage().then(images => images.filter(image => image.listingImages.dataValues.primary == false));
    },
  }
};

export default resolvers;
