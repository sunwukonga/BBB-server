import { createError, isInstance } from 'apollo-errors';
import { Providers } from './constants/';
import Modes from './constants/Modes';
import Roles from './constants/roles';
import jwt from 'jsonwebtoken';
import Sequelize from 'sequelize';
import AWS from 'aws-sdk';
import { BadUserInputError } from 'apollo-server-express';
import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';
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
} from './connectors';

const Op = Sequelize.Op;

const FooError = createError('FooError', {
  message: 'A foo error has occurred'
});

const resolvers = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue(value) {
      return new Date(value); // value from the client
    },
    serialize(value) {
      return value.getTime(); // value sent to the client
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return new Date(ast.value) // ast value is always in string format
      }
      return null;
    },
  }),
  Query: {
    user(_, args, context) {
      if (context.roles.includes(Roles.Super)) {
        //Authorized to check everyone's user record
        return User.find({ where: args });
      }
      if (context.roles.includes(Roles.Admin)) {
        //Authorized to check user records of administered country.
        return User.find({
          where: args,
          include: {
            model: Country,
            as: 'Country',
            where: { isoCode: context.countryCode }
          },
        });
      }
      return Promise.reject(new Error("User not authorized to access this user's record."))
    },
    getProfile(_, args, context) {
      if (context.userid == "") {
        throw new Error("Authorization header does not contain a user.");
      }
      return User.find({ where: {id: context.userid }});
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
    allCategoriesFlat(_, args, context) {
      return Category.findAll({ where: { id: { [Op.gt]: 1 }}})
    },
    allCategoriesNested(_, args, context) {
      return Category.findOne({ where: { name: "root" }})
        .then( root => root.getChildren());
    },
    getListing(_, args, context) {
      return Listing.find({ where: { id: args.id}})
        .catch( e => Promise.reject(new Error("Possible User Error: check id. Error: " + e.message)))
    },
/*
  # For SUPER + ADMIN returns most highly rated
  # For other roles, returns most highly rated, unless content has been added by calling user.
  getContent(
    locusId: Int!
    countryCode: String!
    languageCodes: [String]!
    preferMyContent: Boolean = true
  ): [Locus]
  */

    getContent(_, args, context) {
      return Locus.findById( args.locusId )
    },
    getMostRecentListings(_, args, context) {
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
    getUserPostedListings(_, args, context) {
      return Listing.findAll({
    //    paranoid: false,
        where: {
          userId: context.userid
        },
        include: {
          model: Country,
          where: { isoCode: args.countryCode },
          required: true,
        },
        order: [
          ['updatedAt', 'DESC']
        ],
        offset: (args.page - 1) * args.limit,
        limit: args.limit,
      })
        .catch( e => Promise.reject(new Error("Possible User Error: check countryCode. Error: " + e.message)))
    },
    getMostLikedListings(_, args, context) {
      return Listing.findAll({
        subQuery: false,
        include: [
          {
            model: Country,
            where: { isoCode: args.countryCode },
            required: true
          },
          {
            model: User,
            as: 'Like',
            attributes: [
              [Sequelize.fn('COUNT', Sequelize.col('listing.id')), 'likes']
            ],
            through: {
              group: ['listingLikes.listingId'],
            },
            required: true,
          },
        ],
        group: ['listing.id'],
        order: [
          [Sequelize.literal('`Like.likes`'), 'DESC']
        ],
        offset: (args.page - 1) * args.limit,
        limit: args.limit,
      })
    },
    getMostVisitedListings(_, args, context) {
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
    },
    getUserVisitedListings(_, args, context) {
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
            where: { id: context.userid },
            required: true,
          },
        ],
        order: [
          ['updatedAt', 'DESC']
        ],
        offset: (args.page - 1) * args.limit,
        limit: args.limit,
      })
    },
    getUserLikedListings(_, args, context) {
      return Listing.findAll({
        subQuery: false,
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

    getChatMessages(_, args, context) {
      // Note: this returns chats, filtering the chat messages occurs at another step.
            //Sequelize.literal("`listing`.`userId` = " + context.userid)
      return Chat.findAll({
        where: {
          [Op.or]: {
            initUserId: context.userid,
            '$Listing.userId$': context.userid
          },
          delRequestUserId: {
            [Op.ne]: context.userid
          }
        },
        include: [
          {
            model: Listing,
            where: { userId: context.userid },
            required: false
          },
        ],

      })
      .then( chats => {
        return chats.map( chat => {
          if (args.chatIndexes) {
            args.chatIndexes.map( chatIndex => {
              if ( chat.id == chatIndex.chatId ) {
                chat.lastMessageId = chatIndex.lastMessageId
              }
            })
          }
          return chat
        })
      })
    },
    searchTemplates(_, args, context) {
      let consolidatedPromises = []
      //---------------------------------------
      //  categories
      //---------------------------------------
      let categoryBlock = {
        model: Category,
        required: true
      }
      if (args.categoryIds && args.categoryIds.length > 0) {
        let childrenPromises = []
        const getAllChildren = ( catsPromise ) => {
          return catsPromise
          .then( cats => {
            if (cats && cats.length > 0) {
              return cats.reduce( (accP, cat) => {
                return Promise.all([accP])
                .then( values => {
                  let [acc] = values
                  acc.push( cat.id )
                  return getAllChildren( cat.getChildren() )
                  .then( allChildrenPromises => {
                    return Promise.all( allChildrenPromises )
                    .then( allChildren => {
                      let myAcc = acc.concat( allChildren )
                      return myAcc
                    })
                  })
                })
              }, Promise.resolve([]))
            } else {
              return []
            }
          })
        }
        let categoriesPromise = Promise.all( args.categoryIds.map( catId => Category.findById( catId )) )
        .then( cats => {
          cats = cats.filter( cat => cat )
          if (cats.length != 0) {
            return getAllChildren( Promise.resolve(cats) )
            .then( allCats => {
              categoryBlock.where = { id: { [Op.in]: allCats} }
            })
          } else {
            categoryBlock = {}
            //silent fail if no valid category found
            return false
          }
        })
        consolidatedPromises.push( categoriesPromise )
      } else {
        categoryBlock = {}
      }
      //---------------------------------------
      // End Categories
      //---------------------------------------
      let whereBlock = {}
      if (args.terms) {
        let likeArray = args.terms.reduce( (acc, term) => {
            acc.push({ [Op.like]: '%' + term.replace(/[\W]+/g, "") + '%' })
            return acc
          }, [])
        whereBlock = {
          [Op.or]: {
            title: {
              [Op.or]: likeArray
            },
            description: {
              [Op.or]: likeArray
            },
          },
          id: { [Op.gt]: 0 }
        }
      }
      let optionBlock = {
        offset: (args.page - 1) * args.limit,
        limit: args.limit,
      }
      if ( Object.keys(whereBlock).length !== 0 ) {
        optionBlock.where = whereBlock
      }
      if ( Object.keys(categoryBlock).length !== 0 ) {
        optionBlock.include = [ categoryBlock ]
      }
      return Promise.all( consolidatedPromises )
      .then( () => Template.findAll( optionBlock ) )
    },
    searchListings(_, args, context) {
      let consolidatedPromises = []
      let salemodeWhereBlock = {}
      if (args.filters.counterOffer) {
        salemodeWhereBlock.counterOffer = args.filters.counterOffer
      }
      if (args.filters.mode) {
        salemodeWhereBlock.mode = args.filters.mode
      }
      if (args.filters.priceMax) {
        if (args.filters.priceMin) {
          salemodeWhereBlock.price = {
            [Op.or]: {
              [Op.lte]: args.filters.priceMax,
              [Op.gte]: args.filters.priceMin
            }
          }
        } else {
          salemodeWhereBlock.price = {
            [Op.or]: {
              [Op.lte]: args.filters.priceMax,
            }
          }
        }
      } else {
        if (args.filters.priceMin) {
          salemodeWhereBlock.price = {
            [Op.or]: {
              [Op.gte]: args.filters.priceMin
            }
          }
        }
        // If nothing has been set by this point, both priceMin and priceMax were unset.
      }
      let salemodeModelBlock = {
        model: SaleMode,
        as: 'saleMode',
        required: true
      }
      if ( Object.keys(salemodeWhereBlock).length !== 0 ) {
        salemodeModelBlock.where = salemodeWhereBlock
      } else {
        salemodeModelBlock = {}
      }

      let userModelBlock = {
        model: User,
        as: 'user',
        required: true
      }
      let userWhereBlock = {}
      if (args.filters.rating != 63) {
        if (args.filters.verification != 31) {
          userWhereBlock = Sequelize.and(
            Sequelize.where(Sequelize.literal('sellerRating & ' + args.filters.rating), '!=', 0),
            Sequelize.where(Sequelize.literal('idVerification & ' + args.filters.verification), '!=', 0)
          )
        } else {
          userWhereBlock = Sequelize.where(Sequelize.literal('sellerRating & ' + args.filters.rating), '!=', 0)
        }
      } else {
        if (args.filters.verification != 31) {
          userWhereBlock = Sequelize.where(Sequelize.literal('idVerification & ' + args.filters.verification), '!=', 0)
        }
        // Both rating and verification don't care. No need for where block.
      }
      if ( Object.keys(userWhereBlock).length !== 0 ) {
        userModelBlock.where = userWhereBlock
      } else {
        userModelBlock = {}
      }
      //---------------------------------------
      //  templates
      //---------------------------------------
      let templateModelBlock = {
        model: Template,
        as: 'template',
        required: true
      }
      if (args.filters.templates && args.filters.templates.length != 0) {
        templateModelBlock.where = { id: { [Op.in]: args.filters.templates} }
      } else {
        templateModelBlock = {}
      }

      //---------------------------------------
      //  end templates
      //---------------------------------------

      //---------------------------------------
      //  categories
      //---------------------------------------
      let categoryBlock = {
        model: Category,
        required: true
      }
      if (args.filters.categories && args.filters.categories.length > 0) {
        let childrenPromises = []
        const getAllChildren = ( catsPromise ) => {
          return catsPromise
          .then( cats => {
            if (cats && cats.length > 0) {
              return cats.reduce( (accP, cat) => {
                return Promise.all([accP])
                .then( values => {
                  let [acc] = values
                  acc.push( cat.id )
                  return getAllChildren( cat.getChildren() )
                  .then( allChildrenPromises => {
                    return Promise.all( allChildrenPromises )
                    .then( allChildren => {
                      let myAcc = acc.concat( allChildren )
                      return myAcc
                    })
                  })
                })
              }, Promise.resolve([]))
            } else {
              return []
            }
          })
        }
        let categoriesPromise = Promise.all( args.filters.categories.map( catId => Category.findById( catId )) )
        .then( cats => {
          cats = cats.filter( cat => cat )
          if (cats.length != 0) {
            return getAllChildren( Promise.resolve(cats) )
            .then( allCats => {
              categoryBlock.where = { id: { [Op.in]: allCats} }
            })
          } else {
            categoryBlock = {}
            //silent fail if no valid category found
            return false
          }
        })
        consolidatedPromises.push( categoriesPromise )
      } else {
        categoryBlock = {}
      }
      //---------------------------------------
      // End Categories
      //---------------------------------------

      //---------------------------------------
      // Tags
      //---------------------------------------
      let tagModelBlock
      if (args.filters.tags && args.filters.tags !=0) {
        tagModelBlock = {
          model: Tag,
          where: { id: { [Op.in]: args.filters.tags} },
          required: true,
        }
      } else {
        tagModelBlock = {}
      }

      //---------------------------------------
      // End Tags
      //---------------------------------------

      let includeBlock = [
        {
          model: Country,
          where: { isoCode: args.filters.countryCode },
          required: true
        },
      ]
      if ( Object.keys(tagModelBlock).length !== 0 ) {
        includeBlock.push( tagModelBlock )
      }
      if ( Object.keys(templateModelBlock).length !== 0 ) {
        includeBlock.push( templateModelBlock )
      }
      if ( Object.keys(userModelBlock).length !== 0 ) {
        includeBlock.push( userModelBlock )
      }
      if ( Object.keys(salemodeModelBlock).length !== 0 ) {
        includeBlock.unshift( salemodeModelBlock )
      }
      if ( Object.keys(categoryBlock).length !== 0 ) {
        includeBlock.push( categoryBlock )
      }

      //This 'id' where clause serves no purpose but to let the [Op.or] below to work.
      let whereBlock = {}
      if (args.terms) {
        let likeArray = args.terms.reduce( (acc, term) => {
            acc.push({ [Op.like]: '%' + term.replace(/[\W]+/g, "") + '%' })
            return acc
          }, [])
        whereBlock = {
          [Op.or]: {
            title: {
              [Op.or]: likeArray
            },
            description: {
              [Op.or]: likeArray
            },
          }
        }
      }
      if (args.filters.seconds) {
        whereBlock.createdAt = { [Op.gt]: new Date(new Date() - args.filters.seconds * 1000) }
      } else {
        whereBlock.id = { [Op.gt]: 0 }
      }

      // TODO:
      // args.filters.distance Long lat must be stored. Then calculate and exclude each.
      // Long Lat must be stored with each Listing
      // Viewer Long Lat must be sent with each search that requires distance.
      //  let R = 6371
      //  let x = (lambda2 - lambda1) * Math.cos((phi2 + phi1)/2)
      //  let y = (phi2 - phi1)
      //  let d = Math.sqrt(x*x + y*y) * R
      let optionBlock = {
        include: includeBlock,
/*        include: [{
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
            },
            required: true
          },
          {
            model: Country,
            where: { isoCode: args.filters.countryCode },
            required: true
          },
          {
            model: User,
            as: 'user',
            where: Sequelize.and(
              Sequelize.where(Sequelize.literal('sellerRating & ' + args.filters.rating), '!=', 0),
              Sequelize.where(Sequelize.literal('idVerification & ' + args.filters.verification), '!=', 0)
            ),
            required: true
          }
        ], */
        order: [
          ['updatedAt', 'DESC']
        ],
        offset: (args.page - 1) * args.limit,
        limit: args.limit,
      }
      console.log("whereBlock: " + Object.values(whereBlock))
      if ( Object.keys(whereBlock).length !== 0 ) {
        optionBlock.where = whereBlock
      }

      return Promise.all( consolidatedPromises )
      .then( () => Listing.findAll( optionBlock ) )

/*      return Listing.findAll({
        where: whereBlock,
        include: includeBlock,
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
            },
            required: true
          },
          {
            model: Country,
            where: { isoCode: args.filters.countryCode },
            required: true
          },
          {
            model: User,
            as: 'user',
            where: Sequelize.and(
              Sequelize.where(Sequelize.literal('sellerRating & ' + args.filters.rating), '!=', 0),
              Sequelize.where(Sequelize.literal('idVerification & ' + args.filters.verification), '!=', 0)
            ),
            required: true
          }
        ], 
        order: [
          ['updatedAt', 'DESC']
        ],
        offset: (args.page - 1) * args.limit,
        limit: args.limit,
      }) */
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
              , pictureURL: res.picture.data.url
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
                     "name": "BARGAINER"
                  }
                ]
            }
            return {
              token: jwt.sign( JSON.stringify(userToken), process.env.JWT_SECRET_KEY )
            , userid: user.id
            }
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
          return {
            token: jwt.sign( JSON.stringify(userToken), process.env.JWT_SECRET_KEY )
          , userid: oauth.userId
          }
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
        throw new Error("Authorization header does not contain a user.");
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
                        .then( tags => {
                          return barterOptionTemplate.setTags( tags )
                          .then( () => tagPromises)
                        })
                      }
                    })
                  })
                }) // End map
                return Promise.all( barterOptionPromises )
                .then( () => barterOption )
              })
            }); // End Map
            let barterReturnPromise = Promise.all( barterPromises )
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
              if (args.post.postCost) {
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
          if (args.address.lat && args.address.long) {
            submittedAddress.lat = args.address.lat
            submittedAddress.long = args.address.long
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

        let imagePromises
        if (args.images) {
          imagePromises = args.images.map( inputImage => {
            if (inputImage.deleted) {
              destroyS3andInstanceByImageId( inputImage.imageId )
              return null
            } else {
              return Image.findOne({where: {id: inputImage.imageId}})
              .then( image => {
                if (image) {
                  image.listingImages = {
                    primary: inputImage.primary
                  }
                  return image;
                } else {
                  return Promise.reject(new Error("Image Id not found. imageId: " + inputImage.imageId))
                }
              });
            }
          }).filter( promise => promise );
        }

        return Promise.all(imagePromises)
        .then( images => {
          return Listing.create({
              title: args.title
            , description: args.description
          }).catch( (e) => console.log("ERROR: ListingPromise: ", e))
          .then( listing => {
            let countryPromise = Country.findOne({where: {isoCode: args.countryCode}})
            .then( country => {
              if (country) {
                return listing.setCountry(country)
              }
              return Promise.reject(new Error("Country not found. CountryCode: " + args.countryCode))
            })
            let addListingsPromise
            if (images && images.length > 0) {
              addListingsPromise  = listing.addImages(images)
            }
            let categoryPromise = Category.findOne({ where: { id: args.categoryId } })
            .then( cat => {
              if (cat) {
                return cat.addListing( listing )
              }
              return Promise.reject(new Error("Category not found. CategoryId: " + args.categoryId))
            })
            let userPromise = User.findOne({ where: { id: context.userid }})
            .then( user => {
              if (user) {
                return user.addListing( listing )
              }
              return Promise.reject(new Error("User not found. UserId: " + context.userid))
            })
            let templatePromise = listing.setTemplate( args.templateId ).catch( (e) => console.log("ERROR: Listing.setTemplate: ", e));
            let salemodePromise = listing.setSaleMode( mode ).catch( (e) => console.log("ERROR: Listing.setSaleMode: ", e));
            let tagPromises = []
            if (args.tagIds && args.tagIds.length > 0) {
              tagPromises = args.tagIds.map( tagId => Tag.findOne({ where: {id: tagId} }).catch( (e) => { console.log("Error: " + e); return Promise.reject(new Error("User Error: listing: tagId")) }))
            }
            return Promise.all( tagPromises )
            .then( tags => {
              if (tags) {
                return listing.setTags( tags )
                .catch( e => {
                  return Promise.reject(new Error("User Error: listing: tags"))
                })
                .then( () => {
                  return Promise.all( [countryPromise, categoryPromise, addListingsPromise, userPromise, templatePromise, salemodePromise].concat( promiseCollection ) )
                  .then( () => {
                    return listing.reload()
                  })
                })
              }
            })
          })
        })
      })
    },
    addTemplate(_, args, context) {

    },
/*  addTemplate(
    title: String!
    description: String!
    categoryId: Int!
    tagIds: [Int]
    images: [UploadedImage]
  ): Template */

    incrementViewings(_, args, context) {
      return Listing.findOne({ where: { id: args.listingId }})
      .then( listing => {
        return listing.getViews({ where: { id: context.userid }})
        .then( view => {
          if (view.length == 0) {
            return listing.addViews( context.userid )
            .then( view => {
              console.log("Top-TEST: " + JSON.stringify( view ))
              return 1
            })
          }
          return listing.addViews( view[0], { 
            through: {
              skipped: true,
              visits: view[0].listingViews.visits + 1,
            }
          })
          .then( changes => {
            return view[0].listingViews.visits + 1 
          })
        })
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
          .catch( e => Promise.reject(new Error("User Error: You cannot like a listing twice, or your userId doesn't exist.")))
          .then( () => {
            return true
          })
        } else {
          return listing.removeLike(context.userid)
          .then( () => {
            return false
          })
        }
      })
    },
    rateTranslation(_, args, context) {
      if (context.userid !== "") {
        return User.findById( context.userid )
        .then( user => {
          return Rating.findOrCreate({
              where: { reviewerId: context.userid
                     , translationId: args.translationId
                     }
            , defaults: {
                  good: args.good
                , weight: user.translatorWeight
                , comment: args.comment
            }
          })
          .then( (rating, created) => {
            if (!created) {
              rating.good = args.good
              rating.weight = user.translatorWeight
              rating.comment = args.comment
              return rating.save()
            }
            return rating
          })
        })
      }
    },
    unrateTranslation(_, args, context) {
      // Delete rating and all subsequent ratings
      return Rating.findById( args.ratingId )
      .then( rating => {
        let rollingRatingDelete = childrenPromise => {
          Promise.all([childrenPromise])
          .then( children => {
            children.map( child => {
              rollingRatingDelete( child.getComments )
              child.destroy()
            })
          })
        }
        if (rating) {
          if (context.roles.includes(Roles.Super)) {
            rollingRatingDelete([rating])
            return true
          }
          if (context.roles.includes(Roles.Admin)) {
            // Delete anything in Admin's country return true
            // Follow chain of ratings up to contentId (maybe through translationId) and then check country
            let climbToCountry = instancePromise => {
              return Promise.all([instancePromise])
              .then( instance => {
                //TODO check locuId
                if (instance.locusId) {
                  //This is an instance of Content, get the country and check against AdminCountry
                  if (context.countryCode == instance.countryCode) {
                    rollingRatingDelete([rating])
                    return true
                  }
                  return false
                }
                if (instance.contentId) {
                  // return call recursively on Content instance from contentId
                  return climbToCountry( Content.findById( instance.contentId ))
                }
                if (instance.translationId) {
                  // return call recursively on Tranlation instance from translationId
                  return climbToCountry( Translation.findById( instance.translationId ))
                }
                if (instance.parentId) {
                  // return call recursively on Rating instance from parentId
                  return climbToCountry( Rating.findById( instance.translationId ))
                }
                return Promise.reject( new Error("This ADMIN does not have the authority to remove ratings in this country."))
              })
            }
            return climbToCountry( [rating] )
          }
          if (rating.reviewerId == context.userid) {
            // Delete rating because it belongs to user return true
            rollingRatingDelete([rating])
            return true
          }
        } else {
          return Promise.reject( new Error("This rating does not exist!"))
        }
      })
    },
    createChat(_, args, context) {
      return Chat.find({
        where: {
                 initUserId: context.userid
               , listingId: args.listingId
               }
      })
      .then( oldChat => {
        if (!oldChat) {
          return Chat.create({})
          .then( chat => {
            let senderPromise = User.find({
              where: { id: context.userid }
            })
            let listingPromise = Listing.find({
              where: { id: args.listingId }
            })
            return Promise.all([senderPromise, listingPromise])
            .then( values => {
              let [sender, listing] = values;
              if (!sender) {
                throw new Error("Sending user not found. This is probably an Authorization header problem.");
              }
              if (!listing) {
                throw new Error("Listing not found.");
              }
              if (listing.userId == sender.id) {
                chat.destroy({ force: true })
                return Promise.reject( new Error("You cannot initiate a chat about your own listing!"))
              }
              return Promise.all([chat.setInitUser(sender), chat.setListing(listing)])
              .then( () => chat)
            })
          })
        } else {
          return Promise.reject( new Error("Chat already exists!"))
        }
      })
    },
    deleteChat(_, args, context) {
      return Chat.findById( args.chatId )
      .then( chat => {
        if (chat) {
          // chat exists
          return Listing.findById( chat.listingId )
          .then( listing => {
            if ( chat.initUserId == context.userid || listing.userId == context.userid ) {
              // userid authorized to delete.
              if ( chat.delRequestUserId ) {
                // Someone has already deleted from their end
                if ( chat.delRequestUserId != context.userid ) {
                  // AND it was the other user
                  // Destroy chat completely.
                  return chat.getChatmessages()
                  .then( chatMessages => {
                    let deleteMessagePromises = chatMessages.map( chatMessage => {
                      return chatMessage.getImage()
                      .then( image => {
                        if (image) {
                          // TODO: Could be shared image... might want to do a check.
                          return destroyS3andInstanceByImageId( chatMessage.id )
                        } return null
                      })
                      .then( () => chatMessage.destroy({force: true}))
                      // *^^* CASCADE is set, but since we are here already...
                    })
                    return Promise.all( deleteMessagePromises )
                    .then( () => {
                      return chat.destroy()
                      .then( () => true )
                    })
                  })
                } else {
                  // Do nothing
                  return Promise.reject( new Error("User has already deleted their end of this chat."))
                }
              }
              else {
                // No previous attempt to delete chat
                console.log("Virgin attempt at deleting chat")
                return chat.setDelRequestUser( context.userid )
                .then( () => {
                  return chat.getChatmessages({
                    where: { authorId: context.userid }
                  })
                  .then( chatMessages => {
                    let deleteMessagePromises = chatMessages.map( chatMessage => {
                      return chatMessage.getImage()
                      .then( image => {
                        if (image) {
                          return destroyS3andInstanceByImageId( chatMessage.id )
                        } else return null
                      })
                      .then( () => chatMessage.destroy({force: true}))
                    })
                    return Promise.all( deleteMessagePromises )
                    .then( () => true )
                  })
                })
              }
            }
          })
        }
        return Promise.reject( new Error("Chat does not exist!"))
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
        return chat.getListing()
        .then( listing => {
          if ( chat.initUserId == context.userid || listing.userId == context.userid ) {
            if (chat.delRequestUserId == context.userid) {
              return Promise.reject(new Error("User has deleted this chat."))
            }
            return ChatMessage.create({
              // TODO: Some protection from ridiculously large messages?
              message: args.message
            })
            .then( chatMessage => {
              let imageDeletePromise = Promise.resolve(true)
              let setImagePromise = Promise.resolve(true)
              if (args.image) {
                if (args.image.deleted) {
                  // Only if the image doesn't exist somewhere else, delete it.
                  // I don't use args.image.exists -> it is redundant
                  imageDeletePromise = Image.findById( args.image.imageId )
                  .then( image => {
                    return image.countChatmessage()
                    .then( noOfImages => {
                      if (noOfImages <= 1) {
                        console.log( AWS.deleteObject( args.image.imageKey ) )
                        return image.destroy()
                      }
                    })
                  })
                } else {
                  setImagePromise = chatMessage.setImage( args.image.imageId )
                }
              }
              let setAuthorPromise = chatMessage.setAuthor( context.userid );
              return Promise.all([ imageDeletePromise, setImagePromise, setAuthorPromise])
              .then( () => {
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
            })
          } else {
            // User doesn't belong in conversation
            return Promise.reject(new Error("User not a member of chat."))
          }
        })
      })
    },
    deleteChatMessage(_, args, context) {
      return ChatMessage.findOne({ where: { id: args.id }})
      .then( chatmessage => {
        if (!chatmessage) {
          return Promise.reject(new Error("Chat message not found! Cannot delete."))
        }
        if (chatmessage.authorId == context.userid) {
          //authorized to delete
          return Chat.findOne( { where: { id: chatmessage.chatId }} )
          .then( chat => {
            return chatmessage.getImage()
            .then( image => {
              if (image) {
                return image.countChatmessage()
                .then( noOfImages => {
                  if ( noOfImages <= 1 ) {
                    console.log( AWS.deleteObject( image.imageKey ) )
                    return image.destroy()
                  }
                })
              }
            })
            .then( () => {
              return chatmessage.destroy() // returns Promise<undefined>
              .then( () => {
                return chat.getChatmessages( {where: { id: { [Op.gt]: args.lastMessageId }}} )
              })
            })
          })
        } else {
          return Promise.reject( new Error("User not authorized to delete this message."))
        }
      })
    }
  },
  User: {
    listings(user) {
      return user.getListings();
    },
    online(user) {
      // OnlineStatus is Mongoose, not sqlite
      return OnlineStatus.findOne({ userId: user.id }).then(is => {
        if (is) {
          return is.online
        } else {
          return false
        }
      })
    },
    country(user) {
      return Country.findOne({ where: { isoCode: user.country }});
    },
    profileImage(user) {
      return user.getProfileImage()
      .then( profileImage => {
        if (!profileImage) {
          return user.getOauths()
          .then( oauths => {
            return {
              imageURL: oauths[0].pictureURL
            }
          })
        } else {
          return profileImage
        }
      })
    },
  },
  Listing: {
    user(listing) {
      return User.findOne({ where: { id: listing.userId }});
    },
    saleMode(listing) {
      return listing.getSaleMode();
    },
    template(listing) {
      return listing.getTemplate();
    },
    viewers(listing) {
      /*
      if (listing.Views) {
        console.log("TESTING______________Likes: ", listing.Views)
        return listing.Views[0].dataValues.viewers
      }*/
      return listing.countViews()
    },
    likes(listing) {
      // This `listing.Like` looks into the User object that is linked by listingLikes
      // Not what we need here.
      /*
      if (listing.Like) {
        console.log("TESTING______________Likes: ", listing.Like)
        return listing.Like[0].dataValues.likes
      } */
      return listing.countLike()
    },
    liked(listing, _, context) {
      return listing.hasLike(context.userid)
    },
    chatId(listing, _, context) {
      return Chat.find({ where: {
          initUserId: context.userid,
          listingId: listing.id
        }
      })
      .then( chat => {
        if ( chat ) {
          if ( chat.delRequestUserId == context.userid ) {
            // User has deleted this chat and doesn't want to hear about it.
            return -1
          }
          return chat.id
        }
        return -1
      })
    },
    /*
    chatExists(listing, _, context) {
      return Chat.find({ where: {
          initUserId: context.userid,
          recUserId: listing.userId,
          listingId: listing.id
        }
      })
      .then( chat => chat ? true : false )
    }, */
    primaryImage(listing) {
//      listing.getImage().then(images => images.filter(image => image.listingImages.dataValues.primary == true).map(image => console.log(image.listingImages.dataValues.primary)));
      return listing.getImages()
      .then(images => {
        if (images) {
          let result = images.filter(image => image.listingImages.dataValues.primary == true)
          return result[0]
        } else {
          return null
        }
      })
    },
    secondaryImages(listing) {
      return listing.getImages().then(images => images.filter(image => image.listingImages.dataValues.primary == false));
    },
    tags(listing) {
      return listing.getTags();
    },
    category(listing) {
      return listing.getCategory()
    },
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
  ExchangeMode: {
    currency(exchangeMode) {
      return exchangeMode.getCurrency()
    },
    location(exchangeMode) {
      return exchangeMode.getLocation()
    }
  },
  Country: {
    currencies(country) {
      return country.getCurrency()
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
    userId(chat, _, context) {
      return context.userid
    },
    listing(chat) {
      return chat.getListing();
    },
    chatMessages(chat, _, context) {
      if (chat.delRequestUserId && (chat.delRequestUserId == context.userid)) {
        // Requesting user has deleted this chat. Ignore.
      } else {
        // Only include message id > lastMessageId
        if (chat.lastMessageId) {
          return chat.getChatmessages( {where: { id: { [Op.gt]: chat.lastMessageId }}} )
        } else {
          // This will grab NEW chats.
          return chat.getChatmessages();
        }
      }
    }
  },
  ChatMessage: {
    image(chat) {
      return chat.getImage();
    },
    time(chat) {
      return chat.createdAt
    },
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
  LogStatus: {
    user( logStatus ) {
      return User.findById( logStatus.userid )
    }
  },
  Locus: {
    children(locus, args, context) {
      if (args.cascade) {
        return locus.getChildren()
      }
    },
    content(locus, args, content) {
      //WHATROLEAMI
      if (context.roles.includes(Roles.Super) || context.roles.includes(Roles.Admin)) {
        // Never return personal content in the stead of popular content
        // Unless args.preferMyContent == true
        if (args.preferMyContent && args.preferMyContent == true) {

        } else {
          locus.getContent({
            include: [
              {
                  model: Country
                , where: { countryCode: { [Op.in]: [ args.countryCode, null ] }}
                , required: true
              },
              {
                  model: Translation
                , where: { iso639_2: { [Op.in]: args.languageCodes }}
                , attributes: [
                    [Sequelize.fn('MAX', Sequelize.col('aggRating')), 'highest']
                  ]
                , through: {
                    group: ['country.countryCode'],
                  }

                /*
                , include: [
                    {
                        model: Translation
                      , attributes: [
                          [Sequelize.fn('MAX', Sequelize.col('aggRating')), 'highest']
                        ],
                      , through: {
                          group: ['country.countryCode'],
                        }
                      , required: true
                    }
                  ]
                  */
                , required: true
              }
            ]
          })
        }
      }
    },

  },
  /*
    countryCode: String!
    languageCodes: [String]!
    cascade: Boolean = true
    preferMyContent: Boolean
    */
/*
  children: [Locus]
  content: [Content]
  */
};

const destroyS3andInstanceByImageId = (imageId) => {
  return Image.findById( imageId )
  .then( image => {
    return image.countChatmessages()
    .then( noOfImages => {
      if (noOfImages == 1) {
        console.log( AWS.deleteObject( image.imageKey ) )
        return image.destroy({force: true})
        .then( () => null )
      }
      return null
    })
  })
}

export default resolvers;
