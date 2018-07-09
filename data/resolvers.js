import { createError, isInstance } from 'apollo-errors';
import { Providers } from './constants/';
import jwt from 'jsonwebtoken';
import Sequelize from 'sequelize';
import {
    User
  , Listing
  , View
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
  , Currency
  , Location
  , Image
  , FortuneCookie
  , Facebook
  , Oauth
  , Email
  , AWSS3
} from './connectors';

const Op = Sequelize.Op;

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
    },
    allCountries(_, args, context) {
      return Country.findAll();
    },
    allTemplates(_, args, context) {
      if (args.categoryId) {
        return Template.findAll({ where: { categoryId: args.categoryId }})
      } else {
        return Template.findAll();
      }
    },
    allCategories(_, args, context) {
      return Category.findOne({ where: { name: "root" }})
      .then( root => root.getChildren());
    },
    getChatMessages(_, args, context) {
      // Note: this returns chats, filtering the chat messages occurs at another step.
      return Chat.findAll({ where: { initUserId: context.userid }})
      .then( chats => {
        return chats.map( chat => {
          args.chatIndexes.map( chatIndex => {
            if ( chat.id == chatIndex.chatId ) {
              chat.lastMessageId = chatIndex.lastMessageId
            }
          })
        })
      })
    },
    searchListings(_, args, context) {
      let likeArray = args.terms.reduce( (acc, term) => {
        return acc.push({ [Op.like]: '%' + term.replace(/[^\W]+/) + '%' })
      }, []);
      return Listing.findAll({
        where: {
          [Op.or]: [{
            title: {
              [Op.or]: likeArray
            },
            description: {
              [Op.or]: likeArray
            },
          }]
        },
        order: [
          ['updatedAt', 'DESC']
        ],
        offset: (args.page - 1) * args.limit,
        limit: args.limit,
      })
    },
  //terms: [String], limit: Int = 20, page: Int = 1, filters: Filters): [Listing]
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
                  where: { profileName: nickname }
                , defaults: {
                    lastName: lastName
                  , firstName: firstName,
                }
              })
              .then( ([user, userCreated]) => {
                if (! userCreated) {
                  return User.findOrCreate({
                      where: { profileName: nickname + Math.floor(Math.random() * 100000) }
                    , defaults: {
                        lastName: lastName
                      , firstName: firstName,
                    }
                  })
                  .then( ([user, userCreated]) => {
                    if (! userCreated) {
                      throw new Error("Email created, but user already existed! Possible duplicate facebook name. Try a different login provider.");
                    }

                    user.addEmail(email).then( () => {
                      console.log("Add Email and Oauth to user");
                      user.addOauth(auth);
                    })
                    return user
                  })
                  //throw new Error("Email created, but user already existed! Possible duplicate facebook name. Try a different login provider.");
                }
                console.log("User created");
                user.addEmail(email).then( () => {
                  console.log("Add Email and Oauth to user");
                  user.addOauth(auth);
                })
                return user
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
        let currencyPromise = Currency.findOne({ where: { iso4217: args.currency }})
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
                          Promise.all( tags )
                          .then ( () => barterOption)
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
          let currencyPromise = Currency.findOne({ where: { iso4217: args.post.postCurrency }})
          Promise.all([exchangeModePromise, currencyPromise])
          .then( (values) => {
            let [exchangeMode, currency] = values;
            //console.log(exchangeMode);
            //console.log("Post currency input: ", args.post.postCurrency);
            //console.log("Post currency: ", currency);
            exchangeMode.setCurrency( currency )
            .then( () => {
              if (args.post.price) {
                exchangeMode.price = args.post.postCost;
                exchangeMode.save()
              }
              mode.addExchangeMode( exchangeMode );
            })
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
        return Promise.all([mode, listingPromise, currencyPromise])
      })
      .then( values => {
        let [mode, listing, currency] = values;
        // Handle images
        let imagePromises = args.images.map( inputImage => {
          if (inputImage.deleted) {
            if (!inputImage.exists) {
              // only delete if the image did NOT already exist.
              console.log( AWS.deleteObject( args.image.imageKey ) );
            }
            return null; //removed by the filter below.
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
        return Promise.all(imagePromises)
        .then( images => {
          //let [images, country] = values;
          let countryPromise = Country.findOne({where: {isoCode: args.countryCode}}).then( country => listing.setCountry(country));
          let addListingsPromise = listing.addImages(images);
          let categoryPromise = Category.findOne({ where: { id: args.category } }).then( cat => cat.addListing( listing ));
          let userPromise = User.findOne({ where: { id: context.userid }}).then( user => user.addListing( listing ));
          let templatePromise = listing.setTemplate( args.template ).catch( (e) => console.log("ERROR: Listing.setTemplate: ", e));
          let salemodePromise = listing.setSaleMode( mode ).catch( (e) => console.log("ERROR: Listing.setSaleMode: ", e));
          let tagPromises = args.tags.map( tagId => Tag.findOne({ where: {id: tagId} }));
          //return Promise.all([tagPromises, categoryPromise, userPromise])
          return Promise.all( tagPromises )
          .then( tags => {
            //let [tags, cat, user] = values;
            //console.log("TAGS: ", tags)
            console.log("Just before setting tags.")
            //return listing.setTags( tags )
            return listing.setTags( tags )
            //.then( () => Listing.findOne({ where: { id: listing.id}}));
          })
          .then( () => {
            return Promise.all( [countryPromise, categoryPromise, addListingsPromise, userPromise, templatePromise, salemodePromise] )
            .then( () => {
              return listing
            })
          })
        });
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
    },
    createChat(_, args, context) {
      return Chat.find({
        where: { initUserId: context.userid
               , recUserId: args.recUserId
               , listingId: args.listingId
               }
      })
      .then( chat => {
        if (!chat) {
          return Chat.create({})
          .then( chat => {
            let senderPromise = User.find({
              where: { id: context.userid }
            })
            let receiverPromise = User.find({
              where: { id: args.recUserId }
            })
            let listingPromise = Listing.find({
              where: { id: args.listingId }
            })
            return Promise.all([senderPromise, receiverPromise, listingPromise])
            .then( values => {
              let [sender, receiver, listing] = values;
              if (listing.userId != receiver.id) {
                chat.destroy({ force: true })
                throw new Error("Receiving user does not own that listing.");
              }
              if (!sender) {
                throw new Error("Sending user not found. This is probably an Authorization header problem.");
              }
              if (!receiver) {
                throw new Error("Receiving user not found.");
              }
              if (!listing) {
                throw new Error("Listing not found.");
              }
              chat.setInitUser(sender);
              chat.setRecUser(receiver);
              chat.setListing(listing);
              return chat;
            })
          })
        }
      })
    },
    sendChatMessage(_, args, context) {
      // create a message and add it [if image add image, if image & deleted, delete and do not add]
      // fetch all messages after lastMessageId
      return Chat.findOne({ where: { id: args.chatId }})
      .then( chat => {
        if (!chat) {
          throw new Error("Chat does not exist.");
        }
        if ( chat.initUserId == context.userid || chat.recUserId == context.userid ) {
          return ChatMessage.create({
            // TODO: Some protection from ridiculously large messages?
            message: args.message
          })
          .then( chatMessage => {
            if (args.image) {
              if (args.image.deleted) {
                if (!args.image.exists) {
                  // Only if the image doesn't exist somewhere else, delete it.
                  console.log( AWS.deleteObject( args.image.imageKey ) );
                }
              } else {
                //Image.findOne({where: { id: args.image.imageId }})
                //.then( image => chatMessage.setImage( image ))
                chatMessage.setImage( args.image.imageId );
              }
            }
            chatMessage.setAuthor( context.userid );
            return chat.addChatmessage( chatMessage )
            .then( () => {
              return chat.getChatmessages( {where: { id: { [Op.gt]: args.lastMessageId }}} )
            })
          })
        } else {
          // User doesn't belong in conversation
          throw new Error("User not a member of chat.");
        }
      })
    },
    deleteChatMessage(_, args, context) {
      return ChatMessage.findOne({ where: { id: args.id }})
      .then( chatmessage => {
        return Chat.findOne({ where: { id: chatmessage.chatId }})
        .then( chat => {
          if (chatmessage.authorId == context.userid) {
            //authorized to delete
            chat.getImage()
            .then( image => {
              console.log( AWS.deleteObject( image.imageKey ) );
            })
            // TODO: Delete s3 object corresponding to Image
            return chatmessage.destroy()
            .then( value => {
              console.log("Return value of destroy: ", value);
              return chat.getChatmessages( {where: { id: { [Op.gt]: args.lastMessageId }}} )
            })
          } else {
            throw new Error("User not authorized to delete this message.");
          }
        })
      })
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
      console.log("HERE HERE HERE HERE HERE HERE HERE HERE HERE");
      return User.findOne({ where: { id: listing.userId }});
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
  Country: {
    currencies(country) {
      return country.getCurrency();
    },
    languages(country) {
      return country.getLanguage()
      .then( languages => languages.map( lang => lang.name ));
    },
  },
  Category: {
    children(category) {
      return category.getChildren();
    },
  },
  Chat: {
    initUser(chat) {
      return chat.getInitUser();
    },
    recUser(chat) {
      return chat.getRecUser();
    },
    listing(chat) {
      return chat.getListing();
    },
    chatMessages(chat) {
      // Only include message id > lastMessageId
      if (chat.lastMessageId) {
        return chat.getChatmessage( {where: chatId > chat.lastMessageId } );
      } else {
        return chat.getChatmessage();
      }
    }
  },
  ChatMessage: {
    image(chat) {
      return chat.getImage();
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
