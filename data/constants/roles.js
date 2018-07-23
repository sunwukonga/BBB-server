const roles = {
    General:    'GENERAL'
  , Bargainer:  'BARGAINER'
  , Translator: 'TRANSLATOR'      // Able to approve translations for general usage. Ratings given on Translations have higher weight.
  , Editor:     'EDITOR'          // Able to approve context changes for general usage. Ratings given on Content have higher weight.
  , Cataloguer: 'CATALOGUER'      // Able to approve new templates and tags for general usage. Ratings given on Templates have higher weight.
  , Admin:      'ADMIN'           // Admin of a country. Warn and ban users. Review flags. Delete listings. Add roles {Trans, Edi, Cata} for their country. Weighting bonus on other held roles.
  , Super:      'SUPER'           // Admin of everything. Assign Admins and other roles. Review flags, delete listings, warn and ban. Weighting bonus other held roles.
}

export default roles
