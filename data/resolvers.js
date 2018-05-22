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
    },
    // TODO: This query cannot be accessible by normal users.
    allImages(_, args, context) {
      return Image.findAll();
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
              return User.findOne({ where: { id: email.userId }})
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
      if (context.userid == "") {
        throw new Error("Authorization header does not contain a user authorized for this mutation.");
      }
      let submittedMode = {mode: args.mode}
      if (args.cost >= 0)
        submittedMode.price = args.cost
      else if (args.mode == "SALE")
        throw new Error("SALE mode must have an associated cost, even if it's zero.");
      if (args.counterOffer)
        submittedMode.counterOffer = (args.counterOffer ? true : false)
      return SaleMode.create( submittedMode )
      .then( mode => {
        console.log("## Find Currency ###");
        Currency.findOne({ where: { currency: args.currency }})
        .then( currency => {
         // console.log("Listing Currency input: ", args.currency);
          //console.log("Listing Currency: ", currency);
          mode.setCurrency( currency ).catch( (e) => console.log("ERROR: Mode.setCurrency: ", e));
        });
        console.log("SaleMode created");
        if (args.mode == "BARTER" || args.mode == "SALEBARTER") {
          if (args.barterTemplates && args.barterTemplates.length > 0) {
            let barterPromises = args.barterTemplates.map( barterOptionsData => {
              return BarterOption.create({})
              .then( barterOption => {
                console.log("Create barter option: ", barterOptionsData);
                barterOptionsData.map( barterOptionData => {
                  Template.findOne({ where: { id: barterOptionData.templateId }})
                  .then( template => {
                    barterOption.addTemplate(template, { through: { quantity: barterOptionData.quantity }})
                    .then( values => {
                      let barterOptionTemplate = values[0][0];
                      if (barterOptionData.tags && barterOptionData.tags.length > 0) {
                        let tagPromises = barterOptionData.tags.map( tagId => Tag.findOne({ where: { id: tagId }}))
                        Promise.all( tagPromises )
                        .then( tags => {
                          tags.map( tag => barterOptionTemplate.addTag( tag ));
                        });
                      }
                    })
                  });
                })
                //console.log("BarterOption: ", barterOption);
                return barterOption;
              })
            });
            Promise.all( barterPromises )
            .then( barterOptions => {
              //console.log("Barter Options: ", barterOptions);
              //barterOptions.map( barterOption => barterOption.setSaleMode( mode ));
              mode.addBarterOptions( barterOptions );
              //barterOptions.map( barterOption => mode.addBarterOption( barterOption ));
            });
          }
        } //END Adding Barter templates and tags.
        if (args.post) {
          // Postage
          let exchangeModePromise = ExchangeMode.create({ mode: "POST" })
          let currencyPromise = Currency.findOne({ where: { currency: args.post.postCurrency }})
          Promise.all([exchangeModePromise, currencyPromise])
          .then( (values) => {
            let [exchangeMode, currency] = values;
            //console.log(exchangeMode);
            //console.log("Post currency input: ", args.post.postCurrency);
            //console.log("Post currency: ", currency);
            exchangeMode.setCurrency( currency );
            if (args.post.price) {
              exchangeMode.price = args.post.postCost;
              exchangeMode.save()
            }
            mode.addExchangeMode( exchangeMode );
          })
        }

        if (args.address) {
          // Face to face
          let submittedAddress = {}
          if (args.address.latitude && args.address.longitude) {
            submittedAddress.latitude = args.address.latitude
            submittedAddress.longitude = args.address.longitude
          }
          if (args.address.lineOne)
            submittedAddress.lineOne = args.address.lineOne
          if (args.address.lineTwo)
            submittedAddress.lineTwo = args.address.lineTwo
          if (args.address.postcode)
            submittedAddress.postcode = args.address.postcode
          if (args.address.description)
            submittedAddress.description = args.address.description
          let exchangeModePromise = ExchangeMode.create({ mode: "FACE" })
          let locationPromise = Location.create(submittedAddress);
          Promise.all([exchangeModePromise, locationPromise])
          .then( values => {
            let [exchangeMode, loc] = values;
            exchangeMode.setLocation( loc )
            mode.addExchangeMode( exchangeMode );
          });
        }

        let listingPromise = Listing.create({
            title: args.title
          , description: args.description
        }).catch( (e) => console.log("ERROR: ListingPromise: ", e));
        return Promise.all([mode, listingPromise])
      })
      .then( values => {
        let [mode, listing] = values;
        // Handle images
        let imagePromises = args.images.map( inputImage => {
          if (inputImage.deleted) {
            // Delete reference in database
            // Delete instance on S3
            return null;
          } else {
            return Image.findOne({where: {id: inputImage.imageId}})
            .then( image => {
              image.listingImages = {
                primary: inputImage.primary
              }
              return image;
            });
          }
        }).filter( image => image );
        Promise.all(imagePromises)
        .then( images => {
          listing.addImages(images);
        });
        console.log("Before attaching category");
        let categoryPromise = Category.findOne({ where: { id: args.category } }).then( cat => cat.addListing( listing ));
        //console.log("User ID: ", context.userid);
        let userPromise = User.findOne({ where: { id: context.userid }}).then( user => user.addListing( listing ));
        listing.setTemplate( args.template ).catch( (e) => console.log("ERROR: Listing.setTemplate: ", e));
        listing.setSaleMode( mode ).catch( (e) => console.log("ERROR: Listing.setSaleMode: ", e));
        let tagPromises = args.tags.map( tagId => Tag.findOne({ where: {id: tagId} }));
        return Promise.all(tagPromises, categoryPromise, userPromise)
        .then( values => {
          let [tags, cat, user] = values;
          console.log("User added to Listing...");
          return listing.setTags( tags )
          .then( () => Listing.findOne({ where: { id: listing.id}}));
        })
      })
      // Add images, deleting where necessary.
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
    saleMode(listing) {
      return listing.getSaleMode();
    },
    template(listing) {
      return listing.getTemplate();
    },
    views(listing) {
      return View.findOne({ listingId: listing.id }).then(view => (view ? view.views : null));
    },
    primaryImage(listing) {
//      listing.getImage().then(images => images.filter(image => image.listingImages.dataValues.primary == true).map(image => console.log(image.listingImages.dataValues.primary)));
      return listing.getImages().then(images => images.filter(image => image.listingImages.dataValues.primary == true)).then(images => images[0]);
    },
    secondaryImages(listing) {
      return listing.getImages().then(images => images.filter(image => image.listingImages.dataValues.primary == false));
    },
    tags(listing) {
      return listing.getTags();
    }
  },
  SaleMode: {
    currency(saleMode) {
      return saleMode.getCurrency();
    },
    exchangeModes(saleMode) {
      //console.log( Object.getOwnPropertyNames(saleMode));
      return saleMode.getExchangeModes().then( exchangeMode => {
        //console.log("Exchange Modes: ", exchangeMode);
        return exchangeMode;
      });
    },
    barterOptions(saleMode) {
      return saleMode.getBarterOptions().then( barterOptions => {
        return barterOptions.map( barterOption => {
          //console.log("First: ", barterOption);
          //console.log("log: ", Object.getOwnPropertyNames( barterOption ));
          return BarterOptionTemplates.findAll( {where: { barterOptionId: barterOption.id}} );
          // [[ { Template, Int, [String] } ]]
          // [[ { template, quantity, tags } ]]
        });
      });
    }
  },
  BarterOption: {
    template(barterOptionTemplate) {
      //console.log("Barter Option: ", barterOptionTemplates);
      //barterOptionTemplates.map( barterOptionTemplate => Template.findOne( {where: { id: barterOptionTemplate.templateId }} ) );
      return Template.findOne( {where: { id: barterOptionTemplate.templateId }} );
    },
    tags(barterOptionTemplates) {
      return barterOptionTemplates.getTags();
    }
  },
  Template: {
    tags(template) {
      return template.getTags();
    }
  },

};

export default resolvers;
