const loci = {
    App:                    { name: 'App'
                            , parentName: 'App'
                            }
  , CategoryScreen:         { name: 'CategoryScreen'
                            , parentName: 'App'
                            }
  , ChatScreen:             { name: 'ChatScreen'
                            , parentName: 'App'
                            }
  , DrawerContainer:        { name: 'DrawerContainer'
                            , parentName: 'App'
                            }
  , HomeScreen:             { name: 'HomeScreen'
                            , parentName: 'App'
                            }
  , ProductDetailsScreen:   { name: 'ProductDetailsScreen'
                            , parentName: 'App'
                            }
  , SettingScreen:          { name: 'SettingScreen'
                            , parentName: 'App'
                            }
  , ChatDetailScreen:       { name: 'ChatDetailScreen'
                            , parentName: 'App'
                            }
  , CountryScreen:          { name: 'CountryScreen'
                            , parentName: 'App'
                            }
  , FavoriteScreen:         { name: 'FavoriteScreen'
                            , parentName: 'App'
                            }
  , LoginScreen:            { name: 'LoginScreen'
                            , parentName: 'App'
                            }
  , ProfileScreen:          { name: 'ProfileScreen'
                            , parentName: 'App'
                            }
  , StrollersScreen:        { name: 'StrollersScreen'
                            , parentName: 'App'
                            }
  , ChatListScreen:         { name: 'ChatListScreen'
                            , parentName: 'App'
                            }
  , CreateNewItemScreen:    { name: 'CreateNewItemScreen'
                            , parentName: 'App'
                            }
  , FilterScreen:           { name: 'FilterScreen'
                            , parentName: 'App'
                            }
  , NotificationScreen:     { name: 'NotificationScreen'
                            , parentName: 'App'
                            }
  , SearchResultScreen:     { name: 'SearchResultScreen'
                            , parentName: 'App'
                            }
  , SupportScreen:          { name: 'SupportScreen'
                            , parentName: 'App'
                            }
  , Countries:              { name: 'Countries'
                            , parentName: 'App'
                            }
  , Categories:             { name: 'Categories'
                            , parentName: 'App'
                            }
  , Title0:                 { name: 'Title'
                            , parentName: 'HomeScreen'
                            }
  , SearchSuggestion:       { name: 'SearchSuggestion'
                            , parentName: 'HomeScreen'
                            }
  , MostLiked:              { name: 'MostLiked'
                            , parentName: 'HomeScreen'
                            }
  , MostRecent:             { name: 'MostRecent'
                            , parentName: 'HomeScreen'
                            }
  , MostVisited:            { name: 'MostVisited'
                            , parentName: 'HomeScreen'
                            }
  , UserMostVisited:        { name: 'UserMostVisited'
                            , parentName: 'HomeScreen'
                            }
  , UserMostLiked:          { name: 'UserMostLiked'
                            , parentName: 'HomeScreen'
                            }
  , UserPosted:             { name: 'UserPosted'
                            , parentName: 'HomeScreen'
                            }
  , Question:               { name: 'Question'
                            , parentName: 'HomeScreen'
                            }
  , Suggestion:             { name: 'Suggestion'
                            , parentName: 'HomeScreen'
                            }
  , Title1:                 { name: 'Title'
                            , parentName: 'LoginScreen'
                            }
  , Connect:                { name: 'Connect'
                            , parentName: 'LoginScreen'
                            }
  , Title2:                 { name: 'Title'
                            , parentName: 'CategoryScreen'
                            }
}

const contentValues = [
    { meaning: "Do you have something to sell or give away?"
    , locus: {
        name: 'Question'
      , parentName: 'HomeScreen'
      }
    , translations: [
        { iso639_2: 'eng'
        , translatorId: 1
        , text: "Do you have something to sell or give away?"
        }
      , { iso639_2: 'msa'
        , translatorId: 1
        , text: "Anda ada barang untuk dijual atau diberi"?
        }
      ]
    }
  , { meaning: "Post it with us and we'll give you an audience."
    , locus: {
        name: 'Suggestion'
      , parentName: 'HomeScreen'
      }
    , translations: [
        { iso639_2: 'eng'
        , translatorId: 1
        , text: "Post it with us and we'll give you an audience."
        }
      , { iso639_2: 'msa'
        , translatorId: 1
        , text: "Poskan di laman web kami dan kami akan sebarkan."
        }
      ]
    }
]

export {
  , loci
  , contentValues
}
