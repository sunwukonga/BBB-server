import { User, Listing, View, OnlineStatus, Country, Image, FortuneCookie, Facebook, Oauth } from './connectors';
import { createError, isInstance } from 'apollo-errors';
import { Providers } from './constants/';
import jwt from 'jsonwebtoken';

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
      return Facebook.login( args )
      .then( res => {
        console.log(res);
        var names = res.name.split(' ');
        console.log(names);
        if ( (typeof res.email == "undefined") || (! /@/g.test(res.email)) ) {
          throw new Error("Oauth provider did not supply email. Login aborted.");
        }
        return Oauth.findOrCreate({
            where: { uid: res.id }
          , defaults: {
                provider: Providers.Facebook
              , name: res.name
              , email: res.email
              , picture: res.picture.data.url
            }
        })
        .then( (oauth, oauthCreated) => {
          if (oauthCreated) {
            console.log("Oauth record was created.");
            return Email.findOrCreate({
                where: { email: res.email }
              , defaults: {
                    primary: true
                }
            })
            .then( (email, emailCreated) => {
              if (emailCreated) {
                // Email didn't exist, therefore no user existed. Create new.
                console.log("Email didn't exist AND was created");
                return User.findOrCreate({
                  firstName: names.shift(),
                  lastName: names.join(' '),
                  profileName: res.name.replace(/\s+/g, ''),
                })
                .then( (user, userCreated) => {
                  if (! userCreated) {
                    throw new Error("Email created, but user already existed! Possible duplicate facebook name. Try a different login provider.");
                  }
                  console.log("User created");
                  user.addEmail(email).then( () => {
                    console.log("Add Email and Oauth to user");
                    user.addOauth(oauth);
                  })
                  return user;
                })
              } else {
                // Email existed. Therefore it SHOULD be linked to an existing User. Link oauth to this user.
                return User.findOne({ id: email.userId })
                .then( user => {
                  user.addOauth(oauth);
                  return user
                })
              }
            }).then( user => {
              console.log("Attempting to access user to create jwt token");
              console.log(user);
              var userToken = {
                  "userid": user.id
                , "role": [
                    {
                       "name": "GENERAL"
                    }
                  ]
              }
              return jwt.sign( JSON.stringify(userToken), process.env.JWT_SECRET_KEY );
            })
          }
        })
      })
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
