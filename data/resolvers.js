import { User, Listing, View, FortuneCookie } from './connectors';

const resolvers = {
  Query: {
    user(_, args) {
      return User.find({ where: args });
    },
    allUsers(_, args) {
      return User.findAll();
    },
    getFortuneCookie(_, args) {
      return FortuneCookie.getOne();
    }
  },
  User: {
    listings(user) {
      return user.getListings();
    }
  },
  Listing: {
    user(listing) {
      return listing.getUser();
    },
    views(listing) {
      return View.findOne({ listingId: listing.id }).then(view => view.views);
    }
  }
};

export default resolvers;
