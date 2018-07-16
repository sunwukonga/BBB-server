import { createError, isInstance } from 'apollo-errors';
import { Providers } from './constants/';
import Modes from './constants/Modes';
import jwt from 'jsonwebtoken';
import Sequelize from 'sequelize';
import AWS from 'aws-sdk';
import { BadUserInputError } from 'apollo-server-express';
import {
    User
  , Listing
//  , View
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
      return User.find({ where: args });
    },
    // TODO: This query cannot be accessible by normal users.
    allUsers(_, args, context) {
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
    getListing(_, args, context) {
      return Listing.find({ where: { id: args.id}})
        .catch( e => Promise.reject(new Error("Possible User Error: check id. Error: " + e.message)))
    },
    getRecentListings(_, args, context) {
      return Listing.findAll({
        where: {
          createdAt: {
            [Op.gt]: new Date(new Date() - 1209600000) // 1209600000 seconds = 14 days
          }
        },
        include: {
          model: Country,
          where: { isoCode: args.countryCode }
        },
        order: [
          ['updatedAt', 'DESC']
        ],
        offset: (args.page - 1) * args.limit,
        limit: args.limit,
      })
        .catch( e => Promise.reject(new Error("Possible User Error: check countryCode. Error: " + e.message)))
    },
    getLikedListings(_, args, context) {
      return Listing.findAll({
        include: [
          {
            model: Country,
            where: { isoCode: args.countryCode },
            required: true
          },
          {
            model: User,
            as: 'Like',
            where: {
              id: context.userid,
            },
            required: true
          },
        ],
        order: [
          ['updatedAt', 'DESC']
        ],
        offset: (args.page - 1) * args.limit,
        limit: args.limit,
      })
    },
    getVisitedListings(_, args, context) {
      return Listing.findAll({
        subQuery: false,
        include: [
          {
            model: Country,
            where: { isoCode: args.countryCode },
            required: true,
          },
          {
            model: User,
            as: 'Views',
            attributes: [
              [Sequelize.fn('COUNT', Sequelize.col('listing.id')), 'viewers']
            ],
            through: {
              //attributes: [],
              group: ['listingViews.listingId'],
            },
            required: true,
          },
        ],
        group: ['listing.id'],
        order: [
//          [{ model: User, as: 'Views' }, 'viewers', 'DESC']
          [Sequelize.literal('`Views.viewers`'), 'DESC']
        ],
        offset: (args.page - 1) * args.limit,
        limit: args.limit,
      })
      .then( result => {
        console.log("---------------------------------------------------------------")
        console.log("REsult: " + JSON.stringify(result))
        console.log("---------------------------------------------------------------")
        return result
      })
    },
    getChatMessages(_, args, context) {
      // Note: this returns chats, filtering the chat messages occurs at another step.
      return Chat.findAll({
        where: {
          initUserId: context.userid,
        }
      })
      .then( chats => {
        return chats.map( chat => {
          args.chatIndexes.map( chatIndex => {
            console.log("chat.id: " + chat.id)
            if ( chat.id == chatIndex.chatId ) {
              chat.lastMessageId = chatIndex.lastMessageId
            }
          })
          return chat
        })
      })
    },
    searchListings(_, args, context) {
      let whereBlock = {
        createdAt: {
          [Op.gt]: new Date(new Date() - args.filters.seconds * 1000)
        },
      }
      if (args.terms) {
        let likeArray = args.terms.reduce( (acc, term) => {
            acc.push({ [Op.like]: '%' + term.replace(/[\W]+/, "") + '%' })
            return acc
          }
          , new Array())
        whereBlock = {
          [Op.or]: {
            title: {
              [Op.or]: likeArray
            },
            description: {
              [Op.or]: likeArray
            },
          },
          createdAt: {
            [Op.gt]: new Date(new Date() - args.filters.seconds * 1000)
          },
        }
      }

      // TODO:
      // args.filters.distance Long lat must be stored. Then calculate and exclude each.
      // Categories, Templates, Tags
      return Listing.findAll({
        where: whereBlock,
        include: [{
            model: SaleMode,
            as: 'saleMode',
            where: {
              counterOffer: args.filters.counterOffer ? args.filters.counterOffer : { [Op.or]: [ true, false ] },
              mode: args.filters.mode ? args.filters.mode : { [Op.or]: [ Modes.Barter, Modes.Sale, Modes.Donate, Modes.SaleBarter ] },
              price: {
                [Op.or]: {
                  [Op.lte]: args.filters.priceMax,
                  [Op.gte]: args.filters.priceMin
                }
              },
            }
          },
          {
            model: Country,
            where: { isoCode: args.filters.countryCode }
          },
          {
            model: User,
            as: 'user',
            where: Sequelize.and(
              Sequelize.where(Sequelize.literal('sellerRating & ' + args.filters.rating), '!=', 0),
              Sequelize.where(Sequelize.literal('idVerification & ' + args.filters.verification), '!=', 0)
            )
          }
        ],
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
      let promiseCollection = []
      if (context.userid == "") {
        throw new Error("Authorization header does not contain a user authorized for this mutation.");
      }
      let submittedMode = {mode: args.mode}
      if (args.cost >= 0)
        submittedMode.price = args.cost
      else if (args.mode == Modes.Sale)
        throw new Error("SALE mode must have an associated cost, even if it's zero.");
      if (args.counterOffer)
        submittedMode.counterOffer = (args.counterOffer ? true : false)
      return SaleMode.create( submittedMode )
      .then( mode => {
        //let currencyPromise = Currency.findOne({ where: { iso4217: args.currency }})
        let currencyPromise = Currency.findOne({ where: { iso4217: args.currency }})
        .then( currency => {
          return mode.setCurrency( currency ).catch( (e) => console.log("ERROR: Mode.setCurrency: ", e));
        })
        .catch( (e) => {
          console.log("Error: Currency.findOne where iso4217 is args.currency");
          throw new Error("Couldn't find the currency you were looking for.");
        })
        promiseCollection.push( currencyPromise )
        console.log("SaleMode created");
        if (args.mode ==  Modes.Sale || args.mode == Modes.SaleBarter) {
          if (args.barterTemplates && args.barterTemplates.length > 0) {
            let barterPromises = args.barterTemplates.map( barterOptionsData => {
              return BarterOption.create({})
              .then( barterOption => {
                let barterOptionPromises = barterOptionsData.map( barterOptionData => {
                  return Template.findOne({ where: { id: barterOptionData.templateId }})
                  .then( template => {
                    if (!template) {
                      console.log("barterTemplates: invalid templateId supplied");
                      return Promise.reject(new Error("barterTemplates: invalid templateId. ", { invalidArgs: barterOptionDate.templateId }))
                    }
                    return barterOption.addTemplate(template, { through: { quantity: barterOptionData.quantity }})
                    .then( values => {
                      let barterOptionTemplate = values[0][0];
                      if (barterOptionData.tags && barterOptionData.tags.length > 0) {
                        let tagPromises = barterOptionData.tags.map( tagId =>
                          Tag.findOne({ where: { id: tagId }})
                          .then( tag => {
                            if (!tag) {
                              console.log("User Error> barterTemplates: tags: invalid tagId supplied");
                              return Promise.reject(new Error("barterTemplates: tags: invalid tagId. ", { invalidArgs: tagId }))
                            } else {
                              return tag
                            }
                          })
                        );
                        return Promise.all( tagPromises )
//                        .catch( e => {
//                          console.log("______###### setTags on barterOptionTemplate has a problem." + e);
//                          return Promise.reject(e)
//                        })
                        .then( tags => {
                          return barterOptionTemplate.setTags( tags )
                          .then( () => tagPromises)
                        })
                      }
                    })
//                    .catch( e => {
//                      console.log("______###### Catching 2nd level out" + e);
//                      return Promise.reject(e)
//                    })
                  })
//                  .catch( e => {
//                    console.log("______###### Catching 3rd level out" + e);
//                    return Promise.reject(e)
//                  })
                }) // End map
                return Promise.all( barterOptionPromises )
//                .catch( e => {
//                  console.log("_____##### Catching 4th Level out: " + e)
//                  return Promise.reject(e)
//                })
                .then( () => barterOption )
              })
//              .catch( e => {
//                console.log("_____##### Catching 5th Level out: " + e)
//                return Promise.reject(e)
//              })
            }); // End Map
            // Here's the problem: We're returning when we should wait.
            let barterReturnPromise = Promise.all( barterPromises )
//            .catch( e => {
//              console.log("_____##### Catching 6th Level out: " + e)
//              return Promise.reject(e)
//            })
            .then( barterOptions => {
              return mode.addBarterOptions( barterOptions )
              .catch( e => {
                return Promise.reject(new Error("barterTemplates: problem adding barterOptions to saleMode"))
              })
            });
            promiseCollection.push( barterReturnPromise )
          } //END IF --> barterTemplates has values
        } //END IF --> Sale mode or Sale & Barter mode
        if (args.post) {
          console.log("___________________________________________")
          console.log("Entering post method")
          console.log("___________________________________________")
          // Postage
          let exchangeModePromise = ExchangeMode.create({ mode: Modes.Post })
            .then( exMode => {
              if (!exMode) {
                console.log("Internal Error> ExchangeMode: create");
                return Promise.reject(new Error("Internal Error: ExchangeMode: create.", { invalidArgs: Modes.Post }))
              } else {
                return exMode
              }
            })
          let currencyPromise = Currency.findOne({ where: { iso4217: args.post.postCurrency }})
            .then( postCurrency => {
              if (!postCurrency) {
                console.log("User Error> postCurrency");
                return Promise.reject(new Error("User Error: postCurrency", { invalidArgs: args.post.postCurrency }))
              } else {
                return postCurrency
              }
            })
          let postPromises = Promise.all([exchangeModePromise, currencyPromise])
          .then( values => {
            console.log("___________________________________________")
            console.log("VALUES 1: " + values)
            console.log("___________________________________________")
            let [exchangeMode, currency] = values;
            exchangeMode.setCurrency( currency )
            .then( () => {
              if (args.post.price) {
                exchangeMode.price = args.post.postCost;
                exchangeMode.save()
              }
              return mode.addExchangeMode( exchangeMode )
              .then( addExchangeMode => {
                if (!addExchangeMode) {
                  console.log("Internal Error> mode.addExchangeMode");
                  return Promise.reject(new Error("Internal Error: mode.addExchangeMode"))
                } else {
                  return addExchangeMode
                }
              })
            })
          })
          promiseCollection.push( postPromises )
        }

        if (args.address) {
          console.log("___________________________________________")
          console.log("Entering ftf method")
          console.log("___________________________________________")
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
          let exchangeModePromise = ExchangeMode.create({ mode: Modes.Face })
          let locationPromise = Location.create(submittedAddress);
          Promise.all([exchangeModePromise, locationPromise])
          .then( values => {
            let [exchangeMode, loc] = values;
            exchangeMode.setLocation( loc )
            mode.addExchangeMode( exchangeMode );
          });
        }

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
          return Listing.create({
              title: args.title
            , description: args.description
          }).catch( (e) => console.log("ERROR: ListingPromise: ", e))
          .then( listing => {
            let countryPromise = Country.findOne({where: {isoCode: args.countryCode}}).then( country => listing.setCountry(country));
            let addListingsPromise = listing.addImages(images);
            let categoryPromise = Category.findOne({ where: { id: args.category } }).then( cat => cat.addListing( listing ));
            let userPromise = User.findOne({ where: { id: context.userid }}).then( user => user.addListing( listing ));
            let templatePromise = listing.setTemplate( args.template ).catch( (e) => console.log("ERROR: Listing.setTemplate: ", e));
            let salemodePromise = listing.setSaleMode( mode ).catch( (e) => console.log("ERROR: Listing.setSaleMode: ", e));
            let tagPromises = args.tags.map( tagId => Tag.findOne({ where: {id: tagId} }).catch( (e) => { console.log("Error: " + e); return Promise.reject(new Error("User Error: listing: tagId")) }))
            return Promise.all( tagPromises )
            .then( tags => {
              return listing.setTags( tags )
              .catch( e => {
                console.log("_____##### Error setting tags on listing: " + e)
                return Promise.reject(new Error("User Error: listing: tags"))
              })
              .then( () => {
                return Promise.all( [countryPromise, categoryPromise, addListingsPromise, userPromise, templatePromise, salemodePromise].concat( promiseCollection ) )
//                .catch( e => {
//                  console.log("_____##### Catching 7th Level out: " + e)
//                  return Promise.reject(e)
//                })
                .then( () => {
                  return listing
                })
              })
//              .catch( e => {
//                console.log("_____##### Catching 8th Level out: " + e)
//                return Promise.reject(e)
//              })
            })
//            .catch( e => {
//              console.log("_____##### Catching 9th Level out: " + e)
//              return Promise.reject(e)
//            })
          })
//            .catch( e => {
//              console.log("_____##### Catching 11th Level out: " + e)
//              return Promise.reject(e)
//            })
        })
//            .catch( e => {
//              console.log("_____##### Catching 12th Level out: " + e)
//              return Promise.reject(e)
//            })
      })
//            .catch( e => {
//              console.log("_____##### Catching 13th Level out: " + e)
//             return Promise.reject(e)
//           })
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
    incrementViews(_, args, context) {
      return Listing.getViews({where: {listingId: context.userid }})
      .then( listing => {
        console.log("CHECK return of getViews: " + listing)
        return 1
      })
    },
    likeListing(_, args, context) {
      return Listing.findOne({ where: { id: args.listingId }})
      .then( listing => {
        if (!listing) {
          return Promise.reject(new Error("User Error: Invalid listingId"))
        }
        if (listing.userId == context.userid) {
          return Promise.reject(new Error("User Error: You cannot like your own listing"))
        }
        if (args.like) {
          return listing.addLike(context.userid)
          .catch( e => Promise.reject(new Error("User Error: You cannot like a listing twice")))
          .then( () => {
            return true
          })
        } else {
          return listing.removeLike(context.userid)
          .then( () => {
            // response always 0
            return true
          })
        }
      })
    },
    createChat(_, args, context) {
      return Chat.find({
        where: {
                 recUserId: args.recUserId
               , initUserId: context.userid
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
          return Promise.reject( new Error("chatId does not exist."))
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
              return chat.getChatmessages({
                where: {
                  id: {
                    [Op.gt]: args.lastMessageId ? args.lastMessageId : 0
                  }
                }
              })
            })
          })
        } else {
          // User doesn't belong in conversation
          return Promise.reject(new Error("User not a member of chat."))
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
      return User.findOne({ where: { id: listing.userId }});
    },
    saleMode(listing) {
      console.log("------------------------------------")
      console.log("SALEMODE " + JSON.stringify(listing))
      console.log("------------------------------------")
      return listing.getSaleMode();
    },
    template(listing) {
      return listing.getTemplate();
    },
    viewers(listing) {
      if (listing.Views) {
        return listing.Views[0].dataValues.viewers
      }
      return listing.countViews()
    },
    likes(listing) {
      return listing.countLike()
    },
    liked(listing, _, context) {
      return listing.hasLike(context.userid)
    },
    chatExists(listing, _, context) {
      return Chat.find({ where: {
          initUserId: context.userid,
          recUserId: listing.userId,
          listingId: listing.id
        }
      })
      .then( chat => chat ? true : false )
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
        return chat.getChatmessages( {where: { id: { [Op.gt]: chat.lastMessageId }}} )
      } else {
        return chat.getChatmessages();
      }
    }
  },
  ChatMessage: {
    image(chat) {
      return chat.getImage();
    }
  },
  BarterOption: {
    template(barterOptionTemplates) {
      //console.log("Barter Option: ", barterOptionTemplates);
      //barterOptionTemplates.map( barterOptionTemplate => Template.findOne( {where: { id: barterOptionTemplate.templateId }} ) );
      return Template.findOne( {where: { id: barterOptionTemplates.templateId }} );
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
