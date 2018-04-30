import { createError, isInstance } from 'apollo-errors';
import { Providers } from './constants/';
import jwt from 'jsonwebtoken';
import {
    User
  , Listing
  , View
  , OnlineStatus
  , Country
  , SaleMode
  , Image
  , FortuneCookie
  , Facebook
  , Oauth
  , Email
  , AWSS3
} from './connectors';

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
      var names;
    var auth;
      return Facebook.login( args )
      .then( res => {
        console.log(res);
        names = res.name.split(' ');
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
      })
      .then( ([oauth, oauthCreated]) => {
        if (oauthCreated) {
          console.log("Oauth record was created.");
      auth = oauth;
          return Email.findOrCreate({
              where: { email: oauth.email }
            , defaults: {
                  primary: true
              }
          })
          .then( ([email, emailCreated]) => {
            if (emailCreated) {
              // Email didn't exist, therefore no user existed. Create new.
        // In future, need to check user context.userid
              console.log("Email didn't exist AND was created");
        var nickname = names.join('');
        var lastName = names.pop();
        var firstName = names.join(' ');
              return User.findOrCreate({
                  where: { firstName: firstName }
                , defaults: {
                    lastName: lastName
                  , profileName: nickname,
                }
              })
              .then( ([user, userCreated]) => {
                if (! userCreated) {
                  throw new Error("Email created, but user already existed! Possible duplicate facebook name. Try a different login provider.");
                }
                console.log("User created");
                user.addEmail(email).then( () => {
                  console.log("Add Email and Oauth to user");
                  user.addOauth(auth);
                })
                return user;
              })
            } else {
              // Email existed. Therefore it SHOULD be linked to an existing User. Link oauth to this user.
              return User.findOne({ id: email.userId })
              .then( user => {
                user.addOauth(auth);
                return user
              })
            }
          }).then( user => {
            console.log("Attempting to access user to create jwt token");
            console.log(user);
            let userToken = {
                "userid": user.id
              , "role": [
                  {
                     "name": "GENERAL"
                  }
                ]
            }
            return jwt.sign( JSON.stringify(userToken), process.env.JWT_SECRET_KEY );
          })
        } else {
          let userToken = {
              "userid": oauth.userId
            , "role": [
                {
                   "name": "GENERAL"
                }
              ]
          }
          return jwt.sign( JSON.stringify(userToken), process.env.JWT_SECRET_KEY );
        }
      })
    },
    getSignedUrl(_, args, context) {
      if (context.userid !== "") {
        return AWSS3.getSignedUrl( args )
      }
    },
    createListing(_, args, context) {
      SaleMode.create({
          mode: args.mode
        , price: args.cost
        , counterOffer: args.counterOffer
        , currencyId: args.currency
      })
      .then( mode => {
        switch( args.mode ) {
          case 'SALE':
            // --ExchangeMode 
          case 'DONATE':

          case 'BARTER':
            //  args.barterTemplates <-- array of arrays containing {templateId, quantity}
            //  
            //  args.barterTemplates.map( array => {
            //    let barterOption = BarterOption.create({});
            //    array.map( template => {
            //      barterOption.addTemplate({ where: {id: template.templatedId}}, {through: {quantity: template.quantity}});
            //    })
            // })
            // -- createBarterOption
            // -- Template.findOne({ args.template
            // -- addBarterOption
            //  multiples depending on how many specified.
            //   --createBarterOptionTemplate
          case 'SALEBARTER':

        }
        return Listing.create({
            title: args.title
          , description: args.description
          , userId: context.userid
          , categoryId: args.category
          , templateId: args.template
          , saleModeId: mode.id
        })
      })
      .then( listing => {
        listing.setTags( args.tags.map( tagId => Tags.findOne({
            where: {id: tagId},
          }));
        listing.addMode();
      })
      //   createListing: context.userid, title, description, category
      //   addTemplate: template, tags
      //   createMode: mode{
      //     SALE: currency, cost, counterOffer
      //     BARTER: barterTemplates
      //     SALEBARTER: currency, cost, counterOffer, barterTemplates
      //     DONATE:
      //     }
      //   createDelivery: method{ftf, post}, address, cost, currency
      //   map over images, if discarded: delete S3 record and image ref in database, 
      //                            else: update Image with URL
      //   
    }
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
