const loci = [
    { name: 'App'
    , parentName: null
    , grandParentName: null
    }
  , { name: 'CategoryScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'ChatScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'DrawerContainer'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'HomeScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'ProductDetailsScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'SettingScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'ChatDetailScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'CountryScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'FavoriteScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'LoginScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'ProfileScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'StrollersScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'ChatListScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'CreateNewItemScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'FilterScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'NotificationScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'SearchResultScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'SupportScreen'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'Countries'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'Categories'
    , parentName: 'App'
    , grandParentName: null
    }
  , { name: 'Title'
    , parentName: 'HomeScreen'
    , grandParentName: 'App'
    }
  , { name: 'SearchSuggestion'
    , parentName: 'HomeScreen'
    , grandParentName: 'App'
    }
  , { name: 'MostLiked'
    , parentName: 'HomeScreen'
    , grandParentName: 'App'
    }
  , { name: 'MostRecent'
    , parentName: 'HomeScreen'
    , grandParentName: 'App'
    }
  , { name: 'MostVisited'
    , parentName: 'HomeScreen'
    , grandParentName: 'App'
    }
  , { name: 'UserMostVisited'
    , parentName: 'HomeScreen'
    , grandParentName: 'App'
    }
  , { name: 'UserMostLiked'
    , parentName: 'HomeScreen'
    , grandParentName: 'App'
    }
  , { name: 'UserPosted'
    , parentName: 'HomeScreen'
    , grandParentName: 'App'
    }
  , { name: 'Question'
    , parentName: 'HomeScreen'
    , grandParentName: 'App'
    }
  , { name: 'Suggestion'
    , parentName: 'HomeScreen'
    , grandParentName: 'App'
    }
  , { name: 'Title'
    , parentName: 'LoginScreen'
    , grandParentName: 'App'
    }
  , { name: 'Connect'
    , parentName: 'LoginScreen'
    , grandParentName: 'App'
    }
  , { name: 'Title'
    , parentName: 'CategoryScreen'
    , grandParentName: 'App'
    }
]


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
        , text: "Anda ada barang untuk dijual atau diberi?"
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
    loci
  , contentValues
}
